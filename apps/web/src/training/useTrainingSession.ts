import { useCallback, useEffect, useRef, useState } from 'react';
import type { GivenAnswer } from '@greprep/api-client';
import type { StoredTraining } from './model';
import { trainingRepository } from './repository';
import { answerFormat, draftAnswer } from './answerFormats';
import { draftStamp, type LeavingDraft } from './leavingDraftStore';
import { TrainingRules } from './rules';

// Только набор числа ждёт паузу: выбор вариантов должен пережить закрытие WebView без pagehide.
const DRAFT_DELAY_MS = 300;
const MAX_ELAPSED_MS = 86_400_000;

const initialSelection = (training: StoredTraining) => {
  const answer = training.answers[String(training.position)];
  const format = answerFormat(training.session.items[training.position]!.question);
  return training.session.mode === 'check' && training.drafts?.[String(training.position)] ? training.drafts[String(training.position)]! : answer ? format?.decode(answer) ?? [] : training.drafts?.[String(training.position)] ?? [];
};

/** Выбор виден сразу, записи идут по порядку; отложенные переходы читают уже записанное состояние. */
export function useTrainingSession(incoming: StoredTraining) {
  const [training, setTraining] = useState(incoming);
  const [selection, setSelection] = useState(() => initialSelection(incoming));
  const [overview, updateOverview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectionLimit, setSelectionLimit] = useState(false);
  const [now, setNow] = useState(Date.now);
  const latest = useRef(incoming);
  const persisted = useRef(incoming);
  const selected = useRef(selection);
  const selectionVersion = useRef(0);
  const overviewRef = useRef(false);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const foreground = useRef(0);
  const dirty = useRef<LeavingDraft | undefined>(undefined);
  const persisting = useRef<LeavingDraft | undefined>(undefined);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const writeFailed = useRef(false);
  const releaseSync = useRef<(() => void) | undefined>(undefined);
  const expiredFinish = useRef<StoredTraining['finish']>(undefined);
  const shownAt = useRef(Date.now());
  const id = incoming.session.id;
  const owner = useRef(trainingRepository.reportOwner());
  const [reportJournal] = useState(() => trainingRepository.journalReporter());
  const mounted = useRef(true);

  const checkpoint = useCallback((draft: LeavingDraft) => {
    const current = trainingRepository.reportOwner();
    if (owner.current && current?.userId === owner.current.userId && current.revision === owner.current.revision) {
      trainingRepository.checkpointDraft(id, draft, owner.current, reportJournal);
    }
  }, [id, reportJournal]);

  const showSelection = (ids: string[]) => { selected.current = ids; setSelection(ids); };
  const setOverview = (open: boolean) => { overviewRef.current = open; updateOverview(open); if (open) void flush(); };
  useEffect(() => {
    if (pending.current || dirty.current || expiredFinish.current && !incoming.finish) return;
    latest.current = incoming; persisted.current = incoming;
    setTraining(incoming); selected.current = initialSelection(incoming); setSelection(selected.current);
  }, [incoming]);

  const persistDraft = useCallback(async () => {
    clearTimeout(draftTimer.current); draftTimer.current = undefined;
    const draft = dirty.current;
    if (!draft) return;
    dirty.current = undefined; persisting.current = draft;
    try {
      if (draft.answer) await trainingRepository.answer(id, draft.answer, draft.ids, draft.savedAt);
      else await trainingRepository.draft(id, draft.position, draft.ids, draft.savedAt);
      trainingRepository.clearCheckpoint(id, draft, owner.current, reportJournal);
    } catch (error) {
      dirty.current ??= draft;
      checkpoint(dirty.current);
      throw error;
    } finally { persisting.current = undefined; }
  }, [id, checkpoint, reportJournal]);

  const run = useCallback((action: () => Promise<void>, interactive = true) => {
    const version = selectionVersion.current;
    if (!releaseSync.current) releaseSync.current = trainingRepository.holdSync(id);
    const queued = pending.current > 0;
    pending.current++;
    if (interactive) { foreground.current++; setBusy(true); }
    let succeeded = false;
    const execute = async () => {
      try {
        await persistDraft();
        await action();
        const fresh = await trainingRepository.get(id);
        if (!fresh) throw new Error('training record unavailable after write');
        persisted.current = fresh;
        // Подтверждение раннего касания не перерисовывает более поздний выбор.
        const preserveSelection = selectionVersion.current !== version && fresh.position === latest.current.position;
        latest.current = { ...fresh,
          ...(preserveSelection && { drafts: latest.current.drafts, ...(fresh.session.mode === 'check' && { answers: latest.current.answers }) }),
          ...(expiredFinish.current && { finish: expiredFinish.current }),
        };
        setTraining(latest.current);
        if (!preserveSelection) { selected.current = initialSelection(latest.current); setSelection(selected.current); }
        writeFailed.current = false; setFailed(false); succeeded = true;
      } catch {
        // Репозиторий сообщает о сбое без содержимого; откатываем только выбор, которому нет новой замены.
        if (selectionVersion.current === version) {
          latest.current = { ...persisted.current, ...(expiredFinish.current && { finish: expiredFinish.current }) };
          setTraining(latest.current); selected.current = initialSelection(latest.current); setSelection(selected.current);
        }
        writeFailed.current = true; setFailed(true);
      } finally {
        pending.current--;
        if (interactive) { foreground.current--; setBusy(foreground.current > 0); }
        if (!pending.current && (!dirty.current || !mounted.current)) { releaseSync.current?.(); releaseSync.current = undefined; }
      }
    };
    queue.current = queued ? queue.current.then(execute) : execute();
    return queue.current.then(() => succeeded);
  }, [id, persistDraft]);

  const flush = useCallback(() => dirty.current ? run(async () => {}, false) : pending.current ? queue.current.then(() => !writeFailed.current) : Promise.resolve(true), [run]);
  useEffect(() => {
    mounted.current = true;
    const leaving = () => {
      const draft = dirty.current ?? persisting.current;
      if (draft) checkpoint(draft);
      void flush();
    };
    const hidden = () => { if (document.visibilityState === 'hidden') leaving(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', leaving);
    return () => {
      document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leaving);
      mounted.current = false;
      leaving();
      // Экран ушёл даже при зависшей записи; его удержание не мешает следующему входу и отправке.
      releaseSync.current?.(); releaseSync.current = undefined;
    };
  }, [flush, checkpoint]);

  const expire = useCallback(() => {
    const current = latest.current;
    if (current.finish) return true;
    const currentTime = Date.now();
    if (TrainingRules.remainingSeconds(current, currentTime) !== 0) return false;
    // Итог не ждёт IndexedDB. Ответы, принятые до срока, дописываются перед концом очереди.
    expiredFinish.current = { finishedAt: new Date(current.startedAtMillis + current.session.timeLimitSeconds! * 1000).toISOString(), timedOut: true };
    latest.current = { ...current, finish: expiredFinish.current }; setTraining(latest.current); setNow(currentTime);
    void run(() => trainingRepository.finish(id, true));
    return true;
  }, [id, run]);

  useEffect(() => {
    if (training.session.mode !== 'check' || training.finish) return;
    const tick = () => { setNow(Date.now()); expire(); };
    tick();
    const interval = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick); window.addEventListener('pageshow', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); window.removeEventListener('pageshow', tick); };
  }, [training.session.mode, training.finish, expire]);

  const makeAnswer = (ids: string[], dontKnow = false, flagged = latest.current.answers[String(latest.current.position)]?.flagged ?? false): GivenAnswer => ({
    position: latest.current.position, ...(answerFormat(latest.current.session.items[latest.current.position]!.question)?.encode(latest.current.session.items[latest.current.position]!.question, ids) ?? { optionIds: [] }), dontKnow, flagged,
    answeredAt: new Date(Date.now()).toISOString(), elapsedMs: Math.min(MAX_ELAPSED_MS, Math.max(0, Date.now() - shownAt.current)),
  });
  const save = async (ids: string[], dontKnow = false, flagged?: boolean) => {
    if (expire()) return;
    await trainingRepository.answer(id, makeAnswer(ids, dontKnow, flagged));
  };
  const move = async (next: number) => {
    const current = latest.current;
    if (expire() || next < 0 || next >= current.session.items.length) return;
    const anchor = current.practiceReturnPosition ?? current.position;
    await trainingRepository.moveTo(id, next, current.session.mode === 'practice' && next < anchor ? anchor : undefined);
    shownAt.current = Date.now(); setOverview(false); setSelectionLimit(false);
  };
  const advance = async () => {
    const current = latest.current;
    if (expire() || current.session.mode === 'practice' && !current.answers[String(current.position)]) return;
    if (current.position < current.session.items.length - 1) await move(current.position + 1);
    else if (current.session.mode === 'check') setOverview(true);
    else await trainingRepository.finish(id, false);
  };
  const check = async () => {
    const current = latest.current;
    if (current.session.mode === 'practice' && !current.answers[String(current.position)] && answerFormat(current.session.items[current.position]!.question)?.isComplete(current.session.items[current.position]!.question, draftAnswer(current.session.items[current.position]!.question, selected.current))) await save(selected.current);
  };
  const select = (optionId: string) => {
    const current = latest.current;
    if (expire() || current.session.mode === 'practice' && current.answers[String(current.position)]) return;
    const question = current.session.items[current.position]!.question;
    const next = answerFormat(question)?.select(question, selected.current, optionId);
    if (!next) return;
    setSelectionLimit(next.limit);
    if (next.limit) return;
    change(next.value);
  };
  const change = (ids: string[]) => {
    const current = latest.current;
    if (expire() || current.session.mode === 'practice' && current.answers[String(current.position)]) return;
    selectionVersion.current++; showSelection(ids);
    const answer = current.session.mode === 'check' ? makeAnswer(ids) : undefined;
    latest.current = { ...current, drafts: { ...current.drafts, [current.position]: ids },
      ...(answer && { answers: { ...current.answers, [current.position]: answer } }),
    }; setTraining(latest.current);
    dirty.current = { position: current.position, ids, answer, savedAt: draftStamp() };
    if (!releaseSync.current) releaseSync.current = trainingRepository.holdSync(id);
    clearTimeout(draftTimer.current);
    if (answerFormat(current.session.items[current.position]!.question)?.component === 'numeric') draftTimer.current = setTimeout(() => { void flush(); }, DRAFT_DELAY_MS);
    else void flush();
  };
  const position = training.position;
  const question = training.session.items[position]!.question;
  const answer = training.answers[String(position)];
  const checkMode = training.session.mode === 'check';
  const revealed = !checkMode && Boolean(answer);
  const returnPosition = training.practiceReturnPosition ?? position;
  const browsingPast = !checkMode && training.practiceReturnPosition !== undefined && position < returnPosition && revealed;
  return { training, selection, selectionLimit, returnPosition, browsingPast, overview, setOverview, busy, failed, position, question, answer, checkMode, revealed,
    complete: answerFormat(question)?.isComplete(question, draftAnswer(question, selection)) ?? false, flagged: answer?.flagged ?? false,
    remaining: TrainingRules.remainingSeconds(training, now), select, change, flush,
    selectKey: (key: string) => {
      const question = latest.current.session.items[latest.current.position]!.question;
      const input = answerFormat(question)?.selectKey?.(question, selected.current, key);
      if (input) select(input);
    },
    go: (next: number) => void run(() => move(next)),
    previous: () => void run(() => move(latest.current.position - 1)),
    next: () => void run(advance),
    primary: () => void run(async () => {
      if (expire()) return;
      if (browsingPast) { await move(returnPosition); return; }
      if (overviewRef.current) await trainingRepository.finish(id, false);
      else if (latest.current.session.mode === 'check' || latest.current.answers[String(latest.current.position)]) await advance();
      else await check();
    }),
    acknowledgeTimeout: () => void run(() => trainingRepository.acknowledgeTimeout(id)),
    dontKnow: () => void run(async () => {
      const current = latest.current;
      if (current.session.mode === 'practice' && !current.answers[String(current.position)]) await save([], true, false);
    }),
    flag: () => {
      if (expire() || latest.current.session.mode !== 'check') return;
      void run(() => save(selected.current, false, !latest.current.answers[String(latest.current.position)]?.flagged));
    },
  };
}

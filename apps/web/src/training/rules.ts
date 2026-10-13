import type { LocalizedText } from '@greprep/api-client';
import type { StoredTraining } from './model';
import { answerFormat } from './answerFormats';
import { ChoiceRules } from './choiceRules';

export interface TopicReview { topicId: string; title: LocalizedText; mistakes: number; positions: number[] }

export const TrainingRules = {
  repeatCount: (mistakes: number) => Math.min(10, Math.max(5, mistakes * 2)),
  timeLimitSeconds: (count: number, paceSeconds: number) => count * paceSeconds,
  ...ChoiceRules,
  remainingSeconds(training: StoredTraining, nowMillis: number): number | undefined {
    const limit = training.session.timeLimitSeconds;
    if (training.session.mode !== 'check' || limit === undefined) return undefined;
    return Math.max(0, limit - Math.trunc((nowMillis - training.startedAtMillis) / 1000));
  },
  durationSeconds(training: StoredTraining): number {
    if (!training.finish) return 0;
    const seconds = Math.max(0, Math.trunc((Date.parse(training.finish.finishedAt) - training.startedAtMillis) / 1000));
    return training.session.mode === 'check' && training.session.timeLimitSeconds !== undefined ? Math.min(seconds, training.session.timeLimitSeconds) : seconds;
  },
  summaryMinutes(durationSeconds: number, limitSeconds?: number) {
    const limitMinutes = limitSeconds === undefined ? undefined : Math.ceil(limitSeconds / 60);
    const minutes = Math.max(1, Math.round(durationSeconds / 60));
    return { minutes: limitMinutes === undefined ? minutes : Math.min(minutes, limitMinutes), limitMinutes };
  },
  result(training: StoredTraining) {
    const timedOut = training.session.mode === 'check' && training.finish?.timedOut === true;
    let correct = 0;
    let unanswered = 0;
    const byTopic = new Map<string, TopicReview>();
    for (const item of training.session.items) {
      const answer = training.answers[String(item.position)];
      const format = answerFormat(item.question);
      if (format?.isCorrect(item.question, answer)) { correct++; continue; }
      if (!answer || !format?.decode(answer).some(Boolean)) { unanswered++; if (timedOut && !answer?.dontKnow) continue; }
      const q = item.question;
      const previous = byTopic.get(q.topicId);
      if (previous) { previous.mistakes++; previous.positions.push(item.position); }
      else byTopic.set(q.topicId, { topicId: q.topicId, title: q.topicTitle, mistakes: 1, positions: [item.position] });
    }
    // Равные темы остаются в порядке вопросов, как в Android и общем договоре.
    const review = [...byTopic.values()].sort((a, b) => b.mistakes - a.mistakes).slice(0, 3);
    return { correct, total: training.session.items.length, unanswered, durationSeconds: this.durationSeconds(training), review };
  },
};

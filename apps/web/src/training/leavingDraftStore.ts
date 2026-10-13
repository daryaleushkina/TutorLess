import { schemas } from '@greprep/api-client';
import { z } from 'zod';
import type { TrainingOwner } from './store';

const draftSchema = z.object({ position: z.number().int().nonnegative(), ids: z.array(z.string()), answer: schemas.GivenAnswer.optional() }).strict()
  .refine((draft) => !draft.answer || draft.answer.position === draft.position);
export type LeavingDraft = z.infer<typeof draftSchema>;
const checkpointSchema = z.object({ owner: z.object({ userId: z.string(), revision: z.number().int().nonnegative() }).strict(), id: z.uuid(), draft: draftSchema }).strict();

/** Только уход страницы: синхронный журнал страхует транзакцию IndexedDB, которую браузер может оборвать. */
export class LeavingDraftStore {
  constructor(private namespace = 'greprep-trainings', private storage: () => Storage = () => localStorage) {}
  private prefix() { return `${this.namespace}/leaving-draft/`; }
  private key(owner: TrainingOwner, id: string) { return `${this.prefix()}${encodeURIComponent(owner.userId)}/${owner.revision}/${id}`; }
  put(owner: TrainingOwner, id: string, draft: LeavingDraft): void {
    const checkpoint = checkpointSchema.parse({ owner, id, draft });
    this.storage().setItem(this.key(owner, id), JSON.stringify(checkpoint));
  }
  remove(owner: TrainingOwner, id: string, draft: LeavingDraft): void {
    const storage = this.storage(), key = this.key(owner, id);
    // Завершение ранней записи не стирает более поздний ввод из другой вкладки.
    if (storage.getItem(key) === JSON.stringify({ owner, id, draft })) storage.removeItem(key);
  }
  take(owner: TrainingOwner): { id: string; draft: LeavingDraft }[] {
    const storage = this.storage(), keys: string[] = [], checkpoints: { id: string; draft: LeavingDraft }[] = [];
    for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(this.prefix())) keys.push(key); }
    for (const key of keys) {
      let value: unknown;
      try { value = JSON.parse(storage.getItem(key) ?? 'null'); }
      catch { /* Испорченный журнал удаляется; в экран и отчёт его содержимое не попадает. */ }
      const parsed = checkpointSchema.safeParse(value);
      if (!parsed.success || parsed.data.owner.userId !== owner.userId || parsed.data.owner.revision !== owner.revision || key !== this.key(owner, parsed.data.id)) {
        storage.removeItem(key); continue;
      }
      checkpoints.push({ id: parsed.data.id, draft: parsed.data.draft });
    }
    return checkpoints;
  }
  clear(): void {
    const storage = this.storage(), keys: string[] = [];
    for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(this.prefix())) keys.push(key); }
    for (const key of keys) storage.removeItem(key);
  }
}

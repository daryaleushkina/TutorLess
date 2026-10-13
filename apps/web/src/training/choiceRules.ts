import type { Question } from '@greprep/api-client';

/** Прежние правила вариантов: общий договор и текущие тесты сохраняют поведение. */
export const ChoiceRules = {
  isCorrect(question: Question, optionIds: string[]): boolean {
    return optionIds.length === question.answer.length && new Set(optionIds).size === new Set(question.answer).size &&
      question.answer.every((id) => optionIds.includes(id));
  },
  missingGroups(question: Question, optionIds: string[]): number[] {
    return question.groups.flatMap((group, index) => group.options.filter((option) => optionIds.includes(option.id)).length < question.selectCount ? [index] : []);
  },
  isComplete(question: Question, optionIds: string[]): boolean {
    return this.missingGroups(question, optionIds).length === 0;
  },
  toggle(question: Question, selection: string[], optionId: string): string[] {
    const group = question.groups.find((group) => group.options.some((option) => option.id === optionId));
    if (!group) return selection;
    const inGroup = (id: string) => group.options.some((option) => option.id === id);
    if (question.selectCount === 1) return [...selection.filter((id) => !inGroup(id)), optionId];
    if (selection.includes(optionId)) return selection.filter((id) => id !== optionId);
    const chosen = selection.filter(inGroup);
    const trimmed = chosen.length >= question.selectCount ? selection.filter((id) => id !== chosen[0]) : selection;
    return [...trimmed, optionId];
  },
};

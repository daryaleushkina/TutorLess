import type { QuestionType } from '@greprep/api-client';

// Список растёт только вместе с компонентами и сквозными сценариями: сервер доверяет ему при выдаче контента.
export const SUPPORTED_TYPES: QuestionType[] = ['text_completion', 'sentence_equivalence', 'quantitative_comparison', 'multiple_choice',
  'multiple_choice_multi', 'numeric_entry', 'select_in_passage'];
export const TRAINING_HEADERS = { 'X-Training-Capabilities': [...SUPPORTED_TYPES, 'passage', 'figure'].join(',') };

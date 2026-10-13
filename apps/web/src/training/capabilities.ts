import type { QuestionType } from '@greprep/api-client';

// Рисунки объявим только после подключения их компонента и сценариев (часть 3б-2).
export const SUPPORTED_TYPES: QuestionType[] = ['text_completion', 'sentence_equivalence', 'quantitative_comparison', 'multiple_choice',
  'multiple_choice_multi', 'numeric_entry', 'select_in_passage'];
export const TRAINING_HEADERS = { 'X-Training-Capabilities': [...SUPPORTED_TYPES, 'passage'].join(',') };

import type { Section } from '@greprep/api-client';

/** Названия разделов экзамена остаются английскими и в русском интерфейсе. */
export function sectionLang(section: Section): 'en' | undefined {
  return section !== 'words' && section !== 'essay' ? 'en' : undefined;
}

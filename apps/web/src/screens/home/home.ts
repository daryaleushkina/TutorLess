import type { Exam, Home, Section, TrainingOptions, TrainingRequest } from '@greprep/api-client';
import type { StoredTraining } from '../../training/model';
import { TrainingRules } from '../../training/rules';

export function homeSections(options: TrainingOptions) {
  return options.types.filter((type) => type.topics.some((topic) => topic.available.easy + topic.available.medium + topic.available.hard > 0));
}

/** Последний набор ограничен текущими заданиями; фактический размер важнее прежнего пожелания. */
export function homeStart(options: TrainingOptions, exam: Exam, last: Home['lastTraining']): { request: TrainingRequest; previous: boolean } | undefined {
  const types = homeSections(options);
  const previous = last?.request.exam === exam && last.request.questionTypes.every((type) => types.some((entry) => entry.questionType === type && entry.section === last.request.section));
  const first = types[0];
  if (!first) return undefined;
  const request: TrainingRequest = previous ? { ...last.request, count: last.size } : { exam, section: first.section, questionTypes: [first.questionType], count: 10, mode: 'practice' };
  const count = Math.min(request.count, options.maxQuestions, availableFor(options, request));
  if (count > 0) return { request: { ...request, count }, previous: Boolean(previous) };
  if (previous) return homeStart(options, exam, null);
  return undefined;
}

export function availableFor(options: TrainingOptions, request: TrainingRequest): number {
  return options.types.filter((type) => type.section === request.section && request.questionTypes.includes(type.questionType)).flatMap((type) => type.topics)
    .filter((topic) => !request.topicIds?.length || request.topicIds.includes(topic.id))
    .reduce((sum, topic) => sum + (request.difficulty ? topic.available[request.difficulty] : topic.available.easy + topic.available.medium + topic.available.hard), 0);
}

export function homeActive(history: readonly StoredTraining[], now: number, exam: Exam): StoredTraining | undefined {
  return history.filter((training) => (training.session.exam ?? 'gre') === exam && !training.finish && TrainingRules.remainingSeconds(training, now) !== 0)
    .sort((a, b) => b.startedAtMillis - a.startedAtMillis)[0];
}

export const SECTION_DESCRIPTIONS: Record<Section, { ru: string; en: string }> = {
  verbal: { ru: 'Text Completion · Sentence Equivalence · Reading Comprehension', en: 'Text Completion · Sentence Equivalence · Reading Comprehension' },
  quant: { ru: 'Quantitative Comparison · задачи · графики', en: 'Quantitative Comparison · problems · graphs' },
  essay: { ru: 'Analyze an Issue · 30 минут', en: 'Analyze an Issue · 30 minutes' },
  reading: { ru: 'Complete the Words · Read in Daily Life · Academic Passage', en: 'Complete the Words · Read in Daily Life · Academic Passage' },
  listening: { ru: 'Choose a Response · Conversation · Announcement · Academic Talk', en: 'Choose a Response · Conversation · Announcement · Academic Talk' },
  writing: { ru: 'Build a Sentence · Write an Email · Academic Discussion', en: 'Build a Sentence · Write an Email · Academic Discussion' },
  speaking: { ru: 'Listen and Repeat · Take an Interview', en: 'Listen and Repeat · Take an Interview' },
  words: { ru: 'Слова', en: 'Words' },
};

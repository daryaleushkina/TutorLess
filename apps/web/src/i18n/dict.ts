// Тексты интерфейса на двух языках. Те же строки, что в приложении Apple (apps/apple, Localizable.xcstrings):
// у человека один продукт на всех платформах. Термины GRE (Verbal, Quant) — по-английски и в русском интерфейсе,
// как на экзамене. Кавычки в русском — только «ёлочки».
import type { Section } from '@greprep/api-client';
import type { Locale } from './locale';

type Plural = (n: number) => string;

const ruRules = new Intl.PluralRules('ru');
const enRules = new Intl.PluralRules('en');

/** Русские формы: one — 1, 21; few — 2–4, 22–24; many — 5–20, 25–30; other — дроби. */
function ru(forms: { one: string; few: string; many: string; other: string }): Plural {
  return (n) => {
    const rule = ruRules.select(n);
    const form = rule === 'one' ? forms.one : rule === 'few' ? forms.few : rule === 'many' ? forms.many : forms.other;
    return form.replace('#', String(n));
  };
}

function en(one: string, other: string): Plural {
  return (n) => (enRules.select(n) === 'one' ? one : other).replace('#', String(n));
}

const topicCountRu = ru({ one: '# тема', few: '# темы', many: '# тем', other: '# темы' });
const availableCountRu = ru({ one: '# задание', few: '# задания', many: '# заданий', other: '# задания' });
const questionCountRu = ru({ one: '# вопроса', few: '# вопросов', many: '# вопросов', other: '# вопроса' });
const availableCountEn = en('# question available', '# questions available');
const questionCountEn = en('# question', '# questions');
const topicCountEn = en('# topic', '# topics');

const trainingRu = {
  review_next: 'Следующий',
  report_toast: 'Спасибо — проверим и поправим',
  topics_title: 'Темы', builder_starting: 'Начинаем…', topics_done_count: (selected: number, total: number) => `Готово · ${topicCountRu(selected)} из ${total}`,
  type_number_title: 'Ввод числа', type_fraction_title: 'Ввод дробью', type_multi_title: 'Несколько ответов', sentence_correct_mark: 'верное', sentence_yours_mark: 'ваше', passage_tabs: 'Текст или вопрос', passage_text: 'Текст', passage_question: 'Вопрос', passage_paragraph: (n: number) => `Абзац ${n}`,
  instruction_all: 'Выберите все подходящие варианты.', instruction_count: (n: number) => `Выберите ${n} ответа.`,
  instruction_number: 'Введите ответ числом.', instruction_fraction: 'Введите ответ дробью. Сокращать не нужно.', instruction_sentence: 'Нажмите на предложение в тексте.',
  numeric_answer: 'Ответ', numeric_numerator: 'Числитель', numeric_denominator: 'Знаменатель', numeric_fraction_hint: 'Сверху — числитель, снизу — знаменатель',
  numeric_error: 'Так число не записать: одна запятая или точка, минус — только впереди.', numeric_integer_error: 'Введите целое число: минус — только впереди.', numeric_zero: 'Знаменатель не может быть нулём',
  question_return: 'Вернуться', instruction_two: 'Выберите два слова.', instruction_blanks: 'Выберите по одному слову для каждого пропуска.', instruction_one: 'Выберите один ответ.',
  answer_yours: 'Ваш ответ', answer_correct: 'Верный ответ', all_options: 'Все варианты', hide_options: 'Свернуть варианты',
  explanation_title: 'Разбор', verdict_dont_know: 'Разберём', dont_know_note: 'Задание попадёт в «Повторить мои ошибки»',
  previous_question: 'Предыдущий вопрос', next_question: 'Следующий вопрос', show_explanation: 'Показать разбор',
  previous_notice: (position: number, current: number) => `Это вопрос ${position} — ответ уже засчитан, изменить его нельзя. Вы остановились на вопросе ${current}.`,
  timeout_title: 'Время вышло', timeout_text: (answered: number, total: number) => `Ответы сохранены: ${answered} из ${total}. Остальные засчитаны как без ответа — их разберём вместе со всеми.`,
  to_summary: 'К итогу', continue_check: 'Продолжить', finish_confirm: (count: number) => `Без ответа: ${count}. Завершить?`,
  exit_check: 'Выйти из проверки?', exit_practice: 'Выйти из тренировки?', exit_save: 'Ответы сохранятся, время продолжит идти', exit_action: 'Выйти',
  review_flagged: (count: number) => `Отмеченные · ${count}`, review_no_flagged: 'Отмеченных вопросов нет.',
  review_time: 'Время на вопрос', review_slow: 'дольше среднего',
  types_mixed: 'Все типы вперемешку', topics_clear: 'Снять все', topics_select: 'Выбрать все', topics_empty: 'Выберите хотя бы одну тему',
  topics_available: (count: number, shortened: boolean) => `Подходит ${availableCountRu(count)}${shortened ? ` — тренировка будет из ${questionCountRu(count)}` : ''}`,
  check_hint: (count: string, minutes: number) => `На время, как на экзамене: ${minutes} мин на ${count}, разбор — в конце.`,
  question_offline: 'Нет сети — ответы сохранятся и уйдут сами.',
  question_report: 'Сообщить об ошибке', summary_all_answers: 'Все ответы и разборы',
  review_title_practice: 'Разбор тренировки', review_title_check: 'Разбор проверки',
  review_all: (count: number) => `Все · ${count}`, review_mistakes: (count: number) => `Ошибки · ${count}`,
  review_question: (position: number) => `Вопрос ${position}`, review_correct: 'верно', review_wrong: 'неверно',
  review_unanswered: 'без ответа', review_no_mistakes: 'Ошибок нет.', review_filter: 'Показать',
  report_context: (position: number, type: string) => `Вопрос ${position} · ${type}`,
  report_kind: 'Где ошибка', report_kind_question: 'В задании', report_kind_answer: 'В ответе',
  report_kind_explanation: 'В разборе', report_kind_translation: 'В переводе', report_kind_other: 'Другое',
  report_text: 'Что не так', report_note: 'Проверим вручную и поправим задание.', report_send: 'Отправить',
  report_thanks: 'Спасибо!', report_back: 'Вернуться к вопросу',
  report_saved: 'Сообщение сохранено. Если сети нет, отправим, когда она появится.',
  training_updating_title: 'Обновляем тренировки', training_updating_message: 'Закройте другие вкладки приложения и попробуйте снова.',
  report_draft_unsaved: 'Черновик не сохранён на устройстве', report_draft_saved: 'Черновик сохранён',
  report_session_changed: 'Сессия изменилась. Войдите снова и попробуйте отправить сообщение.',
  report_training_missing: 'Тренировки больше нет на устройстве. Вернитесь и начните новую.',
  report_storage_failed: 'Не получилось сохранить сообщение на устройстве. Попробуйте снова.',
  report_limit: (count: number, max: number) => `${count} / ${max}`,
  report_truncated: (max: number) => `Вставка сокращена до ${max} символов. Проверьте текст перед отправкой.`,
  report_failed: 'Не получилось сохранить сообщение. Освободите место на устройстве и попробуйте снова.',

  explanation_language: 'Язык разбора', question_select_hint: 'выбрать ответ',
  question_check: 'Проверить', question_dont_know: 'Не знаю', question_result: 'К итогу', question_skip: 'Пропустить',
  question_next: (_position: number, _total: number) => 'Дальше',
  question_of: (position: number, total: number) => `${position} из ${total}`,
  question_progress_description: (position: number, total: number) => `Вопрос ${position} из ${total}`,
  question_to_list: 'К списку вопросов', question_flag: 'Отметить, чтобы вернуться', question_unflag: 'Снять отметку', question_overview: 'Вопросы',
  question_missing_blank: (blanks: string) => `Осталось выбрать слово для пропуска ${blanks}`,
  question_missing_blanks: (blanks: string) => `Осталось выбрать слова для пропусков ${blanks}`,
  question_pick_one_more: 'Выберите ещё один ответ', question_check_note: 'Разбор — после последнего вопроса',
  question_blank: 'пропуск', question_correct_mark: 'верный', question_yours_mark: 'ваш ответ', question_others: 'Остальные варианты',
  type_two_blanks: 'два пропуска', type_three_blanks: 'три пропуска', type_two_answers: 'два ответа',
  timer_description: (minutes: number, seconds: number, position: number, total: number) => `Осталось ${minutes} мин ${seconds} с, вопрос ${position} из ${total}`,
  overview_summary: (answered: number, total: number, flagged: number) => `Отвечено ${answered} из ${total} · отмечено ${flagged}`,
  overview_finish: 'Завершить проверку', overview_back: (position: number) => `К вопросу ${position}`,
  overview_answered: 'отвечен', overview_flagged: 'отмечен', overview_empty: 'без ответа', overview_item: (position: number, state: string) => `Вопрос ${position}, ${state}`,
  summary_correct_of: (correct: number, total: number) => `${correct} из ${total} верно`,
  summary_of: (total: number) => `из ${total}`,
  summary_of_limit: (duration: string, limit: number) => `${duration} из ${limit}`,
  summary_timed_out: 'Время вышло — неотвеченные не считаются ошибками темы.', summary_review: 'Что повторить',
  summary_question: (positions: string) => `вопрос ${positions}`, summary_questions: (positions: string) => `вопросы ${positions}`, summary_and: 'и',
  summary_done: 'Готово', summary_repeat: (count: string) => `Повторить · ${count}`, summary_perfect: 'Без ошибок — повторять нечего.',
  summary_ran_out: (count: string) => `Не успели: ${count}.`,
  summary_mistakes: ru({ one: '# ошибка', few: '# ошибки', many: '# ошибок', other: '# ошибки' }),
  verdict_correct: 'Верно.', verdict_wrong: 'Неверно.', verdict_answer: (answer: string) => `Верный ответ — ${answer}.`,
  verdict_answers: (answer: string) => `Верные ответы — ${answer}.`, why_not: (answer: string) => `Почему не ${answer}?`,

  training_new: "Новая тренировка",
  training_own: "Своя тренировка",
  training_continue: "Продолжить тренировку",
  training_continue_subtitle: (section: string, position: number, total: number) => `${section} · вопрос\u00a0${position}\u00a0из\u00a0${total}`,
  training_loading: "Загружаем темы",
  training_storage_title: "Нет места на устройстве",
  training_storage_message: "Не получилось сохранить тренировку на устройстве. Освободите место и попробуйте снова.",
  training_offline_title: "Нет сети",
  training_offline_message: "Чтобы начать тренировку, нужна сеть: задания скачаются целиком, и дальше можно без неё.",
  training_failed_title: "Не получилось загрузить темы",
  training_failed_message: "Мы уже знаем об ошибке. Попробуйте ещё раз чуть позже.",
  training_retry: "Повторить",
  training_missing_title: "Тренировки нет на устройстве",
  training_missing_message: "Она могла устареть. Начните новую с экрана «Тренировка».",
  question_close: "Закрыть тренировку",
  builder_preset_last: "Как в прошлый раз",
  builder_preset_timed: "Проверка на время",
  builder_preset_timed_subtitle: (section: string, count: string, minutes: number) => `${section} · ${count} · ${minutes}\u00a0мин, как секция экзамена`,
  builder_section: "Раздел",
  builder_type: "Тип",
  builder_count: "Вопросов",
  builder_mode: "Режим",
  builder_topics: "Темы и сложность",
  builder_topics_all: "все",
  builder_topics_some: (selected: number, total: number) => `${selected} из ${total}`,
  builder_type_soon: "скоро",
  builder_start: (count: string, minutes: number) => `Начать · ${count} · ~${minutes}\u00a0мин`,
  builder_nothing: "Заданий пока нет",
  builder_no_questions: "Под этот выбор заданий пока нет — попробуйте другие темы или сложность.",
  builder_start_offline: "Нет сети — тренировку не начать. Попробуйте, когда она появится.",
  builder_start_failed: "Не получилось начать тренировку. Попробуйте ещё раз.",
  mode_practice: "Практика",
  mode_check: "Проверка",
  mode_practice_hint: "Разбор сразу после каждого ответа, без таймера.",
  mode_check_hint: "Таймер как на экзамене, разбор в конце",
  difficulty_any: "Любая",
  difficulty_easy: "Лёгкая",
  difficulty_medium: "Средняя",
  difficulty_hard: "Трудная",
  topics_difficulty: "Сложность",
  topics_done: (count: string) => `Готово · ${count}`,
};
const trainingEn = {
  review_next: 'Next',
  report_toast: 'Thank you — we’ll check and fix it',
  topics_title: 'Topics', builder_starting: 'Starting…', topics_done_count: (selected: number, total: number) => `Done · ${selected} of ${topicCountEn(total)}`,
  type_number_title: 'Numeric Entry', type_fraction_title: 'Fraction Entry', type_multi_title: 'Multiple Answer', sentence_correct_mark: 'correct', sentence_yours_mark: 'yours', passage_tabs: 'Passage or question', passage_text: 'Passage', passage_question: 'Question', passage_paragraph: (n: number) => `Paragraph ${n}`,
  instruction_all: 'Select all that apply.', instruction_count: (n: number) => `Choose ${n} answers.`,
  instruction_number: 'Enter a numeric answer.', instruction_fraction: 'Enter a fraction. You do not need to simplify it.', instruction_sentence: 'Select a sentence in the passage.',
  numeric_answer: 'Answer', numeric_numerator: 'Numerator', numeric_denominator: 'Denominator', numeric_fraction_hint: 'Numerator above, denominator below',
  numeric_error: 'Use one comma or decimal point, and a minus sign only at the beginning.', numeric_integer_error: 'Enter a whole number, with a minus sign only at the beginning.', numeric_zero: 'The denominator cannot be zero',
  question_return: 'Return', instruction_two: 'Choose two words.', instruction_blanks: 'Choose one word for each blank.', instruction_one: 'Choose one answer.',
  answer_yours: 'Your answer', answer_correct: 'Correct answer', all_options: 'All options', hide_options: 'Hide options',
  explanation_title: 'Explanation', verdict_dont_know: 'Let’s work through it', dont_know_note: 'Added to “Repeat my mistakes”',
  previous_question: 'Previous question', next_question: 'Next question', show_explanation: 'Show explanation',
  previous_notice: (position: number, current: number) => `This is question ${position}. Your answer has been recorded and cannot be changed. You stopped at question ${current}.`,
  timeout_title: 'Time is up', timeout_text: (answered: number, total: number) => `${answered} of ${total} answers saved. The rest count as unanswered; you can review them all.`,
  to_summary: 'View results', continue_check: 'Continue', finish_confirm: (count: number) => `${count} unanswered. Finish?`,
  exit_check: 'Leave the check?', exit_practice: 'Leave the practice?', exit_save: 'Your answers will be saved and the timer will keep running', exit_action: 'Leave',
  review_flagged: (count: number) => `Flagged · ${count}`, review_no_flagged: 'No flagged questions.',
  review_time: 'Time per question', review_slow: 'longer than average',
  types_mixed: 'All types mixed', topics_clear: 'Clear all', topics_select: 'Select all', topics_empty: 'Choose at least one topic',
  topics_available: (count: number, shortened: boolean) => `${availableCountEn(count)}${shortened ? ` — your practice will have ${questionCountEn(count)}` : ''}`,
  check_hint: (count: string, minutes: number) => `Exam pace: ${minutes} minutes for ${count}, explanations at the end.`,
  question_offline: 'No connection — answers will be saved and sent automatically.',
  question_report: 'Report a mistake', summary_all_answers: 'All answers and explanations',
  review_title_practice: 'Practice review', review_title_check: 'Check review',
  review_all: (count: number) => `All · ${count}`, review_mistakes: (count: number) => `Mistakes · ${count}`,
  review_question: (position: number) => `Question ${position}`, review_correct: 'correct', review_wrong: 'wrong',
  review_unanswered: 'not answered', review_no_mistakes: 'No mistakes.', review_filter: 'Show',
  report_context: (position: number, type: string) => `Question ${position} · ${type}`,
  report_kind: 'Where is the mistake', report_kind_question: 'In the question', report_kind_answer: 'In the answer',
  report_kind_explanation: 'In the explanation', report_kind_translation: 'In the translation', report_kind_other: 'Other',
  report_text: 'What’s wrong', report_note: 'We’ll check it by hand and fix the question.', report_send: 'Send',
  report_thanks: 'Thank you!', report_back: 'Back to the question',
  report_saved: 'Your message is saved. If you’re offline, we’ll send it when you reconnect.',
  training_updating_title: 'Updating practices', training_updating_message: 'Close the other app tabs and try again.',
  report_draft_unsaved: 'Draft not saved on this device', report_draft_saved: 'Draft saved',
  report_session_changed: 'Your session changed. Sign in again and try sending your message.',
  report_training_missing: 'This training is no longer on your device. Go back and start a new one.',
  report_storage_failed: 'Couldn’t save your message on this device. Try again.',
  report_limit: (count: number, max: number) => `${count} / ${max}`,
  report_truncated: (max: number) => `The paste was shortened to ${max} characters. Check the text before sending.`,
  report_failed: 'Couldn’t save your message. Free up some space on your device and try again.',

  explanation_language: 'Explanation language', question_select_hint: 'choose an answer',
  question_check: 'Check answer', question_dont_know: 'I don’t know', question_result: 'Summary', question_skip: 'Skip',
  question_next: (_position: number, _total: number) => 'Next',
  question_of: (position: number, total: number) => `${position} of ${total}`,
  question_progress_description: (position: number, total: number) => `Question ${position} of ${total}`,
  question_to_list: 'To the question list', question_flag: 'Flag to return', question_unflag: 'Remove flag', question_overview: 'All questions',
  question_missing_blank: (blanks: string) => `Pick a word for blank ${blanks}`,
  question_missing_blanks: (blanks: string) => `Pick words for blanks ${blanks}`,
  question_pick_one_more: 'Pick one more answer', question_check_note: 'Explanations after the last question',
  question_blank: 'blank', question_correct_mark: 'correct', question_yours_mark: 'your answer', question_others: 'Other options',
  type_two_blanks: 'two blanks', type_three_blanks: 'three blanks', type_two_answers: 'two answers',
  timer_description: (minutes: number, seconds: number, position: number, total: number) => `${minutes} min ${seconds} s left, question ${position} of ${total}`,
  overview_summary: (answered: number, total: number, flagged: number) => `Answered ${answered} of ${total} · flagged ${flagged}`,
  overview_finish: 'Finish', overview_back: (position: number) => `To question ${position}`,
  overview_answered: 'answered', overview_flagged: 'flagged', overview_empty: 'unanswered', overview_item: (position: number, state: string) => `Question ${position}, ${state}`,
  summary_correct_of: (correct: number, total: number) => `${correct} of ${total} correct`,
  summary_of: (total: number) => `of ${total}`,
  summary_of_limit: (duration: string, limit: number) => `${duration} of ${limit}`,
  summary_timed_out: 'Time is up — unanswered questions don’t count as topic mistakes.', summary_review: 'What to review',
  summary_question: (positions: string) => `question ${positions}`, summary_questions: (positions: string) => `questions ${positions}`, summary_and: 'and',
  summary_done: 'Done', summary_repeat: (count: string) => `Repeat · ${count}`, summary_perfect: 'No mistakes — nothing to repeat.',
  summary_ran_out: (count: string) => `Ran out of time: ${count}.`, summary_mistakes: en('# mistake', '# mistakes'),
  verdict_correct: 'Correct.', verdict_wrong: 'Incorrect.', verdict_answer: (answer: string) => `The answer is ${answer}.`,
  verdict_answers: (answer: string) => `The answers are ${answer}.`, why_not: (answer: string) => `Why not ${answer}?`,

  training_new: "New practice",
  training_own: "Custom practice",
  training_continue: "Continue practice",
  training_continue_subtitle: (section: string, position: number, total: number) => `${section} · question\u00a0${position}\u00a0of\u00a0${total}`,
  training_loading: "Loading topics",
  training_storage_title: "No space on the device",
  training_storage_message: "Couldn’t save the practice on your device. Free up some space and try again.",
  training_offline_title: "No connection",
  training_offline_message: "Starting a practice needs a connection: the questions download in full, and after that you can go offline.",
  training_failed_title: "Couldn’t load topics",
  training_failed_message: "We already know about it. Please try again a little later.",
  training_retry: "Try again",
  training_missing_title: "This practice isn’t on the device",
  training_missing_message: "It may have expired. Start a new one from Practice.",
  question_close: "Close practice",
  builder_preset_last: "Same as last time",
  builder_preset_timed: "Timed check",
  builder_preset_timed_subtitle: (section: string, count: string, minutes: number) => `${section} · ${count} · ${minutes}\u00a0min, like an exam section`,
  builder_section: "Section",
  builder_type: "Type",
  builder_count: "Questions",
  builder_mode: "Mode",
  builder_topics: "Topics and difficulty",
  builder_topics_all: "all",
  builder_topics_some: (selected: number, total: number) => `${selected} of ${total}`,
  builder_type_soon: "soon",
  builder_start: (count: string, minutes: number) => `Start · ${count} · ~${minutes}\u00a0min`,
  builder_nothing: "No questions yet",
  builder_no_questions: "No questions match this yet — try other topics or difficulty.",
  builder_start_offline: "No connection — the practice can’t start. Try again once you’re online.",
  builder_start_failed: "Couldn’t start the practice. Please try again.",
  mode_practice: "Practice",
  mode_check: "Check",
  mode_practice_hint: "Explanation after each question, no timer",
  mode_check_hint: "Exam-pace timer, explanations at the end",
  difficulty_any: "Any",
  difficulty_easy: "Easy",
  difficulty_medium: "Medium",
  difficulty_hard: "Hard",
  topics_difficulty: "Difficulty",
  topics_done: (count: string) => `Done · ${count}`,
};
type TrainingDict = typeof trainingRu & { questionsCount: Plural };

export interface Dict {
  training: TrainingDict;
  back: string;
  tabs: { train: string; words: string; exam: string; progress: string; settings: string; sections: string };
  sections: Record<Section, string>;
  navigation: { exam: string; chooseExam: string; examSwitch: (name: string) => string; profile: string };
  home: {
    loading: string; first: string; firstNote: string; chooseSection: string; configure: string; empty: string;
    start: string; starting: string; minutes: Plural; duration: (n: number) => string; approxShort: (n: number) => string;
    offlineTitle: string; offlineText: string; failedTitle: string; failedText: string; retry: string;
    staleOffline: string; staleFailed: string; needNetwork: string; mistakes: string; mistakeCount: Plural; weakSpot: string; correct: string; week: string; days: Plural; answers: Plural; toeflEmpty: string;
  };
  placeholder: { words: string; exam: string; toefl: string };
  progress: { emptyTitle: string; emptyText: string; first: string };
  settings: { signOut: string; signOutFailed: string; signOutOffline: string; version: (v: string) => string; language: string; theme: string; textSize: string; light: string; dark: string; normal: string; large: string; subscription: string; identities: string; contact: string; saveFailed: string; localeFailed: string; telegram: string };
  exams: { title: string; lead: string; gre: string; toefl: string; chooseFailed: string; changeFailed: string; offline: string; note: string };
  signIn: {
    tagline: string; title: string;
    apple: string;
    google: string;
    legal: string;
    notConnected: Record<'apple' | 'google', string>;
    offline: string;
    tooMany: string;
    failed: string;
    /** Заголовок экрана, когда войти не вышло совсем (мини-апп): коротко, совет — строкой ниже. */
    failedTitle: string;
    cancelled: string;
    expired: string;
    devTitle: string;
    devName: string;
    devSubmit: string;
    signingIn: string;
  };
  crash: { title: string; text: string; reload: string };
  telegramFailed: { title: string; text: string };
}

const dictRu: Dict = {
  training: { ...trainingRu, questionsCount: ru({ one: "#\u00a0вопрос", few: "#\u00a0вопроса", many: "#\u00a0вопросов", other: "#\u00a0вопроса" }) },
  back: 'Назад',
  tabs: { train: 'Тренировка', words: 'Слова', exam: 'Экзамен', progress: 'Прогресс', settings: 'Профиль', sections: 'Разделы' },
  sections: { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking', verbal: 'Verbal', quant: 'Quant', words: 'Слова', essay: 'Эссе' },
  navigation: { exam: 'Экзамен', chooseExam: 'Выбрать экзамен', examSwitch: (name) => `Экзамен: ${name}, сменить`, profile: 'Профиль' },
  home: {
    loading: 'Загружаем тренировку', first: 'Первая тренировка',
    firstNote: 'После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.',
    chooseSection: 'Разделы', configure: 'Настроить тренировку', empty: 'Пока нет доступных заданий',
    start: 'Начать', starting: 'Начинаем…',
    minutes: ru({ one: '# минута', few: '# минуты', many: '# минут', other: '# минуты' }),
    duration: (n) => n < 60 ? `${n} мин` : `${Math.floor(n / 60)} ч ${n % 60} мин`,
    approxShort: (n) => `~${n}\u00a0мин`,
    offlineTitle: 'Нет сети', offlineText: 'Тренировка загрузится, когда сеть вернётся.',
    failedTitle: 'Не получилось загрузить тренировку', failedText: 'Мы уже знаем об ошибке. Попробуйте ещё раз чуть позже.',
    retry: 'Попробовать снова', staleOffline: 'Нет сети — обновим, когда она появится.',
    staleFailed: 'Не получилось обновить — покажем свежее, как только сервер ответит.',
    needNetwork: 'Чтобы начать, нужна сеть: задания скачаются целиком, и дальше можно без неё.',
    mistakes: 'Повторить мои ошибки', mistakeCount: ru({ one: '# задание из прошлых тренировок', few: '# задания из прошлых тренировок', many: '# заданий из прошлых тренировок', other: '# задания из прошлых тренировок' }),
    weakSpot: 'Слабое место', correct: 'верно', week: 'Эта неделя', days: ru({ one: '# день', few: '# дня', many: '# дней', other: '# дня' }), answers: ru({ one: '# задание', few: '# задания', many: '# заданий', other: '# задания' }), toeflEmpty: 'Здесь будут тренировки по четырём частям TOEFL.',
  },
  placeholder: {
    words: 'Здесь будут слова: учить, повторять и искать.',
    exam: 'Здесь будут пробные экзамены GRE и эссе с оценкой.', toefl: 'Здесь будут пробные экзамены TOEFL с оценкой Writing и Speaking.',
  },
  progress: {
    emptyTitle: 'Здесь появится ваш прогресс',
    emptyText: 'Здесь будет точность по разделам, история тренировок и примерный балл.',
    first: 'Первая тренировка',
  },
  settings: {
    signOut: 'Выйти',
    signOutFailed: 'Не получилось выйти. Попробуйте ещё раз.',
    signOutOffline: 'Нет сети — выйти получится, когда она появится.',
    version: (v) => `Версия ${v}`, language: 'Язык', theme: 'Тема', textSize: 'Размер текста', light: 'Светлая', dark: 'Тёмная', normal: 'Обычный', large: 'Крупнее', subscription: 'Подписка', identities: 'Способы входа', contact: 'Написать нам', saveFailed: 'Не получилось сохранить настройку на устройстве. Попробуйте ещё раз.', localeFailed: 'Не получилось сохранить язык. Попробуйте ещё раз.', telegram: 'Вход через Telegram',
  },
  exams: { title: 'К какому экзамену готовитесь?', lead: 'От него зависят задания, слова и пробный экзамен. Сменить можно в любой момент.', gre: 'Магистратура и PhD', toefl: 'Английский для учёбы', chooseFailed: 'Не получилось сохранить выбор. Попробуйте ещё раз.', changeFailed: 'Не получилось сменить экзамен. Попробуйте ещё раз.', offline: 'Нет сети — выбрать экзамен получится, когда она вернётся.', note: 'У каждого экзамена свой прогресс, при смене он не теряется.' },
  signIn: {
    title: 'GRE® и TOEFL® без репетитора',
    tagline: 'Вопросы как на настоящем экзамене и разбор каждой ошибки на вашем языке.',
    apple: 'Вход с Apple',
    google: 'Войти с аккаунтом Google',
    legal: 'Продолжая, вы принимаете условия и политику конфиденциальности.',
    notConnected: {
      apple: 'Вход с Apple ещё не подключён — он появится до беты.',
      google: 'Вход через Google ещё не подключён — он появится до беты.',
    },
    offline: 'Нет сети — войти получится, когда она появится.',
    tooMany: 'Слишком много попыток подряд — подождите минуту.',
    failed: 'Не получилось войти. Попробуйте ещё раз.',
    failedTitle: 'Не получилось войти',
    cancelled: 'Вход отменён — можно попробовать снова.',
    expired: 'Вход закончился — войдите снова.',
    devTitle: 'Для разработки — вход подменой',
    devName: 'Имя тестового пользователя',
    devSubmit: 'Войти',
    signingIn: 'Входим…',
  },
  crash: {
    title: 'Что-то пошло не так',
    text: 'Мы уже знаем об ошибке. Обновите страницу — всё сохранено.',
    reload: 'Обновить',
  },
  telegramFailed: {
    title: 'Не получилось открыть в Telegram',
    text: 'Обновите Telegram и откройте приложение снова — мы уже знаем об ошибке.',
  },
};

const dictEn: Dict = {
  training: { ...trainingEn, questionsCount: en("#\u00a0question", "#\u00a0questions") },
  back: 'Back',
  tabs: { train: 'Practice', words: 'Words', exam: 'Exam', progress: 'Progress', settings: 'Profile', sections: 'Sections' },
  sections: { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking', verbal: 'Verbal', quant: 'Quant', words: 'Words', essay: 'Essay' },
  navigation: { exam: 'Exam', chooseExam: 'Choose an exam', examSwitch: (name) => `Exam: ${name}, change`, profile: 'Profile' },
  home: {
    loading: 'Loading practice', first: 'First practice',
    firstNote: 'After each answer, get an explanation in your language: why it’s correct and where the other options mislead.',
    chooseSection: 'Sections', configure: 'Customize practice', empty: 'No questions available yet',
    start: 'Start', starting: 'Starting…',
    minutes: en('# minute', '# minutes'), duration: (n) => n < 60 ? `${n} min` : `${Math.floor(n / 60)} hr ${n % 60} min`, approxShort: (n) => `~${n}\u00a0min`,
    offlineTitle: 'No connection', offlineText: 'Practice will load once you’re back online.',
    failedTitle: 'Couldn’t load practice', failedText: 'We already know about the error. Please try again a bit later.',
    retry: 'Try again', staleOffline: 'No connection — practice will update by itself once it’s back.',
    staleFailed: 'Couldn’t update practice — we’ll show fresh data as soon as the server responds.',
    needNetwork: 'You need a connection to download the questions. After that, you can practice offline.',
    mistakes: 'Review my mistakes', mistakeCount: en('# question from previous practice', '# questions from previous practice'), weakSpot: 'Weak spot', correct: 'correct', week: 'This week', days: en('# day', '# days'), answers: en('# question', '# questions'), toeflEmpty: 'Practice the four TOEFL sections here.',
  },
  placeholder: {
    words: 'Learn, review and look up words here.',
    exam: 'GRE practice tests and scored essays will be here.', toefl: 'TOEFL practice tests and Writing and Speaking feedback will be here.',
  },
  progress: {
    emptyTitle: 'Your progress will appear here',
    emptyText: 'See what you do well and what needs more practice here.',
    first: 'First practice',
  },
  settings: {
    signOut: 'Sign out',
    signOutFailed: 'Couldn’t sign out. Please try again.',
    signOutOffline: 'No connection — you can sign out once it’s back.',
    version: (v) => `Version ${v}`, language: 'Language', theme: 'Theme', textSize: 'Text size', light: 'Light', dark: 'Dark', normal: 'Normal', large: 'Larger', subscription: 'Subscription', identities: 'Sign-in methods', contact: 'Contact us', saveFailed: 'Couldn’t save this setting on your device. Please try again.', localeFailed: 'Couldn’t save your language. Please try again.', telegram: 'Signed in with Telegram',
  },
  exams: { title: 'Which exam are you preparing for?', lead: 'Your questions, words and practice tests depend on it. You can change it anytime.', gre: 'Graduate school and PhD', toefl: 'English for study', chooseFailed: 'Couldn’t save your choice. Please try again.', changeFailed: 'Couldn’t change the exam. Please try again.', offline: 'You need a connection to choose an exam.', note: 'Each exam keeps its own progress when you switch.' },
  signIn: {
    title: 'GRE® and TOEFL® without a tutor',
    tagline: 'Exam-style questions with explanations for every mistake in your language.',
    apple: 'Sign in with Apple',
    google: 'Sign in with Google',
    legal: 'By continuing, you accept the terms and the privacy policy.',
    notConnected: {
      apple: 'Sign in with Apple isn’t connected yet — it will be before the beta.',
      google: 'Sign-in with Google isn’t connected yet — it will be before the beta.',
    },
    offline: 'No connection — you can sign in once it’s back.',
    tooMany: 'Too many attempts in a row — please wait a minute.',
    failed: 'Couldn’t sign in. Please try again.',
    failedTitle: 'Couldn’t sign in',
    cancelled: 'Sign-in was cancelled — you can try again.',
    expired: 'You were signed out — please sign in again.',
    devTitle: 'Development only — fake sign-in',
    devName: 'Test user name',
    devSubmit: 'Sign in',
    signingIn: 'Signing in…',
  },
  crash: {
    title: 'Something went wrong',
    text: 'We already know about the error. Reload the page — everything is saved.',
    reload: 'Reload',
  },
  telegramFailed: {
    title: 'Couldn’t open in Telegram',
    text: 'Update Telegram and open the app again — we already know about the error.',
  },
};

export const dictionaries: Readonly<Record<Locale, Dict>> = { ru: dictRu, en: dictEn };

/** Дисклеймер ETS — всегда по-английски (PRODUCT.md, «Brand Commitments»). */
export const GRE_DISCLAIMER =
  'GRE® and TOEFL® are registered trademarks of Educational Testing Service (ETS). This product is not endorsed or approved by ETS.';

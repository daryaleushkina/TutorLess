-- Новые типы и общие материалы. Все новые столбцы nullable: прежний сервер продолжает писать старые задания.
-- +goose Up
CREATE TABLE question_passages (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),
  body jsonb NOT NULL
);
CREATE TABLE question_figures (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),
  body jsonb NOT NULL
);
ALTER TABLE questions DROP CONSTRAINT questions_question_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_question_type_check CHECK (question_type IN (
  'text_completion', 'sentence_equivalence', 'quantitative_comparison', 'multiple_choice',
  'multiple_choice_multi', 'numeric_entry', 'select_in_passage'
));
ALTER TABLE questions DROP CONSTRAINT questions_answer_check;
ALTER TABLE questions ADD CONSTRAINT questions_answer_check CHECK (cardinality(answer) BETWEEN 0 AND 10);
ALTER TABLE questions ADD COLUMN numeric_answer jsonb;
ALTER TABLE questions ADD COLUMN passage_id text REFERENCES question_passages(id);
ALTER TABLE questions ADD COLUMN figure_id text REFERENCES question_figures(id);
ALTER TABLE trainings DROP CONSTRAINT trainings_question_types_check;
ALTER TABLE trainings ADD CONSTRAINT trainings_question_types_check CHECK (cardinality(question_types) BETWEEN 1 AND 7);
ALTER TABLE training_items DROP CONSTRAINT training_items_option_ids_check;
ALTER TABLE training_items ADD CONSTRAINT training_items_option_ids_check CHECK (cardinality(option_ids) <= 10);
ALTER TABLE training_items ADD COLUMN numeric_answer jsonb;
ALTER TABLE training_items ADD COLUMN sentence_id text;

-- +goose Down
-- Откат после появления нового контента требует сначала убрать его ссылки; данные молча не удаляются.
-- Ограничения прежних типов этого не гарантируют: задание multiple_choice может ссылаться на текст или рисунок.
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM questions WHERE passage_id IS NOT NULL OR figure_id IS NOT NULL OR numeric_answer IS NOT NULL)
     OR EXISTS (SELECT 1 FROM training_items WHERE numeric_answer IS NOT NULL OR sentence_id IS NOT NULL) THEN
    RAISE EXCEPTION 'question types rollback: questions or answers still use passages, figures or new answers; remove them first';
  END IF;
END $$;
-- +goose StatementEnd
ALTER TABLE training_items DROP COLUMN sentence_id;
ALTER TABLE training_items DROP COLUMN numeric_answer;
ALTER TABLE training_items DROP CONSTRAINT training_items_option_ids_check;
ALTER TABLE training_items ADD CONSTRAINT training_items_option_ids_check CHECK (cardinality(option_ids) <= 3);
ALTER TABLE trainings DROP CONSTRAINT trainings_question_types_check;
ALTER TABLE trainings ADD CONSTRAINT trainings_question_types_check CHECK (cardinality(question_types) BETWEEN 1 AND 4);
ALTER TABLE questions DROP COLUMN figure_id;
ALTER TABLE questions DROP COLUMN passage_id;
ALTER TABLE questions DROP COLUMN numeric_answer;
ALTER TABLE questions DROP CONSTRAINT questions_answer_check;
ALTER TABLE questions ADD CONSTRAINT questions_answer_check CHECK (cardinality(answer) BETWEEN 1 AND 3);
ALTER TABLE questions DROP CONSTRAINT questions_question_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_question_type_check CHECK (question_type IN (
  'text_completion', 'sentence_equivalence', 'quantitative_comparison', 'multiple_choice'
));
DROP TABLE question_figures;
DROP TABLE question_passages;

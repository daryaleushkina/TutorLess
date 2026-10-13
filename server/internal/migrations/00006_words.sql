-- Словарь независим от тренировок: один экзамен может иметь собственный список.
-- Новая таблица совместима со старым сервером; применять до выкладки.

-- +goose Up
CREATE TABLE words (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id text NOT NULL REFERENCES exams(id),
    lemma text NOT NULL CHECK (lemma = btrim(lemma) AND length(lemma) BETWEEN 1 AND 128),
    rank integer NOT NULL CHECK (rank > 0),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
    part_of_speech text,
    ipa text,
    audio_key text,
    senses jsonb NOT NULL DEFAULT '[]',
    synonyms text[] NOT NULL DEFAULT '{}',
    antonyms text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX words_exam_lemma_idx ON words (exam_id, lower(lemma));
CREATE INDEX words_approved_rank_idx ON words (exam_id, rank, id) WHERE status = 'approved';

-- +goose Down
DROP TABLE words;

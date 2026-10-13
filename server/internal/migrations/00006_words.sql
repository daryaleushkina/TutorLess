-- Словарь независим от тренировок: один экзамен может иметь собственный список.
-- Новая таблица совместима со старым сервером; применять до выкладки.

-- +goose Up
-- CHECK не допускает подзапросы; единая функция проверяет обе плоские коллекции под договор.
-- +goose StatementBegin
CREATE FUNCTION word_relations_valid(items text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT cardinality(items) <= 100
        AND (cardinality(items) = 0 OR array_ndims(items) = 1)
        AND NOT EXISTS (
            SELECT 1 FROM unnest(items) AS item
            WHERE item IS NULL OR char_length(item) NOT BETWEEN 1 AND 128
        );
$$;
-- +goose StatementEnd

CREATE TABLE words (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id text NOT NULL REFERENCES exams(id),
    lemma text NOT NULL CHECK (lemma = btrim(lemma) AND length(lemma) BETWEEN 1 AND 128),
    rank integer NOT NULL CHECK (rank > 0),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
    part_of_speech text CHECK (char_length(part_of_speech) BETWEEN 1 AND 128),
    ipa text CHECK (char_length(ipa) BETWEEN 1 AND 256),
    audio_key text CHECK (char_length(audio_key) BETWEEN 1 AND 512),
    senses jsonb NOT NULL DEFAULT '[]',
    synonyms text[] NOT NULL DEFAULT '{}' CHECK (word_relations_valid(synonyms)),
    antonyms text[] NOT NULL DEFAULT '{}' CHECK (word_relations_valid(antonyms)),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX words_exam_lemma_idx ON words (exam_id, lower(lemma));
CREATE INDEX words_approved_rank_idx ON words (exam_id, rank, id) WHERE status = 'approved';

-- +goose Down
DROP TABLE words;
DROP FUNCTION word_relations_valid(text[]);

-- name: ListWords :many
SELECT id, lemma, part_of_speech, rank FROM words
WHERE exam_id = sqlc.arg(exam_id) AND status = 'approved'
  AND starts_with(lower(lemma), sqlc.arg(prefix)::text)
  AND (rank, id) > (sqlc.arg(after_rank)::integer, sqlc.arg(after_id)::uuid)
ORDER BY rank, id LIMIT sqlc.arg(page_size)::integer;

-- name: GetWord :one
SELECT * FROM words WHERE id = sqlc.arg(id) AND exam_id = sqlc.arg(exam_id) AND status = 'approved';

-- name: ImportWord :execrows
INSERT INTO words (exam_id, lemma, rank, status)
VALUES (sqlc.arg(exam_id), sqlc.arg(lemma), sqlc.arg(rank), sqlc.arg(status))
ON CONFLICT (exam_id, lower(lemma)) DO UPDATE
SET rank = EXCLUDED.rank,
    status = CASE WHEN words.status = 'draft' THEN EXCLUDED.status ELSE words.status END,
    updated_at = now()
WHERE words.rank <> EXCLUDED.rank OR (words.status = 'draft' AND EXCLUDED.status = 'approved');

-- name: WordExamExists :one
SELECT EXISTS (SELECT 1 FROM exams WHERE id = $1);

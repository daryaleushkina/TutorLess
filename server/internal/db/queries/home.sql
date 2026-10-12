-- Последняя начатая сессия и её фактический размер, в том числе до первого ответа.
-- name: GetHomeLastTraining :one
SELECT (tr.request || jsonb_build_object('exam', tr.exam_id))::jsonb AS request,
       (SELECT count(*)::integer FROM training_items i WHERE i.training_id = tr.id) AS size
FROM trainings tr
WHERE tr.user_id = $1 AND tr.exam_id = $2
ORDER BY tr.started_at DESC, tr.id DESC LIMIT 1;

-- Нули остаются в ответе: справочник разделов не зависит от истории человека.
-- name: GetHomeSections :many
SELECT s.section, count(i.answered_at)::integer AS total,
       count(*) FILTER (WHERE i.answered_at IS NOT NULL AND i.correct)::integer AS correct
FROM exam_sections s
LEFT JOIN trainings tr ON tr.user_id = sqlc.arg(user_id) AND tr.exam_id = s.exam_id AND tr.section = s.section
LEFT JOIN training_items i ON i.training_id = tr.id
WHERE s.exam_id = sqlc.arg(exam_id)
GROUP BY s.section, s.position ORDER BY s.position;

-- name: CountHomeMistakes :one
SELECT count(*)::integer AS mistakes FROM (
  SELECT DISTINCT ON (i.question_id) i.correct
  FROM trainings tr JOIN training_items i ON i.training_id = tr.id
  JOIN questions q ON q.id = i.question_id AND q.status = 'approved'
  WHERE tr.user_id = sqlc.arg(user_id) AND tr.exam_id = sqlc.arg(exam_id) AND i.answered_at IS NOT NULL
  ORDER BY i.question_id, i.answered_at DESC, tr.started_at DESC, tr.id DESC
) latest WHERE NOT correct;

-- name: GetHomeWeakSpot :one
SELECT q.question_type, tr.section,
       (100.0 * count(*) FILTER (WHERE i.correct) / count(*))::double precision AS accuracy
FROM trainings tr
JOIN training_items i ON i.training_id = tr.id
JOIN questions q ON q.id = i.question_id
WHERE tr.user_id = sqlc.arg(user_id) AND tr.exam_id = sqlc.arg(exam_id)
  AND i.answered_at >= sqlc.arg(since)::timestamptz AND i.answered_at <= sqlc.arg(until)::timestamptz
GROUP BY q.question_type, tr.section
HAVING count(*) >= 10 AND count(*) FILTER (WHERE i.correct) * 10 < count(*) * 7
ORDER BY accuracy, q.question_type LIMIT 1;

-- Предыдущий ответ и израсходованный лимит читаются до фильтра недели: иначе понедельник обнуляет сессию.
-- name: GetHomeWeek :one
WITH intervals AS (
  SELECT tr.id, tr.started_at, tr.time_limit_seconds, i.position, i.answered_at,
         lag(i.answered_at) OVER (PARTITION BY tr.id ORDER BY i.answered_at, i.position) AS previous_answer
  FROM trainings tr JOIN training_items i ON i.training_id = tr.id
  WHERE tr.user_id = sqlc.arg(user_id) AND tr.exam_id = sqlc.arg(exam_id)
    AND i.answered_at < sqlc.arg(week_end)::timestamptz
    AND EXISTS (
      SELECT 1 FROM training_items recent WHERE recent.training_id = tr.id
        AND recent.answered_at >= sqlc.arg(week_start)::timestamptz
        AND recent.answered_at < sqlc.arg(week_end)::timestamptz
    )
), activity AS (
  SELECT *, greatest(0, least(sqlc.arg(max_gap_seconds)::integer,
      extract(epoch FROM answered_at - coalesce(previous_answer, started_at)))) AS active_seconds,
    CASE WHEN previous_answer IS NULL AND started_at < sqlc.arg(week_start)::timestamptz THEN 0
      ELSE greatest(0, least(sqlc.arg(max_gap_seconds)::integer,
        extract(epoch FROM answered_at - greatest(coalesce(previous_answer, started_at), sqlc.arg(week_start)::timestamptz))))
    END AS week_seconds
  FROM intervals
), consumption AS (
  SELECT *, coalesce(sum(active_seconds) OVER (
    PARTITION BY id ORDER BY answered_at, position ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ), 0) AS spent_before
  FROM activity
)
-- active_seconds - week_seconds — расход текущего интервала до недели; он тоже уменьшает остаток лимита.
SELECT count(DISTINCT width_bucket(answered_at, sqlc.arg(day_starts)::timestamptz[]))::integer AS days,
       count(*)::integer AS answers,
       floor(coalesce(sum(greatest(0, least(week_seconds,
         coalesce(time_limit_seconds - spent_before - (active_seconds - week_seconds), week_seconds)
       ))), 0) / 60)::integer AS minutes
FROM consumption
WHERE answered_at >= sqlc.arg(week_start)::timestamptz;

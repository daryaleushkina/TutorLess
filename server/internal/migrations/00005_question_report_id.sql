-- Ключ от устройства позволяет повторять доставку жалобы после потери ответа.
-- NULL сохраняет прежние INSERT старого кода и не ограничивает жалобы без ключа.

-- +goose Up
ALTER TABLE question_reports ADD COLUMN report_id uuid;
CREATE UNIQUE INDEX question_reports_user_report_id_idx ON question_reports (user_id, report_id);

-- +goose Down
DROP INDEX question_reports_user_report_id_idx;
ALTER TABLE question_reports DROP COLUMN report_id;

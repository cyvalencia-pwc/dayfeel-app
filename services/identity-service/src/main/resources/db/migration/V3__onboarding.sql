ALTER TABLE users ADD COLUMN onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX ix_reports_circle_created ON reports(circle_id, created_at, id);

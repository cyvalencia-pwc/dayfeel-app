CREATE TABLE processed_events (
 id CHAR(36) PRIMARY KEY,
 processed_at DATETIME(6) NOT NULL
);
CREATE INDEX idx_outbox_pending ON outbox_events(published, occurred_at);

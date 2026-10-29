CREATE TABLE roles (name VARCHAR(32) PRIMARY KEY);
INSERT INTO roles(name) VALUES ('USER'),('MODERATOR'),('ADMIN');
CREATE TABLE users (
 id CHAR(36) PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(100) NOT NULL,
 alias VARCHAR(80) NOT NULL UNIQUE, status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
 avatar_key VARCHAR(512), failed_logins INT NOT NULL DEFAULT 0, locked_until DATETIME(6),
 token_version BIGINT NOT NULL DEFAULT 0, created_at DATETIME(6) NOT NULL,
 ai_analysis BOOLEAN NOT NULL DEFAULT FALSE, companion_memory BOOLEAN NOT NULL DEFAULT FALSE,
 analytics BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE user_roles (
 user_id CHAR(36) NOT NULL, role_name VARCHAR(32) NOT NULL, PRIMARY KEY(user_id,role_name),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(role_name) REFERENCES roles(name)
);
CREATE TABLE refresh_tokens (
 hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL, expires_at DATETIME(6) NOT NULL,
 revoked BOOLEAN NOT NULL DEFAULT FALSE, consumed BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, INDEX idx_refresh_user(user_id)
);
CREATE TABLE circles (
 id CHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, owner_id CHAR(36),
 FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE memberships (
 id CHAR(36) PRIMARY KEY, circle_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
 role VARCHAR(32) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
 muted_until DATETIME(6), banned_until DATETIME(6), UNIQUE(circle_id,user_id),
 FOREIGN KEY(circle_id) REFERENCES circles(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE reports (
 id CHAR(36) PRIMARY KEY, reporter_id CHAR(36), target_id CHAR(36), circle_id CHAR(36),
 content_id VARCHAR(100), reason VARCHAR(32) NOT NULL, created_at DATETIME(6) NOT NULL,
 FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE SET NULL,
 FOREIGN KEY(target_id) REFERENCES users(id) ON DELETE SET NULL,
 FOREIGN KEY(circle_id) REFERENCES circles(id) ON DELETE SET NULL
);
CREATE TABLE moderation_actions (
 id CHAR(36) PRIMARY KEY, actor_id CHAR(36), target_id CHAR(36), circle_id CHAR(36),
 action VARCHAR(32) NOT NULL, content_id VARCHAR(100), created_at DATETIME(6) NOT NULL,
 FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL,
 FOREIGN KEY(target_id) REFERENCES users(id) ON DELETE SET NULL,
 FOREIGN KEY(circle_id) REFERENCES circles(id) ON DELETE SET NULL
);
CREATE TABLE privacy_requests (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36), kind VARCHAR(32) NOT NULL,
 status VARCHAR(32) NOT NULL, object_key VARCHAR(512), created_at DATETIME(6) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE crisis_resources (
 id CHAR(36) PRIMARY KEY, region VARCHAR(16) NOT NULL, name VARCHAR(120) NOT NULL,
 url VARCHAR(1000) NOT NULL, phone VARCHAR(64), INDEX idx_crisis_region(region)
);
INSERT INTO crisis_resources(id,region,name,url) VALUES
 ('00000000-0000-0000-0000-000000000001','GLOBAL','Find a Helpline','https://findahelpline.com/');
CREATE TABLE outbox_events (
 id CHAR(36) PRIMARY KEY, type VARCHAR(80) NOT NULL, version INT NOT NULL,
 occurred_at DATETIME(6) NOT NULL, payload TEXT NOT NULL, published BOOLEAN NOT NULL DEFAULT FALSE
);

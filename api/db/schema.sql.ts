export const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('submitter', 'reviewer', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`

export const CREATE_DESIGNS_TABLE = `
CREATE TABLE IF NOT EXISTS designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  submitter_id INTEGER NOT NULL,
  submitter_name TEXT NOT NULL,
  reviewer_id INTEGER,
  reviewer_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending_claim' CHECK(status IN ('pending_claim', 'reviewing', 'returned', 'pending_review', 'passed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
  return_reason TEXT,
  queue_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submitter_id) REFERENCES users(id),
  FOREIGN KEY (reviewer_id) REFERENCES users(id)
);
`

export const CREATE_COMMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  content TEXT NOT NULL,
  is_return_reason INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`

export const CREATE_OPERATION_LOGS_TABLE = `
CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`

export const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_designs_status ON designs(status);
CREATE INDEX IF NOT EXISTS idx_designs_submitter_id ON designs(submitter_id);
CREATE INDEX IF NOT EXISTS idx_designs_reviewer_id ON designs(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_designs_queue_order ON designs(queue_order);
CREATE INDEX IF NOT EXISTS idx_comments_design_id ON comments(design_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_design_id ON operation_logs(design_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
`

export const INITIAL_USERS_DATA = `
INSERT OR IGNORE INTO users (username, password_hash, name, role) VALUES
('admin', '$2a$10$u08PIZ4LDv.fyIcdYIdKAeTe5vOrXjSdnPA9Scgf8jkdPFqWEJNGi', '系统管理员', 'admin'),
('reviewer1', '$2a$10$ddmAFMku9XWjfjAYEFIq6eMPLvio2w1vu8zNUzS2hFj/wJOE8HxLq', '张评审', 'reviewer'),
('reviewer2', '$2a$10$ddmAFMku9XWjfjAYEFIq6eMPLvio2w1vu8zNUzS2hFj/wJOE8HxLq', '李评审', 'reviewer'),
('submitter1', '$2a$10$dthaR99oITFCEiL8MVU.2uokRUZxGHECRv/GSMqZxLwERth8QCxh2', '王设计', 'submitter'),
('submitter2', '$2a$10$dthaR99oITFCEiL8MVU.2uokRUZxGHECRv/GSMqZxLwERth8QCxh2', '刘设计', 'submitter');
`

export const SCHEMA_SQL = [
  CREATE_USERS_TABLE,
  CREATE_DESIGNS_TABLE,
  CREATE_COMMENTS_TABLE,
  CREATE_OPERATION_LOGS_TABLE,
  CREATE_INDEXES,
  INITIAL_USERS_DATA,
].join('\n')

export default SCHEMA_SQL

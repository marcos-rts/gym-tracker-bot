-- schema.sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY, -- usar telegram user id
  username VARCHAR(100),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE routines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE exercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL, -- para exercícios custom por usuário
  name VARCHAR(255) NOT NULL,
  equipment VARCHAR(100),
  default_reps VARCHAR(50), -- ex: "3x12" ou "15" etc
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE routine_exercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  routine_id INT NOT NULL,
  exercise_id INT NOT NULL,
  position INT DEFAULT 0, -- ordem na rotina
  notes TEXT,
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  routine_id INT,
  user_id BIGINT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  notes TEXT,
  FOREIGN KEY (routine_id) REFERENCES routines(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE sets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  exercise_id INT NOT NULL,
  set_index INT NOT NULL, -- série 1,2,3...
  weight DECIMAL(6,2) NULL,
  reps INT NULL,
  duration_seconds INT NULL, -- se for cardio ou timed set
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

-- índices úteis
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sets_session ON sets(session_id);

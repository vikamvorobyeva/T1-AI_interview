CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  role TEXT NOT NULL,
  level TEXT,
  format TEXT,
  language TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Ожидает',
  candidate_code TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  interview_id TEXT REFERENCES interviews(id) ON DELETE CASCADE,
  sender TEXT,
  text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
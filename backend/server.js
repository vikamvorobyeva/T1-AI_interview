const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "ai_interview",
  port: Number(process.env.DB_PORT || 5432),
});

// health
app.get("/api/health", async (_, res) => {
  res.json({ ok: true });
});

// CREATE interview
app.post("/api/interviews", async (req, res) => {
  try {
    const {
      id,
      candidateName,
      role,
      level,
      format,
      language,
      notes,
      status,
      candidateCode,
      createdAt,
      finishedAt,
    } = req.body;

    await pool.query(
      `
      INSERT INTO interviews
      (id, candidate_name, role, level, format, language, notes, status, candidate_code, created_at, finished_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `,
      [
        id,
        candidateName,
        role,
        level,
        format,
        language,
        notes,
        status,
        candidateCode,
        new Date(createdAt),
        finishedAt ? new Date(finishedAt) : null,
      ]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/interviews", e);
    res.status(500).json({ error: e.message });
  }
});

// LIST interviews
app.get("/api/interviews", async (_, res) => {
  const r = await pool.query("SELECT * FROM interviews ORDER BY created_at DESC");
  res.json(r.rows);
});

// GET one interview
app.get("/api/interview", async (req, res) => {
  const { id, code } = req.query;
  const r = await pool.query(
    "SELECT * FROM interviews WHERE id=$1 AND candidate_code=$2",
    [id, code]
  );
  res.json(r.rows[0] || null);
});

// CREATE message
app.post("/api/messages", async (req, res) => {
  try {
    const { interviewId, sender, text } = req.body;
    await pool.query(
      "INSERT INTO messages (interview_id, sender, text) VALUES ($1,$2,$3)",
      [interviewId, sender, text]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/messages", e);
    res.status(500).json({ error: e.message });
  }
});

// LIST messages
app.get("/api/messages", async (req, res) => {
  const { interviewId } = req.query;
  const r = await pool.query(
    "SELECT * FROM messages WHERE interview_id=$1 ORDER BY created_at ASC",
    [interviewId]
  );
  res.json(r.rows);
});

app.listen(3000, () => console.log("🚀 Backend at http://localhost:3000"));
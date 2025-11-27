import os
import uuid
from typing import Optional, List

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "ai_interview")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")


def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


app = FastAPI(title="AI Interview Backend (Python)")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InterviewBase(BaseModel):
    candidate_name: str
    role: str
    level: Optional[str] = None
    format: Optional[str] = None
    language: Optional[str] = None
    notes: Optional[str] = None


class InterviewCreate(InterviewBase):
    pass


class InterviewUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    finished: Optional[bool] = None


class InterviewOut(InterviewBase):
    id: str
    status: Optional[str] = None
    candidate_code: Optional[str] = None
    created_at: Optional[str] = None
    finished_at: Optional[str] = None

    class Config:
        orm_mode = True


class MessageCreate(BaseModel):
    interview_id: str
    sender: str
    text: str


class MessageOut(BaseModel):
    id: int
    interview_id: str
    sender: Optional[str]
    text: Optional[str]
    created_at: Optional[str]

    class Config:
        orm_mode = True


def generate_id() -> str:
    return str(uuid.uuid4())


def generate_code() -> str:
    # короткий код для кандидата, как приглашение
    return uuid.uuid4().hex[:6].upper()


@app.get("/api/health")
def health():
    return {"status": "ok", "backend": "python"}


@app.get("/api/interviews", response_model=List[InterviewOut])
def list_interviews():
    """Получить список всех интервью."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM interviews ORDER BY created_at DESC"
            )
            rows = cur.fetchall()
    return [InterviewOut(**dict(r)) for r in rows]


@app.post("/api/interviews", response_model=InterviewOut)
@app.post("/api/interview", response_model=InterviewOut)
def create_interview(data: InterviewCreate):
    """Создать интервью (для рекрутёра)."""
    interview_id = generate_id()

    # пробуем сгенерировать уникальный код кандидата
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            while True:
                candidate_code = generate_code()
                try:
                    cur.execute(
                        """
                        INSERT INTO interviews (
                            id, candidate_name, role, level, format, language, notes, candidate_code
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING *
                        """,
                        (
                            interview_id,
                            data.candidate_name,
                            data.role,
                            data.level,
                            data.format,
                            data.language,
                            data.notes,
                            candidate_code,
                        ),
                    )
                    row = cur.fetchone()
                    conn.commit()
                    break
                except psycopg2.Error as e:
                    # если конфликт по уникальному candidate_code — генерируем другой
                    conn.rollback()
                    if e.pgcode == "23505":
                        continue
                    raise

    return InterviewOut(**dict(row))


@app.get("/api/interview", response_model=InterviewOut)
def get_interview(
    id: str = Query(..., description="ID интервью"),
    code: Optional[str] = Query(None, description="Код кандидата для проверки доступа"),
):
    """
    Получить одно интервью. Если передан code, дополнительно проверяем candidate_code.
    Это позволяет использовать один и тот же эндпоинт и для кандидата, и для рекрутёра.
    """
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM interviews WHERE id = %s", (id,))
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Interview not found")

    if code is not None and row.get("candidate_code") and row["candidate_code"] != code:
        raise HTTPException(status_code=403, detail="Invalid candidate code")

    return InterviewOut(**dict(row))


@app.patch("/api/interviews/{interview_id}", response_model=InterviewOut)
def update_interview(interview_id: str, data: InterviewUpdate):
    """Обновить статус/комментарий интервью (например, со страницы рекрутёра)."""
    fields = []
    values = []

    if data.status is not None:
        fields.append("status = %s")
        values.append(data.status)

    if data.notes is not None:
        fields.append("notes = %s")
        values.append(data.notes)

    if data.finished:
        fields.append("finished_at = NOW()")

    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(interview_id)

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"UPDATE interviews SET {', '.join(fields)} WHERE id = %s RETURNING *",
                tuple(values),
            )
            row = cur.fetchone()
            if not row:
                conn.rollback()
                raise HTTPException(status_code=404, detail="Interview not found")
            conn.commit()

    return InterviewOut(**dict(row))


@app.get("/api/messages", response_model=List[MessageOut])
def list_messages(interviewId: str = Query(..., alias="interviewId")):
    """Получить все сообщения по интервью."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT * FROM messages
                WHERE interview_id = %s
                ORDER BY created_at ASC
                """,
                (interviewId,),
            )
            rows = cur.fetchall()

    return [MessageOut(**dict(r)) for r in rows]


@app.post("/api/messages", response_model=MessageOut)
def create_message(msg: MessageCreate):
    """Создать новое сообщение (реплика кандидата или системы)."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO messages (interview_id, sender, text)
                VALUES (%s, %s, %s)
                RETURNING *
                """,
                (msg.interview_id, msg.sender, msg.text),
            )
            row = cur.fetchone()
            conn.commit()

    return MessageOut(**dict(row))

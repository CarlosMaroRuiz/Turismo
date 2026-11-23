import json
import sqlite3
import time


class Store:
    def __init__(self, filename: str):
        self.db = sqlite3.connect(filename)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS updates (
                id INTEGER PRIMARY KEY, payload TEXT NOT NULL, response TEXT,
                attempts INTEGER NOT NULL DEFAULT 0, due REAL NOT NULL, done INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS updates_pending ON updates(done, due, id);
            CREATE TABLE IF NOT EXISTS notices (booking_id TEXT PRIMARY KEY, payload TEXT NOT NULL, due REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions (
                chat_id INTEGER PRIMARY KEY, state TEXT NOT NULL, next_check REAL
            );
        """)

    def enqueue(self, update: dict) -> None:
        with self.db:
            self.db.execute("INSERT OR IGNORE INTO updates (id, payload, due) VALUES (?, ?, ?)",
                            (update["update_id"], json.dumps(update), time.time()))

    def descartar_antiguas(self, segundos: int = 300) -> int:
        """Marca como hechas las actualizaciones viejas.

        Al reiniciar, Telegram reintenta lo que quedo pendiente. Sin esto, el
        bot responde de golpe mensajes de hace horas.
        """
        with self.db:
            cursor = self.db.execute(
                "UPDATE updates SET done = 1, payload = '{}', response = NULL WHERE done = 0 AND due < ?",
                (time.time() - segundos,),
            )
            return cursor.rowcount

    def pendientes_del_chat(self, chat_id: int, despues_de: int) -> list:
        """Mensajes de texto del mismo chat que llegaron despues de uno dado."""
        filas = self.db.execute(
            "SELECT id, payload FROM updates WHERE done = 0 AND id > ? ORDER BY id",
            (despues_de,),
        ).fetchall()

        resultado = []
        for fila in filas:
            datos = json.loads(fila["payload"])
            mensaje = datos.get("message") or {}
            if mensaje.get("chat", {}).get("id") == chat_id and mensaje.get("text"):
                resultado.append(fila)
        return resultado

    def next_update(self):
        return self.db.execute(
            "SELECT * FROM updates WHERE done = 0 AND due <= ? ORDER BY id LIMIT 1",
            (time.time(),),
        ).fetchone()

    def load(self, chat_id: int) -> dict:
        row = self.db.execute("SELECT state FROM sessions WHERE chat_id = ?", (chat_id,)).fetchone()
        return json.loads(row["state"]) if row else {}

    def save(self, chat_id: int, state: dict) -> None:
        status = state.get("booking", {}).get("status")
        next_check = time.time() + 30 if status in {"pending_payment", "capturing"} else None
        self.db.execute(
            """INSERT INTO sessions VALUES (?, ?, ?)
               ON CONFLICT(chat_id) DO UPDATE SET state = excluded.state, next_check = excluded.next_check""",
            (chat_id, json.dumps(state), next_check),
        )

    def stage(self, update_id: int, chat_id: int, state: dict, payload: dict) -> None:
        with self.db:
            self.save(chat_id, state)
            self.db.execute("UPDATE updates SET response = ? WHERE id = ?", (json.dumps(payload), update_id))

    def finish(self, update_id: int) -> None:
        with self.db:
            self.db.execute("UPDATE updates SET done = 1, payload = '{}', response = NULL WHERE id = ?", (update_id,))

    def retry(self, row) -> None:
        with self.db:
            attempts = row["attempts"] + 1
            self.db.execute("UPDATE updates SET attempts = ?, due = ? WHERE id = ?",
                            (attempts, time.time() + min(2 ** min(attempts, 8), 240), row["id"]))

    def next_booking(self):
        return self.db.execute(
            "SELECT * FROM sessions WHERE next_check <= ? ORDER BY next_check LIMIT 1",
            (time.time(),),
        ).fetchone()

    def defer_booking(self, chat_id: int) -> None:
        with self.db:
            self.db.execute("UPDATE sessions SET next_check = ? WHERE chat_id = ?", (time.time() + 30, chat_id))

    def notify(self, booking_id: str, payload: dict) -> None:
        self.db.execute("INSERT OR IGNORE INTO notices VALUES (?, ?, ?)",
                        (booking_id, json.dumps(payload), time.time()))

    def next_notice(self):
        return self.db.execute("SELECT * FROM notices WHERE due <= ? ORDER BY due LIMIT 1",
                               (time.time(),)).fetchone()

    def finish_notice(self, booking_id: str) -> None:
        with self.db:
            self.db.execute("DELETE FROM notices WHERE booking_id = ?", (booking_id,))

    def retry_notice(self, booking_id: str) -> None:
        with self.db:
            self.db.execute("UPDATE notices SET due = ? WHERE booking_id = ?", (time.time() + 60, booking_id))

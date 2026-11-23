FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip

COPY pyproject.toml ./
COPY README.md ./
COPY turismo_bot/ ./turismo_bot/

RUN pip install --no-cache-dir -e .

# Carpeta para SQLite persistente
RUN mkdir -p /app/data

ENV BOT_DATABASE=/app/data/bot.sqlite3
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "turismo_bot.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

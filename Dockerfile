# ── Stage 1: Build React ──────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Django + WhiteNoise ──────────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /frontend/dist/ ./frontend/dist/

RUN cd backend && python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["sh", "-c", "\
  set -e && \
  cd backend && \
  echo '==> Migrando...' && \
  python manage.py migrate --noinput && \
  echo '==> Creando superusuario si no existe...' && \
  python manage.py createsuperuser --noinput 2>/dev/null || true && \
  echo '==> Iniciando gunicorn...' && \
  exec gunicorn sistathlon.wsgi:application \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 2 \
    --timeout 120 \
    --log-level info \
"]

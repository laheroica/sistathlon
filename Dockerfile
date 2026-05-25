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

# Dependencias del sistema para psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Dependencias Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código del backend
COPY backend/ ./backend/

# Frontend compilado (del stage anterior)
COPY --from=frontend-build /frontend/dist/ ./frontend/dist/

# Archivos estáticos de Django
RUN cd backend && python manage.py collectstatic --noinput

EXPOSE 8000

# Migraciones al arrancar (necesitan DATABASE_URL del entorno)
CMD ["sh", "-c", "cd backend && python manage.py migrate --noinput && gunicorn sistathlon.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120"]

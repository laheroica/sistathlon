FROM python:3.12-slim

# Variables de entorno para Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar backend
COPY backend/ ./backend/

# Copiar frontend build (ya compilado)
COPY frontend/dist/ ./frontend/dist/

# Collectstatic (WhiteNoise lo sirve)
RUN cd backend && python manage.py collectstatic --noinput

# Migraciones se corren al iniciar (no en build, para tener DATABASE_URL disponible)
EXPOSE 8000

CMD cd backend && python manage.py migrate --noinput && \
    gunicorn sistathlon.wsgi:application \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 2 \
    --timeout 120

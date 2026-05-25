# Sistathlon — Instrucciones de instalación

## Requisitos previos

1. **Python 3.11+** — Descargar de https://python.org/downloads
   - Durante la instalación: marcar ✅ "Add Python to PATH"
2. **Node.js 20+** — Descargar de https://nodejs.org
3. **PostgreSQL 15+** — Descargar de https://www.postgresql.org/download/windows/
   - Recordar el password de postgres durante la instalación

---

## Backend (Django)

```bash
cd backend

# 1. Crear entorno virtual
python -m venv venv
venv\Scripts\activate          # Windows

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Configurar variables de entorno
copy .env.example .env
# Editar .env con el password de PostgreSQL

# 4. Crear la base de datos en PostgreSQL
# Abrir pgAdmin o psql y ejecutar:
#   CREATE DATABASE athlon_db;

# 5. Crear tablas
python manage.py migrate

# 6. Crear usuario administrador
python manage.py createsuperuser

# 7. Cargar datos iniciales (profes + precios Abril 2026)
python manage.py loaddata fixtures/datos_iniciales.json

# 8. Iniciar servidor
python manage.py runserver
```

El backend queda disponible en: http://localhost:8000
Panel de admin: http://localhost:8000/admin

---

## Frontend (React + Vite)

```bash
cd frontend

# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev
```

El frontend queda disponible en: http://localhost:5173

---

## Estructura del proyecto

```
Sistathlon/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── sistathlon/         # Configuración Django
│   │   ├── settings.py
│   │   └── urls.py
│   ├── apps/
│   │   ├── alumnos/        # Modelo central + auth
│   │   ├── pagos/          # Historial de pagos
│   │   ├── profes/         # Plantel + valores hora
│   │   ├── horarios/       # Grilla maestra + real + feriados
│   │   ├── liquidaciones/  # Liquidación mensual por profe
│   │   ├── mensajes/       # Historial + templates WA/IG
│   │   ├── caja/           # Arqueo diario
│   │   ├── precios/        # Tabla de precios por mes
│   │   ├── temporales/     # Alumnos de corta duración
│   │   └── reportes/       # Vistas calculadas
│   └── fixtures/
│       └── datos_iniciales.json
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── AlumnosPage.jsx
    │   │   └── NuevoAlumnoPage.jsx
    │   ├── components/
    │   │   └── Layout.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   └── lib/
    │       ├── api.js
    │       └── auth.js
    └── package.json
```

---

## Próximos módulos a desarrollar (Semana 2)

- [ ] Módulo de Pagos — registro + historial
- [ ] Calculadora de cuotas completa
- [ ] Módulo de Caja — arqueo con denominaciones
- [ ] Módulo de Profes — plantel + valores hora

## Semana 3
- [ ] Liquidación de profes — por sede + Mario/Day
- [ ] Horarios — grilla maestra + semana real

## Semana 4
- [ ] Centro de mensajes WA/IG
- [ ] Reportes — 5 pestañas

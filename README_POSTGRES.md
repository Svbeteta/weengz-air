# PostgreSQL + Docker + API (Weengz Air)

This guide migrates the app from a JSON file (json-server) to a real PostgreSQL database running in Docker, with a minimal Node/Express + Prisma API that keeps the same endpoints the Angular app already uses.

## Overview

- Docker services: postgres 16 + pgAdmin UI.
- Backend: Node.js + Express + Prisma (in `server/`).
- Endpoints preserved:
  - GET/POST/PATCH `/usuarios`
  - GET/PATCH `/asientos`
  - GET/POST/PATCH/DELETE `/reservaciones`
- Angular now points to `http://localhost:4000` (see `src/environments/environment.ts`).

## 1) Start PostgreSQL with Docker

Requirements: Docker Desktop.

In a terminal (PowerShell), from the project root:

```powershell
# 1. Start database and pgAdmin
docker compose up -d

# 2. Check containers
docker ps
```

- Postgres: `localhost:5432` (user: `weengz`, password: `weengz`, db: `weengz`).
- pgAdmin: http://localhost:5050 (email: `admin@weengz.local`, password: `admin123`).

Optional: add a new server in pgAdmin with host `db`, user `weengz`, password `weengz`.

## 2) Configure the API

The backend lives in `server/`. It uses Prisma to talk to Postgres.

```powershell
# 1. Create a local .env for the server
Copy-Item server/.env.example server/.env

# 2. Install dependencies
cd server
npm install

# 3. Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init

# 4. (optional) Seed data from existing db.json
npm run seed

# 5. Start the API
npm run dev
# API is now on http://localhost:4000
```

If you change the Prisma schema later, re-run `npx prisma migrate dev`.

## 3) Run the Angular app

Open a second terminal from project root:

```powershell
npm start
```

Angular reads `apiBaseUrl` from `src/environments/environment.ts` which is already set to `http://localhost:4000`.

## 4) Endpoint behavior (parity with json-server)

- `GET /usuarios` -> list users.
- `POST /usuarios` -> create user with `{ email, nombreCompleto, esVip, reservasCount?, fechaCreacion? }`.
- `PATCH /usuarios/:id` -> partial update.
- `GET /asientos` -> list seats.
- `PATCH /asientos/:id` -> partial update of `estado` or other fields.
- `GET /reservaciones` -> returns shape compatible with the frontend: `{ pasajero: { ... }, detalles: { ... }, Modificaciones: [...] }`.
- `POST /reservaciones` -> creates a reservation; same object shape used by the app.
- `PATCH /reservaciones/:id` -> partial update.
- `DELETE /reservaciones/:id` -> remove reservation.

## 5) Data model

Defined in `server/prisma/schema.prisma`:
- `Usuario(id, email, nombreCompleto, fechaCreacion, esVip, reservasCount)`
- `Asiento(id, numero, clase, estado)`
- `Reservacion(id, estado, usuario, asiento, pasajeroNombre, pasajeroCui, pasajeroEquipaje, fechaReservacion, metodoSeleccion, precioBase, precioTotal)`
- `Modificacion(id, fecha, recargo, descripcion, reservacionId)`

`seed-from-json.ts` migrates from `db.json` into Postgres.

## 6) Troubleshooting

- If `@prisma/client` not found, run `npx prisma generate` after `npm install`.
- If the API cannot connect to Postgres, confirm Docker is running and `server/.env` has the correct `DATABASE_URL`.
- On Windows, if port 5432 is in use, edit `docker-compose.yml` and change `5432:5432` to another host port (e.g., `5433:5432`) and update `DATABASE_URL` accordingly.

## 7) Production notes (optional)

- Use `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` with a production override that mounts read-only, sets volumes, and uses strong passwords.
- Backups: `pg_dump` the `weengz` DB regularly; bind-mount or named volumes (already configured) persist data locally.
- Migrations: run `prisma migrate deploy` during CI/CD before starting the API.

## 8) Next steps: validation and constraints

To harden data integrity and input handling:

- Request validation: add a small schema layer (e.g., Zod) in `server/src/index.ts` to validate bodies for:
  - Crear/Cancelar/Modificar reservaciones (atomic endpoints)
  - Crear/Actualizar usuarios (email format, domain), asientos (estado/clase)
- Enums and constraints in Prisma (`server/prisma/schema.prisma`):
  - Enum `EstadoAsiento = [Libre, Ocupado]` and `Clase = [Negocios, Economica]`
  - Unique index on `Asiento.numero`
  - Check constraints for positive precios and non-empty nombres
- Transactions are already in place for atomic flows; keep business rules server-side (VIP 10%, recargo 10% por modificación, no doble-asignación de asiento).
- Tests: add unit tests for validators and integration tests for atomic endpoints.

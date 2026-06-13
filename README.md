# Job Board

A full-stack job board (Node/Express/MongoDB backend + Vite/React frontend) in a
pnpm monorepo. The backend and MongoDB run in Docker; the frontend runs with Vite.
This README covers setup, environment variables, and how to run it locally. Design
decisions are in [DECISIONS.md](DECISIONS.md).

## Prerequisites

- **Docker** (runs the backend API + MongoDB via Docker Compose)
- **Node 22+** and **pnpm 10+** (`corepack enable`) — for the frontend

## Setup

```bash
# 1. Install dependencies (from the repo root)
pnpm install

# 2. Configure the backend environment
cd backend
cp .env.example .env        # then edit values (JWT_SECRET, CORS_ORIGIN, ...)

# 3. Configure the frontend environment
cd ../frontend
cp .env.example .env        # VITE_API_URL is required (no default)
```

## Environment variables

### Backend

All are required — the server refuses to start if any is missing (no in-code
defaults). See [`backend/.env.example`](backend/.env.example).

| Variable      | Example                              | Purpose                                                          |
| ------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `PORT`        | `5000`                               | Port the API listens on                                          |
| `MONGO_URI`   | `mongodb://localhost:27017/jobboard` | MongoDB connection string (Atlas URI in deploy)                  |
| `JWT_SECRET`  | `<long random string>`               | Secret used to sign/verify JWTs                                  |
| `UPLOAD_DIR`  | `./uploads`                          | Directory where validated CVs are written                       |
| `CORS_ORIGIN` | `http://localhost:3000`              | Allowed frontend origin (REST + Socket.io); deployed URL in prod |

> Running via Docker Compose (below), `PORT`, `MONGO_URI`, and `UPLOAD_DIR` are set
> by the compose file; `JWT_SECRET` and `CORS_ORIGIN` are read from `backend/.env`.

### Frontend

See [`frontend/.env.example`](frontend/.env.example).

| Variable       | Example                 | Purpose                                                        |
| -------------- | ----------------------- | -------------------------------------------------------------- |
| `VITE_API_URL` | `http://localhost:5000` | Base URL of the backend (REST + Socket.io). No trailing slash. |

## Running locally

### Backend + MongoDB (Docker)

From `backend/`, start both containers with Docker Compose:

```bash
cd backend
docker compose up --build        # add -d to run detached
```

This builds and runs the API on **http://localhost:5000** and MongoDB on
`localhost:27017`. Use `--build` the first time and after changing dependencies;
plain `docker compose up` is enough for later runs (the source is bind-mounted and
hot-reloads).

Verify it's up: `GET http://localhost:5000/api/health` → `{ "status": "ok" }`.

### Frontend (Vite)

From the repo root:

```bash
pnpm dev:frontend                # http://localhost:3000
```

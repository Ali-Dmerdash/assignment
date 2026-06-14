# Job Board

A full-stack job board (Node/Express/MongoDB backend + Vite/React frontend) in a
pnpm monorepo. Backend, frontend, and MongoDB all run in Docker via a single
Compose file at the repo root. This README covers setup, environment variables,
and how to run it locally. Design decisions are in [DECISIONS.md](DECISIONS.md).

## Prerequisites

- **Docker** (runs MongoDB + backend + frontend via Docker Compose)
- **Node 22+** and **pnpm 10+** (`corepack enable`) — only if you run the apps
  outside Docker

## Setup

```bash
# Configure both environments — Compose loads each via `env_file`
cp backend/.env.example backend/.env     # then set JWT_SECRET, etc.
cp frontend/.env.example frontend/.env
```

Both `.env` files are required for the Docker flow (the compose `env_file`s point
at them). For running the apps outside Docker, also run `pnpm install`.

## Environment variables

### Backend

All are required — the server refuses to start if any is missing (no in-code
defaults). See [`backend/.env.example`](backend/.env.example).

| Variable      | Example                              | Purpose                                                          |
| ------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `PORT`        | `5000`                               | Port the API listens on                                          |
| `MONGO_URI`   | `mongodb://localhost:27017/jobboard` | MongoDB connection string (Atlas URI in deploy)                  |
| `JWT_SECRET`  | `<long random string>`               | Secret used to sign/verify JWTs                                  |
| `UPLOAD_DIR`  | `./uploads`                          | Directory where validated CVs are written                        |
| `CORS_ORIGIN` | `http://localhost:3000`              | Allowed frontend origin (REST + Socket.io); deployed URL in prod |

> Under Docker Compose, `MONGO_URI` and `UPLOAD_DIR` are overridden by the compose
> file (the Mongo service name + the mounted volume); `PORT`, `JWT_SECRET`, and
> `CORS_ORIGIN` are read from `backend/.env`.

### Frontend

See [`frontend/.env.example`](frontend/.env.example).

| Variable       | Example                 | Purpose                                                        |
| -------------- | ----------------------- | -------------------------------------------------------------- |
| `VITE_API_URL` | `http://localhost:5000` | Base URL of the backend (REST + Socket.io). No trailing slash. |

> Under Docker, the frontend container loads `VITE_API_URL` from `frontend/.env`
> via the compose `env_file`. The browser runs on the host, so `localhost:5000`
> reaches the mapped backend port.

## Running locally

From the repo root, bring up the whole stack:

```bash
docker compose up --build        # add -d to run detached
```

This starts:

- **MongoDB** on `localhost:27017`
- **Backend API** on **http://localhost:5000**
- **Frontend** on **http://localhost:3000**

Use `--build` the first time and after changing dependencies; plain
`docker compose up` is enough afterward (source is bind-mounted and hot-reloads).

Verify the API: `GET http://localhost:5000/api/health` → `{ "status": "ok" }`.

### Running outside Docker (optional)

```bash
pnpm install
cd backend
docker compose up -d mongo
cd ..
pnpm dev:backend     # needs MongoDB running (e.g. docker compose up -d mongo)
pnpm dev:frontend    # http://localhost:3000  (needs frontend/.env)
```

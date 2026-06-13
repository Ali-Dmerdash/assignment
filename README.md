# Job Board

A full-stack job board where employers post and manage jobs and applicants browse,
filter, and apply. Monorepo with a Node/Express/MongoDB backend and a Vite/React
frontend.

> **Status:** the **backend is feature-complete** (auth, jobs lifecycle, search,
> applications with CV validation, real-time notifications) and **tested**. The
> **frontend** is not finished yet — see
> [Status & what's incomplete](#status--whats-incomplete). Design decisions and
> trade-offs are written up in [DECISIONS.md](DECISIONS.md).

## Tech stack

| Layer | Choice |
| --- | --- |
| Backend | Node + Express 5 + TypeScript (ESM), run with `tsx` (dev) / `tsc` (build) |
| Database | MongoDB via Mongoose 9 (local Docker; Atlas in deployment) |
| Auth | JWT (`jsonwebtoken`) + `bcrypt`, two roles (employer / applicant) |
| Uploads | Multer + content-based MIME validation (`file-type` + cfbf/pdf plugins) |
| Tests | Jest (ESM) + ts-jest |
| Frontend | Vite + React + TypeScript (in progress) |

## Prerequisites

- **Node 22+**
- **pnpm 10+** (`corepack enable`)
- **Docker** (for local MongoDB)

## Setup

```bash
# 1. Install dependencies (from the repo root)
pnpm install

# 2. Configure backend environment
cd backend
cp .env.example .env        # then edit values as needed

# 3. Start MongoDB (local, via Docker)
docker compose up -d mongo
```

> If `bcrypt` fails to load at runtime, allow its native build with
> `pnpm approve-builds` (it ships prebuilt binaries for most platforms, so this
> is usually unnecessary).

## Environment variables (backend)

All are required — there are no in-code defaults. See [`backend/.env.example`](backend/.env.example).

| Variable | Example | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | Port the API listens on |
| `MONGO_URI` | `mongodb://localhost:27017/jobboard` | MongoDB connection string (Atlas URI in deploy) |
| `JWT_SECRET` | `<long random string>` | Secret used to sign/verify JWTs |
| `UPLOAD_DIR` | `./uploads` | Directory where validated CVs are written |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin (REST + Socket.io); deployed URL in prod |

## Running locally

```bash
# Backend (http://localhost:5000) — needs MongoDB running
pnpm dev:backend

# Frontend (http://localhost:3000)
pnpm dev:frontend

# Both at once
pnpm dev
```

Health check: `GET http://localhost:5000/api/health` → `{ "status": "ok" }`.

## API

JWT is sent as a Bearer token: `Authorization: Bearer <token>`. Protected routes
return **401** (not authenticated) or **403** (wrong role / not the owner).

| Method & path | Access | Description |
| --- | --- | --- |
| `POST /api/auth/register` | public | Register (`name`, `email`, `password`, `role`) → token |
| `POST /api/auth/login` | public | Log in (`email`, `password`) → token |
| `GET /api/jobs?page=&limit=&location=&keyword=` | applicant | List published jobs (server-side pagination + filter; keyword matches title + description) |
| `POST /api/jobs` | employer | Create a job |
| `PUT /api/jobs/:id` | employer (owner) | Edit / publish a draft |
| `PATCH /api/jobs/:id/close` | employer (owner) | Close a job (cannot be deleted) |
| `GET /api/jobs/:id/applicants` | employer (owner) | View applicants for a job |
| `POST /api/jobs/:id/apply` | applicant | Apply once, with a CV upload (multipart field `cv`) |

Key server-side rules (the client is not trusted): `datePosted` is set on first
publish; only `published` jobs are visible/applicable; one application per
applicant per job (unique index); CV type is validated from file **content**, not
the extension (PDF / DOC / DOCX only).

### Real-time (Socket.io)

The Socket.io server shares the same HTTP port. A client connects with its JWT in
the handshake and is placed in a private room keyed by its user id:

```js
io("http://localhost:5000", { auth: { token } });
io.on("new_application", (payload) => { /* badge / toast */ });
```

When an application is saved, the backend emits **`new_application`** to the owning
employer's room, so all of that employer's open tabs update without a refresh.

## Testing

The test suite uses a separate **`jobboard_test`** database, so MongoDB must be
running. It never touches your `jobboard` data.

```bash
cd backend
docker compose up -d mongo     # if not already running
pnpm test
```

The DB is cleared once at the start of a run and left populated afterward (for
inspection in Compass). Coverage: auth middleware, content-based CV MIME
validation (real file fixtures in `test/fixtures/`), and the full jobs/apply flow.

## Project structure

```
backend/
  src/
    config/        env + Mongo connection
    middleware/    auth (JWT, role guards), upload (Multer + MIME validation)
    models/        User, Job, Application (typed Mongoose schemas)
    controllers/   auth, jobs (create/edit/close/list/applicants/apply)
    routes/        /api/auth, /api/jobs
    server.ts      Express app + error handler + graceful shutdown
  test/            Jest suites + CV fixtures
  docker-compose.yaml  dev: MongoDB (+ optional backend container)
frontend/          Vite + React (in progress)
DECISIONS.md       design decisions & trade-offs
```

## Deployment

Intended targets: backend → Railway (Dockerized), frontend → Vercel, database →
MongoDB Atlas. The production Docker setup lives in an untracked `backend/prod/`
directory (separate Dockerfile/compose). For Atlas, set `MONGO_URI` to the cluster
connection string.

## Status & what's incomplete

**Done (backend):** JWT auth with two roles + bcrypt + route guards; job lifecycle
(Draft → Published → Closed, close-not-delete, server-set `datePosted`);
server-side pagination/filtering with keyword search; apply-once with content-based
CV validation and a pre-upload gate; real-time `new_application` notifications over
Socket.io (JWT-authenticated, room per employer); Jest test suite; Dockerized
backend + Mongo.

**Not finished:**

- **Frontend.** Currently a scaffold; the browse/apply and employer dashboards,
  the TanStack Query data layer, the role-based redirect guards, and the toast/badge
  that consumes the `new_application` socket event are not implemented.
- **Live deployment.** Config is in place but the app isn't deployed.

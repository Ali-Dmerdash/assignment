## Why I added two `file-type` plugins (`@file-type/cfbf` and `@file-type/pdf`)

CV validation is content-based: `validateCv` runs `file-type`’s  
`fileTypeFromBuffer` over the uploaded bytes and only accepts a real PDF / DOC /  
DOCX. ([`backend/src/middleware/upload.ts`](backend/src/middleware/upload.ts)) But  
plain magic-number detection has two blind spots that would let the wrong file  
through as an “accepted” type — each plugin closes one:

- **`@file-type/cfbf`** — a legacy `.doc` is an OLE2/CFB compound file, the _same  
  container format_ as `.xls`, `.ppt`, `.msi`, etc. Without the plugin, detection  
  can only say “this is a CFB file” (`application/x-cfb`) and can’t tell a Word  
  document from an Excel sheet — so an `.xls` renamed to `.doc` would look like a  
  generic Office container and slip through. The plugin reads the **CLSID** (the  
  class id in the compound file’s root entry) and maps it to the specific app, so  
  a real Word doc reports `application/msword`, while that renamed `.xls` reports  
  `application/vnd.ms-excel` and is rejected. This is what actually resolves the  
  DOC ambiguity.

- **`@file-type/pdf`** — Adobe Illustrator `.ai` files are technically PDFs and  
  carry the same `%PDF` signature, so naive magic-number detection happily accepts  
  them as a PDF. The plugin looks deeper into the PDF’s internal metadata  
  (producer/creator) and reports `application/illustrator`, so an `.ai` dressed up  
  as a CV is rejected.

---

## Why “Date Posted” is set when a job is first published, not when it’s created

The spec wants `datePosted` generated server-side and not trusted from the client.  
The easy reading is “set it at creation,” but that’s wrong here: a job starts as a  
**Draft** that nobody can see. A draft created Monday and published Friday should  
read as posted **Friday** — the day applicants actually see it. ([`backend/src/models/Job.ts`](backend/src/models/Job.ts))

- `datePosted` is optional with no default, so a draft simply doesn’t have one.

- A `pre("save")` hook stamps it the first time `status === "published"`, guarded  
  by `!this.datePosted` so it’s set **once** and never moves on later saves (e.g.  
  closing the job).

- It’s always `new Date()` on the server, so the client can’t forge it.

---

## How I handle socket room cleanup when a user disconnects

Each socket authenticates from its JWT and joins a **private room keyed by the  
user id**; the apply handler emits `new_application` to that room. ([`backend/src/socket.ts`](backend/src/socket.ts))

The decision: **I let [Socket.io](http://Socket.io)’s built-in room lifecycle do the cleanup instead  
of tracking sockets myself.**

- When a socket disconnects, [Socket.io](http://Socket.io) removes it from every room automatically,  
  and an empty room just stops existing (rooms aren’t persisted).

- Because I key rooms by user id and keep **no manual `Map<userId, socket>`**,  
  there’s nothing to tear down — no stale rooms, no dangling references.

- Multi-tab works for free: an employer’s open tabs are several sockets in the  
  same room; each leaves when its tab closes, and an emit reaches all of them.

---

## Why I store the JWT in a cookie + send it as a Bearer header (vs localStorage vs in-memory vs httpOnly)

- **localStorage** — survives refresh and JS can read it (so Bearer works), but  
  it’s the loosest about expiry/scope and the textbook “XSS grabs everything”  
  target.

- **In-memory only** — safest against token theft (no durable copy to steal), but  
  the user is logged out on every refresh.

- **httpOnly cookie** — JS can’t read it (great for XSS), but then JS can’t put it  
  in a Bearer header either .

- **JS-readable cookie + Bearer header (what I chose)** — survives refresh, JS can  
  read it to set the header, and I can still scope it with `SameSite=Lax` and a  
  `Max-Age` that expires on its own.

Honest trade-offs:

- Against XSS, a JS-readable cookie is **no safer than localStorage** — an injected  
  script can read either. The real XSS mitigation isn’t the storage location; it’s  
  React’s default escaping plus a CSP, which is where I’d invest next.

- **Authorization is enforced server-side** (401/403 on every route) no matter  
  what, so this choice only affects how easily a token can be stolen — not what  
  someone is allowed to do.

- The genuinely stronger design (in-memory access token + httpOnly refresh cookie)  
  is in the last section — it’s the thing I’d do with more time.

---

## How the socket authenticates from the browser, and why I use both TanStack Query and Store

Socket auth ([`lib/socket.ts`](frontend/src/lib/socket.ts), [`SocketManager.tsx`](frontend/src/components/SocketManager.tsx)):

- A single headless `SocketManager` watches the auth store and opens a connection  
  **only for a logged-in employer**.

- It passes the JWT in the handshake: `io(API_URL, { auth: { token } })`. The  
  server verifies it and auto-joins the user’s room, so the client never sends a  
  `join`. On logout or role change the effect disconnects (and reconnects if the  
  token changes — e.g. logging in as a different user).

- Incoming `new_application` events become a toast plus an entry in a notifications  
  store that drives the navbar badge.

Why two state libraries — they’re for different jobs:

- **TanStack Query** handles all _server_ state (jobs, applicants, mutations):  
  caching, dedup, `isPending`/`isError`, and cache invalidation after  
  create/publish/close come for free. Pagination + filters live in the **URL**, so  
  they’re shareable and the query key derives from them.

- **TanStack Store** handles _client_ state I need to read outside React too: the  
  session (guards read `token`/`user` imperatively during routing, where a hook  
  can’t reach) and the in-memory notifications list. Putting auth in Query would be  
  a category error.

- The notifications store is deliberately **in-memory** (cleared on refresh) — it’s  
  a live session indicator, not an inbox. The real source of truth is the  
  applicants list per job.

---

## Backend changes I had to make for the frontend (and a bug I found)

The task scoped me to the frontend, but a couple of required screens had no API to  
call, so I added the minimum:

- **`GET /api/jobs/mine`** (employer) — the dashboard needs the employer’s own jobs  
  in _all_ statuses, but the only listing route was applicant-only and returned  
  published jobs. An employer literally couldn’t see their own drafts.

- **`GET /api/jobs/:id`** (single job) — the applicant detail page and the employer  
  edit page both load one job by id, and no such route existed. Published jobs are  
  readable by anyone signed in; a draft/closed job returns **404** to anyone but  
  its owner (so we don’t leak that another employer’s unpublished job exists). For  
  applicants the response also includes an `applied` flag (see the next section).

The bug: login/register were returning 500 with `jwt.sign is not a function`.

- `jsonwebtoken` is CommonJS, and `middleware/auth.ts` used `import * as jwt`.

- Under real ESM (`tsx`/`node`), the callable exports end up on the **default**  
  export, so the namespace’s `jwt.sign` was `undefined`.

- One-line fix: `import jwt from "jsonwebtoken"`.

- Why it hid: the Jest suite passes because ts-jest compiles to CommonJS, where  
  `import * as` becomes a `require` and `jwt.sign` resolves. So it was “tested and  
  passing” _and_ broken at runtime at the same time — a good reminder that green  
  tests under a different module system aren’t a runtime guarantee.

---

## How I tell an applicant they’ve already applied — before they submit, not after

Dedup is enforced on the backend (a unique `{ job, applicant }` index plus a  
pre-upload gate), so a second apply always 409s. But the first version only showed  
that _after_ the user filled out and submitted the form, which is annoying for  
someone revisiting a job.

I added an `applied` boolean to the existing `GET /api/jobs/:id` response.

Why:

- The detail page already fetches the job on load, so the flag rides along in  
  **one request** — no extra round-trip, no new route to guard.

- It’s computed only for applicants (`Application.exists({ job, applicant })`);  
  employers just get `false`.

On the client ([`jobs.$jobId.tsx`](frontend/src/routes/jobs.$jobId.tsx)):

- The button uses `applied = (data.applied ?? false) || justApplied` — the server  
  value disables it on load (a greyed-out “Already applied”), and a local  
  `justApplied` flag flips it instantly after a successful apply or a 409 in  
  another tab, without waiting for a refetch.

- The 409 handler stays as the authoritative backstop — the flag is just a UX  
  optimization, never the real gate.

---

## The Vercel deploy 404 — TanStack Start SPA emits `_shell.html`, not `index.html`

Deploying the frontend to Vercel returned the platform **`404: NOT_FOUND`** on every
route (Vercel's own 404, not the app's). The build itself succeeded, so it was a
serve/routing problem, not a build one.

- **Cause:** TanStack Start in SPA mode isn't a plain static site. `vite build`
  emits `dist/client` (hashed assets + a prerendered shell named **`_shell.html`**,
  not `index.html`) plus `dist/server` (a Nitro server). Vercel served the static
  output, found no `index.html` at `/`, and 404'd.

- **Fix:** a `frontend/vercel.json` that points Vercel at the client dir and falls
  every non-file route back to the prerendered shell (which boots the SPA):

  ```json
  {
    "outputDirectory": "dist/client",
    "rewrites": [{ "source": "/(.*)", "destination": "/_shell.html" }]
  }
  ```

  Hashed assets under `/assets/*` still resolve directly — Vercel matches real files
  before applying rewrites — so only client routes (`/`, `/login`, `/jobs/:id`) get
  the shell.

- **Two gotchas next to it:** the Vercel project's **Root Directory** must be
  `frontend` (so `dist/client` + `vercel.json` resolve), and `VITE_API_URL` is
  inlined at **build** time — setting it after a build does nothing until you
  redeploy. (Related: the deployed API also needs `CORS_ORIGIN` to equal the Vercel
  origin _exactly_ — a trailing slash there breaks every preflight.)

---

## What I’d add or improve

- **The better auth design: in-memory access token + httpOnly refresh cookie.**  
  This is the real upgrade from the cookie+Bearer choice above, and what I’d build  
  with more time:
  - A **short-lived access token (5–15 min) kept only in memory**, sent as the  
    `Authorization: Bearer` header. Never persisted, so XSS can’t steal a durable  
    credential and it expires on its own in minutes.
  - A **long-lived refresh token in an httpOnly, `Secure`, `SameSite` cookie** that  
    JS can’t read. On load (memory is empty) or on a 401, the app silently calls  
    `POST /auth/refresh`; the browser sends the refresh cookie and the server mints  
    a fresh access token.
  - **Rotate** the refresh token on each use and track its id server-side, which  
    finally gives real **revocation** (logout-everywhere, kill a stolen token) —  
    something a plain stateless JWT can’t do.
  - Add a **double-submit CSRF token** for the cookie-backed `/auth/refresh`, since  
    cookies reintroduce CSRF risk.

- **Replace [Socket.io](http://Socket.io) with Server-Sent Events (SSE).** The notification flow is  
  strictly one-directional — the server pushes `new_application` to the employer  
  and the client never sends anything back over the channel. [Socket.io](http://Socket.io)’s  
  bidirectional WebSocket.

- **Email the applicant on accept/reject (SMTP).** Send an automated reply email
  on each decision via an email service like Resend, so the applicant is notified
  even when offline — no socket needed.

- **Downloadable CVs.** The backend stores the file but exposes no download route,

- so the applicants view shows metadata (name, type, size) rather than a working  
  link. I’d add an owner-guarded `GET /api/applications/:id/cv` that streams the  
  file with the right `Content-Type`.

- **Tests:** component tests for the apply flow and an e2e happy path (Playwright),  
  plus at least one backend test that runs under native ESM so a regression like  
  the `jwt` bug can’t hide behind ts-jest’s CommonJS output.

## CV MIME type validation

During my search I found a package called [file-type](https://github.com/sindresorhus/file-type) which solved most of the problem,
but there were some remaining problems that were solved by using other third-party plugins for this package.

- **[@file-type/cfbf](https://github.com/Borewit/file-type-cfbf)** — Detector plugin for `file-type` that identifies files based on the Compound File Binary Format (CFBF).
  - CFBF is a container format used by many legacy Microsoft Office files and other Windows applications.
    It detects the container itself, not the specific document content inside it.

  - Legacy `.doc` has the _same container format_ as `.xls`, `.ppt`, `.msi`, etc.

  - Without the plugin, detection can only say “this is a CFB file” (`application/x-cfb`).

  - The plugin reads the **CLSID** (the class id in the compound file’s root entry)
    and maps it to the specific app, so a real Word doc reports `application/msword`,
    while a renamed `.xls` reports `application/vnd.ms-excel` and is rejected.

- **[@file-type/pdf](https://github.com/Borewit/file-type-pdf)** — Detector plugin for `file-type` that identifies PDF (Portable Document Format) files and selected PDF-based subtypes.
  - Adobe Illustrator `.ai` files are technically PDFs and carry the same `%PDF` signature,
    so simple magic-number detection will accept them as a PDF.

  - This plugin can inspect the internal PDF structure to distinguish between generic PDF files
    and specific producer formats such as Adobe Illustrator (.ai).

---

## Why “Date Posted” is set when a job is first published, not when it’s created

I could have `datePosted` set at creation, but this doesn't sound right from an applicant POV.

- `datePosted` should be the same value as the day an applicant can actually start seeing the job.
  - A job can start as a **Draft** that nobody can see.

  - A draft created Monday and published Friday should read as posted **Friday** — the day applicants actually see it.

---

## How I handle socket room cleanup when a user disconnects

I let [Socket.io](http://Socket.io)’s built-in room lifecycle do the cleanup instead of tracking sockets myself.

- When a socket disconnects, `Socket.io` removes it from every room automatically,  
  and an empty room just stops existing.

- Multi-tab works for free: an employer’s open tabs are several sockets in the  
  same room; each leaves when its tab closes, and an emit reaches all of them.

---

## Why I store the JWT in a cookie (vs localStorage vs in-memory vs httpOnly)

- **localStorage** — survives refresh and JS can read it (so Bearer works), but  
  it’s the loosest about expiry/scope and is highly vulnerable to
  Cross-Site Scripting (XSS) attacks.

- **In-memory only** — safest against token theft (no durable copy to steal), but  
  the user is logged out on every refresh. (not good UX)

- **httpOnly cookie** — JS can’t read it (great against XSS), but then JS can’t put it  
  in a Bearer header.

- **JS-readable cookie** — survives refresh, JS can  
  read it to set the header, and I can still scope it with `SameSite=Lax` and a  
  `Max-Age` that expires on its own.

---

## Why two state libraries — they’re for different jobs:

- **[TanStack Query](https://tanstack.com/query/latest)** handles all _server_ state (jobs, applicants, mutations):  
  caching, dedup, `isPending`/`isError`, and cache invalidation after  
  create/publish/close come for free. Pagination + filters live in the **URL**, so  
  they’re shareable and the query key derives from them.

- **[TanStack Store](https://tanstack.com/store/latest)** handles _client_ state I need to read outside React too: the  
  session (guards read `token`/`user` imperatively during routing, where a hook  
  can’t reach) and the in-memory notifications list. Putting auth in Query would be  
  a category error.

- The notifications store is deliberately **in-memory** (cleared on refresh) — it’s  
  a live session indicator, not an inbox. The real source of truth is the  
  applicants list per job.

---

## How I tell an applicant they’ve already applied — before they submit, not after

Dedup is enforced on the backend, so a second apply always 409s.
But the first version only showed that _after_ the user filled out and submitted the form,
which is annoying for someone revisiting a job.

I added an `applied` boolean to the existing `GET /api/jobs/:id` response.

- The detail page already fetches the job on load, so the flag rides along in  
  **one request**.
- It's computed only for applicants; employers just get `false`.

On the client ([`jobs.$jobId.tsx`](frontend/src/routes/jobs.$jobId.tsx)):

- The apply button gets disabled because the server value disables it on load
  (a greyed-out “Already applied”), and a local `justApplied` flag flips it
  instantly after a successful apply or a 409 in another tab, without waiting
  for a refetch.

- The 409 handler stays as the authoritative backstop — the flag is just a UX  
  optimization, never the real gate.

---

## **_bug_** : login/register were returning 500 with `jwt.sign is not a function`

- `jsonwebtoken` is CommonJS, and [`middleware/auth.ts`](backend/src/middleware/auth.ts) used `import * as jwt`.

- Under real ESM (`tsx`/`node`), the callable exports end up on the **default**  
  export, so the namespace’s `jwt.sign` was `undefined`.

- One-line fix: `import jwt from "jsonwebtoken"`.

- Why it hid: the Jest suite passes because ts-jest compiles to CommonJS, where  
  `import * as` becomes a `require` and `jwt.sign` resolves. So it was tested and  
  passing but broken at runtime at the same time.

---

## **_bug_** : Vercel deploy 404

Deploying the frontend to Vercel returned the platform **`404: NOT_FOUND`** on every  
route (Vercel’s own 404, not the app’s). The build itself succeeded, so it was a  
serve/routing problem, not a build one.

- **Cause:** TanStack Start SPA emits `_shell.html`, not `index.html`.
  Vercel served the static output, found no `index.html` at `/`, and 404’d.

- **Fix:** a [`frontend/vercel.json`](frontend/vercel.json) that points Vercel at the client dir and falls  
  every non-file route back to the prerendered shell (which boots the SPA).

---

## What I’d add or improve

- **The [BetterAuth](https://better-auth.com/) design: in-memory access token + httpOnly refresh cookie.**  
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

- **Replace Socket.io with Server-Sent Events (SSE).** The notification flow is  
  strictly one-directional — the server pushes `new_application` to the employer  
  and the client never sends anything back over the channel. Socket.io is  
  a bidirectional WebSocket.

- **Email the applicant on accept/reject (SMTP).** Send an automated reply email  
  on each decision via an email service like Resend, so the applicant is notified  
  even when offline — no socket needed.

- **Hosting on [Railway](https://railway.com/).** Right now it's split
  across three providers — MongoDB on Atlas, the backend on Railway, and the
  frontend on Vercel. I'd move all three onto Railway (managed Mongo + the backend
  - a static frontend service) so it's one dashboard, one set of env vars, and a
    same-network DB connection, instead of juggling three accounts and the
    cross-origin setup between them.

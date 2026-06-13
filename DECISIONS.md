# Decisions

## 1. CV upload validation: trust the bytes, not the extension or `Content-Type`

The assignment requires rejecting CVs whose *actual* type isn't PDF/DOC/DOCX,
"regardless of the file extension." A browser-sent `Content-Type` (what Multer's
`fileFilter` sees) and the filename are both client-controlled and trivially
spoofable, so neither is a real check. I validate the file's real content instead.

**How it works** ([`backend/src/middleware/upload.ts`](backend/src/middleware/upload.ts)):

1. Multer uses **memory storage**, so the upload is buffered in RAM and *nothing
   is written to disk until it passes validation*.
2. `validateCv` runs `file-type`'s `fileTypeFromBuffer` on the buffer. `file-type`
   reads magic numbers and, for container formats, looks inside the container —
   so a `.docx` (a ZIP) is distinguished from `.xlsx`/`.pptx` rather than seen as
   a generic ZIP.
3. The detected MIME is checked against the model's `CV_MIME_TYPES` (single
   source of truth, also enforced as a schema `enum`). Only `application/pdf`,
   `application/msword`, and the DOCX MIME pass; everything else is a 400 — and a
   rejected upload never touches the volume.
4. On success the buffer is written to the `uploads` volume (compose sets
   `UPLOAD_DIR=/app/uploads`) under a random name with the correct extension, and
   normalized metadata is attached to `req.cvFile` for the controller.

**Why two extra `file-type` plugins**

Plain magic-number detection has two blind spots that these official plugins close:

- **`@file-type/cfbf`** — legacy `.doc` is an OLE2/CFB compound file, a container
  shared by `.doc`, `.xls`, `.ppt`, `.msi`, etc. Generic detection can only say
  "this is a CFB file" (`application/x-cfb`), which can't tell a Word doc from an
  Excel sheet. This plugin reads the root entry's **CLSID** and maps it to the
  specific application, so a real Word document reports `application/msword`,
  while an `.xls` renamed to `.doc` reports `application/vnd.ms-excel` and is
  rejected. This is what actually resolves the CFB ambiguity.
- **`@file-type/pdf`** — Adobe Illustrator `.ai` files are technically PDFs and
  share the `%PDF` signature, so naive detection lets them through as PDF. This
  plugin inspects the internal PDF structure (producer/creator metadata) and
  reports `application/illustrator` for them, so they're rejected.

**Trade-offs**

- Memory storage holds the whole file in RAM while validating — fine at the 5 MB
  cap, and the upside is that an invalid/spoofed file never reaches the volume
  (no transient write to clean up). For much larger uploads I'd stream to a temp
  file and validate that instead.
- `@file-type/cfbf` recognizes a `.doc` via a known CLSID database; an exotic or
  corrupted CFB whose CLSID isn't listed would be rejected. I accept that —
  failing closed is the right default for an upload gate.

**With more time**

- Run a virus/malware scan (e.g. ClamAV) on accepted files.
- Move storage off the app's local disk (S3/GridFS) — see the deployment note,
  since the host filesystem is ephemeral.

## 2. `datePosted` is stamped at first publish, not at creation

The spec says "Date Posted is auto-generated server-side — not trusted from the
client." The easy reading is "set it when the row is created," but that's wrong
for this lifecycle: a job starts as a **Draft**, which isn't visible to anyone.
A draft created Monday and published Friday should read as posted **Friday** —
that's the date applicants actually see it go live.

**How it works** ([`backend/src/models/Job.ts`](backend/src/models/Job.ts)):

- `datePosted` is **optional** and has no `default` — a draft simply doesn't have
  one.
- A `pre("save")` hook stamps it the first time the job is `published`:

  ```ts
  jobSchema.pre("save", function () {
    if (this.status === "published" && !this.datePosted) {
      this.datePosted = new Date();
    }
  });
  ```

- The `!this.datePosted` guard means it's set **once** and never moves on later
  saves (e.g. when the job is closed), so it always reflects when the job went
  live. A job created directly as `published` gets stamped on its first save.
- It's set with `new Date()` on the server, so the client can never forge it —
  satisfying the "not trusted from the client" requirement.

**Trade-off / caveat**

- Like the password-hashing hook, `pre("save")` only runs on document
  `.save()`/`.create()` — **not** on `findOneAndUpdate`/`updateOne`. So the
  publish endpoint loads the job, sets `status = "published"`, and `.save()`s it,
  rather than doing a query-level update. Keeping all status transitions on the
  document path is a deliberate constraint that also keeps this invariant honest.

## 3. How I handled socket room cleanup on disconnect

For the real-time "new application" notification, each connecting socket is
authenticated from its handshake JWT and joins a **private room keyed by the user
id** (`socket.join(user.id)`); the apply handler emits `new_application` to that
room (`io.to(job.employer).emit(...)`). See
[`backend/src/socket.ts`](backend/src/socket.ts).

**The cleanup decision: I rely on Socket.io's built-in room lifecycle rather than
tracking sockets myself.** When a socket disconnects, Socket.io automatically
removes it from every room it had joined, and a room with no remaining members
simply ceases to exist (rooms are ephemeral — they're not persisted anywhere).
Because I key rooms by the user id and keep **no manual `Map<userId, socket>`
registry**, there is nothing to tear down on disconnect and no way to leak a
stale room or a dangling socket reference.

This also handles the multi-connection case for free: an employer with several
tabs open has multiple sockets in the same `user.id` room, each leaves
independently when its tab closes, and the room disappears when the last one
disconnects. Emitting to the room reaches all of their tabs.

**Why not a manual registry?** The obvious alternative — storing `socketId` (or a
set of them) per user in a map — would force me to delete entries on `disconnect`,
handle the race where a user reconnects before the old socket's disconnect fires,
and clean up on errors. Rooms make all of that the adapter's problem, so the only
disconnect handling I need is *none*.

**With more time:** for horizontal scaling I'd add the Redis adapter
(`@socket.io/redis-adapter`) so rooms/emits work across multiple backend
instances — the room-keyed design carries over unchanged.

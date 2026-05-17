# Post-Audit Follow-Ups

Items discovered while fixing audit findings that are out of scope for the original finding but worth tracking.

- **S2 CREATE-path tightening** — the S2 fix locked the UPDATE branch of `match /users/{userId}` in `firestore.rules`. The CREATE branch (`allow create: if isOwner(userId)`) is still field-permissive: a user could in theory create their own user doc via the client SDK on first login with `role: "admin"` before the server overwrites. Today the signup flow is `signInWithPopup` / `signInWithEmailLink` only — no client-side user-doc creation — and the server's `getProfile` path overwrites, so the realistic exploit window is narrow. Worth tightening CREATE in a follow-up to forbid `role` / `clientId` / `email` fields entirely.

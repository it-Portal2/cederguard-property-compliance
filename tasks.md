# Tasks — cedarguard-compliance-suite

## To do (work top-down, one at a time)

- [ ] **Task 1 — Create `src/components/UserAvatar.tsx`.** New reusable component takes `photoURL?: string | null`, `displayName?: string | null`, `email?: string | null`, `size?: 'sm' | 'md' | 'lg'`, `className?: string`. Renders `<img src={photoURL}>` when a non-empty URL is supplied; falls back to initials badge (extracted from displayName → email → "U") on `onError` and on missing/empty URL. Uses gradient background matching the current Sidebar footer style (`oklch(0.7 0.13 60), oklch(0.55 0.17 25)`). No store reads — pure props. Done = file exists, exports default, `tsc --noEmit` + `build` clean.

- [ ] **Task 2 — Wire `UserAvatar` into `src/components/Header.tsx`.** Replace the inline avatar rendering at lines 582-590 with `<UserAvatar photoURL={user?.photoURL} displayName={user?.displayName} email={user?.email} size="sm" />`. Drop the inline `getInitials` helper if no other call site uses it (it's at lines 180-190 — check first). Done = Header renders avatar with onError fallback, gate clean.

- [ ] **Task 3 — Wire `UserAvatar` into `src/components/Sidebar.tsx`.** Replace the footer avatar block at lines 765-792 with the same `<UserAvatar />` invocation. Preserve the surrounding name/email caption markup. Done = Sidebar footer uses shared component, gate clean.

- [ ] **Task 4 — Wire `UserAvatar` into `src/components/MobileHeader.tsx`.** Replace the bare `<img>` at lines 58-59 with `<UserAvatar />`. Done = MobileHeader avatar has fallback, gate clean.

- [ ] **Task 5 — [NEEDS PLAN — touches useStore.ts] Ensure `photoURL` is always initialized on sign-up.** In [src/store/useStore.ts:2055-2087](src/store/useStore.ts#L2055), the auto-persist branch only fires when Firebase Auth supplies a photoURL (Google sign-ups). Extend it so magic-link sign-ups also write `photoURL: null` to their Firestore profile doc on first init, so the field always exists alongside the user data. Adopt explicit name `photoURL` (already canonical — do NOT introduce a parallel `avatarUrl` field). Propose plan first, wait for approval, then implement. Done = every new account has `photoURL` key in its Firestore profile doc, gate clean.

- [ ] **Task 6 — Auth security micro-hardening in [src/pages/Login.tsx](src/pages/Login.tsx) + [src/lib/firebase.ts](src/lib/firebase.ts).** Two narrow fixes:
  1. Map common Firebase error codes (`auth/invalid-email`, `auth/too-many-requests`, `auth/network-request-failed`, `auth/popup-closed-by-user`) to friendly user-facing copy in Login.tsx error display at line 210 — fall back to a generic "Something went wrong. Please try again." for anything else. No raw `err.message` to the UI.
  2. Add a 5-second client-side throttle on magic-link submits in Login.tsx (`useRef` last-submit timestamp). Disable the button + show "Please wait a few seconds before resending" if pressed again within the window.
  Done = no raw Firebase strings reach the UI, throttle works, gate clean.

- [ ] **Task 7 — [NEEDS PLAN — large single-file rewrite] Port the `CedarGuard-Auth (1).html` design to [src/pages/Login.tsx](src/pages/Login.tsx).** Exact copy of the provided HTML: two-pane shell (form pane + marketing aside), Geist/Geist Mono fonts (already loaded globally), all OKLCH custom properties, all responsive breakpoints (1100px / 880px / 560px / 380px), all copy text verbatim, animated mock dashboard tiles, footer compliance chips, divider, kbd hint, terms microcopy. Embed the CSS as a scoped `<style>` block inside the component (Login is on the typography exclusion list per CLAUDE.md Rule 9, so custom CSS is acceptable here). Wire the Google button to existing `loginWithGoogle()` and the email form to existing `sendMagicLink()` from [src/lib/firebase.ts](src/lib/firebase.ts). Preserve the magic-link confirmation flow (the page also handles `confirmMagicLink()` on landing back). Propose plan first, wait for approval, then implement. Done = pixel-faithful port, all responsive breakpoints work, Google + magic-link flows work end-to-end, gate clean.

## Log (filled in as tasks complete)

<!-- entries get added here as each task finishes -->

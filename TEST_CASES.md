# Manual QA — Project Initiation & Workspace Settings

Covers the cascading Programme Supervisor → Programme → PM selector on Project Initiation, the Workspace Settings Team/Org/Infrastructure tabs, and all role permutations.

---

## 0. Test accounts to prepare

Create one of each before starting. Use distinct emails so you can log out/in freely.

| Handle | Canonical role | How to create |
|---|---|---|
| `SA-1` | `super_admin` | Direct Firestore edit on user doc (`role: 'super_admin'`) after self-signup |
| `CA-1` | `client_admin` | Self-signup → `SA-1` promotes via Admin Panel → Users |
| `CA-2` | `client_admin` (different org) | Separate self-signup → `SA-1` promotes |
| `PM-1` | `project_manager` (senior) | Invited by `CA-1`, bound to Programme-A at invite time |
| `PM-2` | `project_manager` (standard) | Invited by `CA-1`, **no programmes bound** at invite time |
| `PM-3` | `project_manager` (standard) | Self-signup (no invite — organic) |
| `PM-4` | `project_manager` (assistant) | Invited by `CA-2`, bound to Programme-C |
| `V-1`  | `viewer` | Self-signup → promoted by `SA-1` to viewer |

Create at least these programmes first:
- **Programme-A** — owner `CA-1`, `assignedPMIds: [PM-1]`
- **Programme-B** — owner `CA-1`, `assignedPMIds: []` (empty roster)
- **Programme-C** — owner `CA-2`, `assignedPMIds: [PM-4]`

---

## 1. Self-signup defaults (PATH 1)

| # | As | Step | Expected |
|---|---|---|---|
| 1.1 | fresh self-signup | Sign up with new email | User doc written: `role: 'project_manager'`, `pmLevel: 'standard'`, `supervisorUid: null`, `clientId: self.uid` |
| 1.2 | `PM-3` | Open **Project Initiation** | All three cascade fields (Supervisor / Programme / PM) render empty |
| 1.3 | `PM-3` | Submit project with blank supervisor/programme/PM | Creation succeeds; project persists with `programmeManagerId: null`, `programmeId: null` |
| 1.4 | `PM-3` | Open the just-created project | Supervisor, Programme, PM fields all empty (null persisted cleanly) |
| 1.5 | `PM-3` | Inline hint shown on Project Initiation | "Ask your supervisor to add you to a programme, or create a project without a programme and link it later" |

---

## 2. PATH 2A — invited PM, inviter has zero programmes

Prep: `CA-1` invites a brand-new `PM-5` **before creating any programme** (if needed, temporarily delete CA-1's programmes or spin up a fresh CA).

| # | As | Step | Expected |
|---|---|---|---|
| 2.1 | `PM-5` | Accept invite and sign in | User doc: `role: 'project_manager'`, `supervisorUid: CA-1.uid`, `pmLevel` from invite |
| 2.2 | `PM-5` | Open **Project Initiation** → Step 1 | Supervisor dropdown shows exactly one entry: CA-1 |
| 2.3 | `PM-5` | Select CA-1 | Step 2 (Programme) dropdown is **empty** |
| 2.4 | `PM-5` | Step 2 shows hint | "Your supervisor hasn't created any programmes yet. You can create this project now and link it later." |
| 2.5 | `PM-5` | Step 3 (PM) dropdown with empty Step 2 | Empty — PM picker blank |
| 2.6 | `PM-5` | Submit with only supervisor set | Project created with `programmeManagerId: CA-1.uid`, `programmeId: null` |
| 2.7 | `PM-5` | After compliance + risk setup complete | `setupProgress` caps at **90** (not 100) because programmeId is null |
| 2.8 | `CA-1` | Create Programme-D, add PM-5 to roster | Programme-D exists with `PM-5.uid` in `assignedPMIds` |
| 2.9 | `PM-5` | Reload → edit the earlier project → link Programme-D | Save succeeds; `setupProgress` now reaches 100 |

---

## 3. PATH 2B — invited PM with programmes (full cascade)

| # | As | Step | Expected |
|---|---|---|---|
| 3.1 | `PM-1` | Open **Project Initiation** → Step 1 | Supervisor dropdown shows **only CA-1** (not CA-2, not SA-1) |
| 3.2 | `PM-1` | Select CA-1 → Step 2 | Programme dropdown shows **only Programme-A** (not Programme-B — PM-1 not rostered; not Programme-C — different org) |
| 3.3 | `PM-1` | Select Programme-A → Step 3 | PM dropdown lists everyone in Programme-A's `assignedPMIds` (at least PM-1 themselves) |
| 3.4 | `PM-1` | Change Step 1 to some other supervisor | Step 2 and Step 3 clear automatically (no stale ids in formData — verify via devtools) |
| 3.5 | `PM-1` | Change Step 2 to a different programme | Step 3 clears automatically |
| 3.6 | `PM-1` | Submit with all three set | Project payload includes `programmeManagerId`, `programmeId`, `projectManagerId` |
| 3.7 | `PM-1` | Reload project → open edit | Supervisor field populated (was dropped before the fix) |

### 3b. PM on multiple supervisors

Prep: `CA-2` also adds `PM-1` to Programme-C's roster via Admin Panel (super_admin bypass) OR via a fresh invite.

| # | As | Step | Expected |
|---|---|---|---|
| 3.8 | `PM-1` | Reopen Project Initiation → Step 1 | Supervisor dropdown now shows **two** entries: CA-1 and CA-2 |
| 3.9 | `PM-1` | Pick CA-2 → Step 2 | Only Programme-C shown |
| 3.10 | `PM-1` | Pick CA-1 → Step 2 | Only Programme-A (and Programme-D if added in 2.8) |

---

## 4. Role-based view of Project Initiation

| # | As | Step | Expected |
|---|---|---|---|
| 4.1 | `SA-1` | Project Initiation → Step 1 | Supervisor list = all supervisor-eligible users platform-wide |
| 4.2 | `SA-1` | Pick any supervisor → Step 2 | All programmes owned by that supervisor |
| 4.3 | `CA-1` | Project Initiation → Step 1 | Supervisor list includes own-org supervisors (and self) |
| 4.4 | `CA-1` | Step 2 | All programmes where CA-1 is creator (no roster restriction for CA+) |
| 4.5 | `PM-2` (no rosters) | Project Initiation → Step 1 | Shows CA-1 only (via `supervisorUid`), even though no programme roster |
| 4.6 | `PM-2` → Step 2 | Pick CA-1 | All of CA-1's programmes where PM-2 is rostered — which is **none** → empty dropdown + hint |
| 4.7 | `V-1` | Project Initiation | Route guarded; viewer cannot create project (`RoleGuard` blocks) |

---

## 5. Workspace Settings — Organisation tab

| # | As | Step | Expected |
|---|---|---|---|
| 5.1 | any role | Open Workspace Settings → Organisation | Card uses flat `rounded-xl` styling, white bg, subtle shadow — no glassmorphism |
| 5.2 | any role | Edit Legal Entity Name / Reg No / Address / Jurisdiction → Save | Toast-like "Saved" indicator appears; reload preserves values |
| 5.3 | resize to mobile | Page heading + description | Heading `text-2xl`, description full width (no `max-w-lg`), readable |
| 5.4 | Tab switcher | Horizontal scroll on narrow viewport | Tabs scroll horizontally, don't wrap or overflow |
| 5.5 | any | Enterprise Tier card | Indigo bg, `rounded-xl`, lists the three features |

---

## 6. Workspace Settings — Team tab (invite form)

| # | As | Step | Expected |
|---|---|---|---|
| 6.1 | `CA-1` | Open Team tab | Invite card on left, DynamicTable on right |
| 6.2 | `CA-1` | Click "PM Level" dropdown | 4 options: Senior / Standard / Assistant / Coordinator. **No** option for client_admin / super_admin / admin |
| 6.3 | `CA-1` | "Bind to programmes" section shows only CA-1's programmes | Programme-A, Programme-B visible; Programme-C (CA-2's) **not** visible |
| 6.4 | `CA-1` | Invite with no programmes bound | Success toast; invitation doc has `programmeIds: []` |
| 6.5 | `CA-1` | Invite with Programme-A bound | Success; invitation doc has `programmeIds: ['programme-a-id']` |
| 6.6 | `CA-1` | Invite with invalid email | Inline error "Please enter a valid email address" |
| 6.7 | invited user | Accept invite + sign in | Their user doc has `supervisorUid: CA-1.uid`; Programme-A's `assignedPMIds` contains them |
| 6.8 | `CA-1` | Helper text below invite form | "All invited users join as Project Managers. Role promotions happen after they sign in." |
| 6.9 | `PM-1` | Open Team tab (a PM, not an admin) | Invite form shows "You have no programmes yet" if PM doesn't own programmes (expected — PM can't own programmes) |
| 6.10 | privilege test | devtools: call `api.inviteProjectManager(email, name, 'standard', ['programme-c-id'])` as CA-1 | Server rejects with 403 — Programme-C isn't owned by CA-1 |

---

## 7. Workspace Settings — Team tab (DynamicTable)

| # | As | Step | Expected |
|---|---|---|---|
| 7.1 | `CA-1` | View team table | Columns: Member / Role / PM Level / Programmes / Status / Joined |
| 7.2 | `CA-1` | Member column | Avatar bubble `h-9 w-9`, name + email two-line |
| 7.3 | `CA-1` | Role column | Badge with canonical role (not raw granular string) |
| 7.4 | `CA-1` | PM Level column | Shows label only when canonical role is `project_manager`, else `—` |
| 7.5 | `CA-1` | Programmes column | Chips for up to 2 programmes + `+N` overflow with tooltip |
| 7.6 | `CA-1` | Status column | "Active" emerald badge or "Pending" amber badge |
| 7.7 | `CA-1` | Joined column | DD MMM YYYY format |
| 7.8 | `CA-1` | Pending invite row | Row greyed, Programmes cell `—`, row actions disabled |
| 7.9 | `CA-1` | Search "PM-1" | Filters to members matching name/email |
| 7.10 | `CA-1` | Role filter = "Project Manager" | Shows only PMs |
| 7.11 | `CA-1` | PM Level filter = "Senior" | Shows only PM-1 |
| 7.12 | `CA-1` | Status filter = "Pending" | Shows only pending invites |
| 7.13 | `CA-1` | Export XLSX | File downloads with all visible columns |

---

## 8. Workspace Settings — row actions

### 8a. Manage programmes

| # | As | Step | Expected |
|---|---|---|---|
| 8.1 | `CA-1` | Click row action on PM-1 → "Manage programmes" | Modal opens listing CA-1's programmes with checkboxes; Programme-A pre-checked |
| 8.2 | `CA-1` | Check Programme-B → Save | `addPMToProgramme('programme-b', PM-1.uid)` fires; toast "Programme assignments updated"; modal closes; row reflects both programmes |
| 8.3 | `CA-1` | Uncheck Programme-A → Save | `removePMFromProgramme` fires; row updates |
| 8.4 | `CA-1` | Save with no diff | No API calls made; modal closes silently |
| 8.5 | `CA-1` | During save | Form is `disabled` (fieldset greys out) |
| 8.6 | `CA-1` | Target is self-registered PM-3 → Manage programmes → add to Programme-A | Success; PM-3's `supervisorUid` backfilled to CA-1.uid (check Firestore) |
| 8.7 | privilege test | devtools: `api.addPMToProgramme('programme-c', PM-1.uid)` as CA-1 | Server 403 — Programme-C not in CA-1's org |

### 8b. Change role

| # | As | Step | Expected |
|---|---|---|---|
| 8.8 | `CA-1` | PM-1 row → "Change role" | Modal opens; dropdown shows **only** Project Manager and Client Admin (no super_admin option) |
| 8.9 | `CA-1` | Change PM-1 to Client Admin → Save | Success; PM-1 now canonical `client_admin`; row badge updates |
| 8.10 | `CA-1` | Try to open "Change role" on SA-1 row | Action hidden/disabled (client_admin can't touch super_admin) |
| 8.11 | `CA-1` | "Change role" action not visible on own row | Cannot change own role |
| 8.12 | `SA-1` | Change role modal | Dropdown shows 4 options: Project Manager / Client Admin / Super Admin / Viewer |
| 8.13 | `SA-1` | Promote PM-2 → Super Admin | Success; Activity log entry `admin_user_promoted` |
| 8.14 | privilege test | devtools: `api.adminPromoteUser(PM-1.uid, 'super_admin')` as CA-1 | Server 403 |
| 8.15 | `PM-1` (non-admin) | Team tab row actions | "Change role" **not** visible |

### 8c. Change PM level

| # | As | Step | Expected |
|---|---|---|---|
| 8.16 | `CA-1` | PM-1 row → "Change PM level" | Modal opens with 4 levels |
| 8.17 | `CA-1` | Set PM-1 to Assistant → Save | Success; row badge updates; Activity log `pm_level_updated` |
| 8.18 | `CA-1` | Row where member is client_admin | "Change PM level" action **hidden** (only visible when canonical role is project_manager) |
| 8.19 | `PM-3`'s own supervisor (CA-1 after backfill) | Change PM-3's pmLevel | Allowed — caller is `supervisorUid` of target |
| 8.20 | unrelated user | devtools: `api.setPmLevel(PM-3.uid, 'senior')` | 403 |

### 8d. Remove from team

| # | As | Step | Expected |
|---|---|---|---|
| 8.21 | `CA-1` | PM-1 row → "Remove from team" | Confirm dialog with danger variant, `UserMinus` icon, "Remove" label |
| 8.22 | `CA-1` | Confirm | `clientRemoveUser` fires; toast "Team member removed"; row disappears; table reloads |
| 8.23 | `CA-1` | Row where target is SA-1 | "Remove" action **not** visible (cannot remove super_admin) |
| 8.24 | `CA-1` | Own row | "Remove" action not visible (cannot remove self) |
| 8.25 | `CA-1` | Pending invite row → Remove | Action behaviour on pending rows (confirm action is disabled or reroutes to cancel-invite) |

---

## 9. Workspace Settings — Infrastructure tab

| # | As | Step | Expected |
|---|---|---|---|
| 9.1 | any | Open Infrastructure tab | Uses shared `StatsCard` from `common/` — NOT the admin `StatCard` |
| 9.2 | any | Three stat tiles | Active Programmes (indigo icon), Live Projects (emerald icon), Integrity Status (blue icon) |
| 9.3 | any | Cards fill page width | No empty gutter on right — width matches the page `max-w-7xl` (this was just fixed) |
| 9.4 | any | "Critical Intervention" Factory Reset card | Rose-600 bg, `rounded-xl`, button `rounded-xl`, reads "Reset Workspace Data" |
| 9.5 | any | Click Reset Workspace Data | Browser `window.confirm` opens with warning |
| 9.6 | any | Accept first prompt | Second `window.prompt` requests typing `RESET` |
| 9.7 | any | Type wrong value e.g. "reset" | "Reset Cancelled" notification; no data deleted |
| 9.8 | any | Type exactly `RESET` | `resetAllData()` runs; "Workspace Reset" notification; tab switches back to Organisation |
| 9.9 | any | Cloud Infrastructure Topology card | Dark slate bg, 4 cells (Primary Region / Active Resilience / Encryption / Compliance Mesh), `rounded-xl` |
| 9.10 | any | SLA footer | "Service Level Agreement: 99.99% Guaranteed" + NODE_ID |

---

## 10. Admin Panel — super_admin actions

| # | As | Step | Expected |
|---|---|---|---|
| 10.1 | `SA-1` | Admin Panel → Users tab → PM-3 row | "Reassign supervisor" action visible |
| 10.2 | `SA-1` | Reassign supervisor → CA-2 | PM-3's `supervisorUid` updated to CA-2.uid; cross-org is allowed |
| 10.3 | `PM-3` | Reload → Project Initiation → Step 1 | Now shows CA-2 as supervisor |
| 10.4 | `SA-1` | Reassign PM-3 supervisor → null | Step 1 empty again for PM-3 (unless rostered elsewhere) |
| 10.5 | `SA-1` | "Manage programme rosters" action on a user | Modal lists **every** programme platform-wide (super_admin bypass), not just caller's org |
| 10.6 | `SA-1` | Add PM-1 to Programme-C (different org) | Success; Programme-C's `assignedPMIds` includes PM-1 |
| 10.7 | `PM-1` | Reload → Step 1 | CA-2 now appears as a second supervisor |
| 10.8 | `SA-1` | `adminTransferProject` to user in different org | Project's `clientId` updates to new owner's clientId (side-fix); new owner can read the project |
| 10.9 | `SA-1` | `adminTransferProgramme` cross-org | Programme's `clientId` updates; new owner can read |
| 10.10 | `CA-1` | Try cross-org action via devtools | 403 — client_admin can only touch same-clientId targets |

---

## 11. Activity log verification

Trigger each action, then open Admin Panel → Activity tab. Confirm each entry renders with the correct coloured badge and label (from `ACTIVITY_ICONS`).

| # | Trigger | Expected log `type` | Label shown |
|---|---|---|---|
| 11.1 | `SA-1` reassigns supervisor | `admin_supervisor_assigned` | "Supervisor Assigned" (indigo) |
| 11.2 | `CA-1` uses clientAssignSupervisor | `supervisor_assigned` | "Supervisor Linked" (sky) |
| 11.3 | `CA-1` adds PM to programme | `pm_added_to_programme` | "PM Added to Programme" (emerald) |
| 11.4 | `CA-1` removes PM from programme | `pm_removed_from_programme` | "PM Removed from Programme" (amber) |
| 11.5 | `SA-1` promotes user | `admin_user_promoted` | "Role Changed" (violet) |
| 11.6 | `CA-1` changes PM level | `pm_level_updated` | "PM Level Changed" (slate) |
| 11.7 | any | Entry payload has `uid`, `email`, `timestamp`, and type-specific fields | Verify via Firestore `activityLogs` collection |

---

## 12. Persistence, reloads, and edge cases

| # | Scenario | Expected |
|---|---|---|
| 12.1 | Create project with `programmeManagerId` + `programmeId` + `projectManagerId`; reload | All three fields still populated |
| 12.2 | Stale uid — PM deleted after being rostered | Programmes column silently drops the uid; no crash |
| 12.3 | Programme deleted after PM was rostered via invite `programmeIds` | Invitation consumption skips silently, no 500 |
| 12.4 | Old programme doc without `assignedPMIds` field | `getPMsAssignedToProgramme` returns `[]`; no 500 |
| 12.5 | Legacy invitation doc with `role: 'client_admin'` (pre-plan) | Consumed as `project_manager` (downgraded); no client_admin escalation |
| 12.6 | Create project with `projectManagerId = PM-B` where PM-B not rostered on selected programme | PM-B auto-rostered (`assignedPMIds` includes PM-B after create) |
| 12.7 | Dark mode toggle on Workspace Settings | Cards read correctly in dark mode |
| 12.8 | Mobile viewport (< 640px) | Tabs horizontally scroll; cards stack; heading `text-2xl`; no overflow |
| 12.9 | Network offline mid-modal save | Error toast; modal stays open; no optimistic data corruption |

---

## 13. Setup-progress gate

| # | Step | Expected `setupProgress` |
|---|---|---|
| 13.1 | Project created without programme | 25 (initial) |
| 13.2 | Compliance profiler finished | 75 |
| 13.3 | Risk setup finalised — **programmeId still null** | **90** (not 100) |
| 13.4 | Later: programme linked via edit | 100 |
| 13.5 | Project created with programmeId set from the start → finalise | 100 straight through |

---

## 14. Backend authz smoke (curl / devtools)

Run these as each caller role with browser devtools `api.*` calls. Every "expect 403" must not leak data in the body.

| # | Caller | Call | Expected |
|---|---|---|---|
| 14.1 | `PM-1` | `api.addPMToProgramme('programme-c-id', PM-2.uid)` | 403 (not owner, not CA of that org) |
| 14.2 | `CA-1` | `api.addPMToProgramme('programme-c-id', PM-2.uid)` | 403 (different clientId) |
| 14.3 | `SA-1` | same call | 200 (super_admin bypass) |
| 14.4 | `PM-1` | `api.adminPromoteUser(PM-2.uid, 'super_admin')` | 403 |
| 14.5 | `CA-1` | `api.adminPromoteUser(PM-2.uid, 'super_admin')` | 403 (client_admin can't mint super_admin) |
| 14.6 | `CA-1` | `api.adminAssignSupervisor(PM-2.uid, SA-1.uid)` | 403 (endpoint is super_admin-only) |
| 14.7 | `CA-1` | `api.clientAssignSupervisor(PM-2.uid, CA-2.uid)` | 403 (CA-2 is different org) |
| 14.8 | `CA-1` | `api.setPmLevel(PM-4.uid, 'senior')` | 403 (PM-4 is in CA-2's org) |
| 14.9 | `PM-1` | `api.getPMsAssignedToProgramme('programme-a-id')` | 200, returns PM profiles (rostered reads allowed) |
| 14.10 | `PM-1` | `api.getPMsAssignedToProgramme('programme-c-id')` | 403 (not in clientId, not rostered) |

---

## 15. Visual regression checklist

| # | Page | Expected |
|---|---|---|
| 15.1 | Workspace Settings heading | `text-2xl sm:text-3xl font-black`, icon `rounded-xl`, truncates on narrow |
| 15.2 | All primary cards | `rounded-xl`, `bg-white`, `border border-slate-200`, `shadow-sm` — no `rounded-[40px]`, no `backdrop-blur-xl`, no `shadow-2xl` |
| 15.3 | Primary buttons (Save, Send, Reset) | `rounded-xl`, `px-6 py-3`, `text-xs font-black`, `shadow-sm` |
| 15.4 | Infrastructure stat tiles | Use `StatsCard` from `common/`, indigo/emerald/blue icon palette, per-card icon bg `bg-{color}-50` with `border-{color}-100` |
| 15.5 | Team tab DynamicTable | Matches other pages' DynamicTable (RiskRegister, ProgrammeRiskRegister) |
| 15.6 | Infrastructure tab container | No `max-w-5xl` cap — fills to page `max-w-7xl` |

---

## 16. Sign-off

- [ ] Sections 1–4 (cascade) pass for all three paths
- [ ] Sections 5–9 (Workspace Settings) pass for each tab
- [ ] Section 10 (Admin actions) pass
- [ ] Section 11 (Activity log) — all 6 types render correctly
- [ ] Section 12 (edge cases) — no crashes
- [ ] Section 13 (setupProgress) — gates at 90 correctly
- [ ] Section 14 (authz) — no 403 leaks data
- [ ] Section 15 (visuals) — no leftover glassmorphism
- [ ] `npx tsc --noEmit` exits 0

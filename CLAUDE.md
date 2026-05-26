Always read this entire file before starting any task.
# CLAUDE.md — Cedar Property Compliance

Project: `cedarguard-compliance-suite` — a compliance and risk management SaaS for the built environment (construction/property sector). Multi-tenant, role-gated, AI-assisted.

---

## Working Protocol — read before doing anything

### `tasks.md` is the source of truth for progress
- All multi-step work is tracked in `tasks.md` in the repo root (a checklist + a log).
- ALWAYS read `tasks.md` before starting work, and resume from the first unchecked `[ ]` item.
- You have NO memory between sessions — `tasks.md` is your memory. A task is not "done" until it is written there. Do not rely on conversation history surviving; assume it won't.

### Work one task at a time
For each task in `tasks.md`, in order:
1. Implement ONLY that task. Do not start the next one.
2. Run the verification gate: `npx tsc --noEmit` AND `npm run build`. Both must exit clean.
3. Commit locally per the Standing Rules below (no push, no `--no-verify`, no model names / co-authored-by footer).
4. Mark the task `[x]` in `tasks.md` and add a one-line entry under `## Log`: what changed + which files.
5. Only then move to the next task.
If anything is blocking or ambiguous, STOP and ask — do not guess.

### Plan before non-trivial work
- Anything touching 3+ files, `useStore.ts`, `api.ts`, `aiService.ts`, or `riskMetrics.ts` → propose a plan first (plan mode) and wait for approval before editing.
- One-sentence-diff rule: if you can describe the change in a single sentence, skip the plan and just do it.

### Context hygiene
- After finishing a task or milestone, expect the session to `/compact` or `/clear`. Keep `tasks.md` current at all times so a fresh session with zero context can pick up exactly where you stopped.

---

## Tech Stack

### Frontend
| Package | Version | Role |
|---|---|---|
| react | ^19.0.0 | UI framework |
| react-dom | ^19.0.0 | DOM renderer |
| react-router | ^7.13.1 | Client-side routing (v7 — uses `<Route>` directly, not `createBrowserRouter`) |
| zustand | ^5.0.11 | Global state management |
| tailwindcss | ^4.1.14 | Utility-first CSS (v4 — uses Vite plugin, no `tailwind.config.js`) |
| @tailwindcss/vite | ^4.1.14 | Vite integration for Tailwind v4 |
| clsx | ^2.1.1 | Conditional class names |
| tailwind-merge | ^3.5.0 | Merge conflicting Tailwind classes |
| lucide-react | ^0.546.0 | Icon set |
| motion | ^12.23.24 | Animation library (Framer Motion v12) |
| recharts | ^3.7.0 | Chart components |
| react-hot-toast | ^2.6.0 | Toast notifications |
| date-fns | ^4.1.0 | Date utilities |
| html2canvas | ^1.4.1 | DOM-to-image for reports |
| jspdf | ^4.2.0 | PDF generation |
| xlsx | ^0.18.5 | Excel export |

### Backend (Serverless — Vercel)
| Package | Version | Role |
|---|---|---|
| express | ^4.21.2 | HTTP handler (single entry point) |
| firebase | ^12.10.0 | Client SDK (auth + Firestore) |
| firebase-admin | ^13.7.0 | Admin SDK (server-side Firestore) |
| @google/genai | ^1.29.0 | Gemini AI API |
| better-sqlite3 | ^12.4.1 | SQLite (used in tests/local only) |
| dotenv | ^17.2.3 | Env var loading |

### AI
- **Google Gemini** via `@google/genai` — compliance analysis, risk identification, control suggestions, AI writer

### Build / Dev Tools
| Package | Role |
|---|---|
| vite ^6.2.0 | Build tool and dev server (port 3000) |
| @vitejs/plugin-react ^5.0.4 | React fast-refresh |
| vite-plugin-pwa ^1.2.0 | PWA manifest and service worker |
| typescript ~5.8.2 | Type checking |
| vitest ^4.1.2 | Test runner |
| @vitest/ui | Vitest browser UI |
| tsx ^4.21.0 | TypeScript execution for scripts |
| autoprefixer ^10.4.21 | PostCSS autoprefixer |

### Infrastructure
- **Firebase**: Auth, Firestore (database), Firebase Cloud Messaging (push notifications)
- **Vercel**: Deployment (`vercel.json` present)
- **PWA**: Service worker via vite-plugin-pwa

### Key commands
| Command | Purpose |
|---|---|
| `npm install` | Install deps |
| `npm run dev` | Dev server on port 3000 |
| `npx tsc --noEmit` | Type-check (the canonical "is it broken" gate — runs in ~1-2s) |
| `npm run build` | Production build (~6s; chunk-size warning on `index-*.js` is pre-existing and accepted) |
| `npm run test` | Vitest — only `api/__tests__/context.test.ts` + `dispatcher.test.ts` exist; no UI tests |

**Verification gate** for any non-trivial change: run `npx tsc --noEmit` AND `npm run build` before committing. Both must exit clean.

### Config Files
| File | Purpose |
|---|---|
| `tsconfig.json` | Target ES2022, `@/*` path alias pointing to repo root, bundler resolution |
| `vite.config.ts` | React + Tailwind + PWA plugins; manual chunk splits (vendor/firebase/utils/viz/docs/ai) |
| `vitest.config.ts` | Node env, globals, v8 coverage, tests in `api/__tests__/**` and `src/__tests__/**` |
| `firebase.json` | Firebase deployment config |
| `firestore.rules` | Firestore security rules |
| `firestore.indexes.json` | Custom composite index definitions |
| `.firebaserc` | Firebase project reference |
| `vercel.json` | Vercel deployment config |

---

## Current File Structure

### Root
```
/src/main.tsx                         Bootstrap: React root, PWA registration, global error handler
/src/App.tsx                          Router: authenticated vs public layout, all route definitions
/src/index.css                        Global CSS resets and Tailwind base
```

### `/src/components/` — Shared UI components

#### Navigation & Layout
```
Header.tsx            (367 lines)   Top header: project/programme switcher, notifications bell, user menu
Sidebar.tsx           (367 lines)   Left nav: role-gated menu groups, auto-collapse on route change
MobileHeader.tsx                    Mobile-specific top header variant
MobileNav.tsx                       Mobile bottom navigation bar
ServiceManagementBar.tsx (298 lines) Banner showing last compliance/risk analysis run timestamps
PublicationChecklist.tsx (402 lines) Pre-publication validation checklist modal
```

#### Auth & Guards
```
AuthProvider.tsx                    Firebase auth state watcher; calls store.initStore() on login
RoleGuard.tsx                       Wrapper that blocks render unless user meets role requirement
ChecklistGate.tsx                   Blocks action until setup checklist is complete
ErrorBoundary.tsx                   Top-level React error boundary
```

#### Modals & Forms
```
ProfileSettingsModal.tsx            User profile + preferences settings modal
IssueModal.tsx        (527 lines)   Issue create/edit form modal
RiskModal.tsx         (620 lines)   Risk create/edit form modal (largest modal)
KRIModal.tsx                        Key Risk Indicator management modal
MilestoneManager.tsx  (475 lines)   Milestone tracking with history timeline
DeliveryTeamCRUD.tsx                Team member add/edit/remove UI
DetailsModal.tsx                    Generic read-only details display modal
```

#### AI Components
```
AIErrorAlert.tsx                    Displays structured AI/API error messages
AIInquiryPopup.tsx                  Chat-style AI inquiry popup
AIWriter.tsx                        AI content generation interface (drafting text)
```

#### Misc
```
NotificationWrapper.tsx             react-hot-toast provider wrapper
InfoTooltip.tsx                     Hover tooltip component
UserAvatar.tsx                      Shared user avatar: renders <img src={photoURL}> with onError
                                    fallback to a gradient initials badge. Three sizes (sm/md/lg).
                                    SINGLE SOURCE OF TRUTH for avatar rendering — Header, Sidebar,
                                    MobileHeader all consume this. Never inline an <img photoURL>
                                    in new code; always use <UserAvatar/>.
```

#### `/src/components/dashboard/` — Dashboard primitives (v4-calibrated)
```
ActivityTimeline.tsx                Recent activity feed with All/Risks/Issues tabs
AIFollowUpPrompts.tsx               AI follow-up chip strip below the AI panel
AnimatedCounter.tsx                 motion-driven count-up for KPI bignums
ComplianceVelocityChart.tsx         Recharts stacked bar + trend line; range pills 7/30/90;
                                    buckets by `stage` (live/archived/in progress)
MiniSparkline.tsx                   38px sparkline used in KPI cards
RibaTimeline.tsx                    Horizontal stage rail (S0..S5) for project view
RiskBurnDown.tsx                    "Risk outlook · next 90 days" — data-driven projection
                                    using top-3 risks + tolerance line + real milestones
RiskCallout.tsx                     Critical-risk callout (uses calculateMatrixScore +
                                    SEVERE_SCORE_THRESHOLD from riskMetrics.ts)
ShimmerSkeleton.tsx                 Animated shimmer placeholder
```
These are the canonical typography references. Match their class strings when porting KPI
tiles / status chips / table headers / sparklines to other pages.

#### `/src/components/admin/` — Admin-only sub-components
```
OverviewTab.tsx       (329 lines)   Admin dashboard overview cards
UsersTab.tsx                        User list management (role, deactivation)
ActivityTab.tsx                     Activity log viewer with filters
ProjectsTab.tsx       (615 lines)   Project list with search, filter, admin actions
PricingTab.tsx                      Pricing config editor
MappingManager.tsx                  AI system mapping directives editor
RegulationManager.tsx (594 lines)   Regulation library CRUD editor
constants.tsx                       Admin UI configuration constants
DetailsModal.tsx                    Admin-specific details modal
```

#### `/src/components/compliance/`
```
ComplianceQuestionnaire.tsx         Multi-phase compliance profiler questionnaire form
AnalysisSummary.tsx   (407 lines)   Displays AI compliance analysis results with scoring
```

#### `/src/components/common/`
```
EmptyState.tsx                      Reusable empty state placeholder (icon + message)
PremiumAIBanner.tsx                 Upgrade prompt banner for AI features
```

#### `/src/components/public/`
```
PublicLayout.tsx      (281 lines)   Layout wrapper for all public-facing pages
```

#### `/src/components/table/` — Canonical table primitives
```
DynamicTable.tsx                    SINGLE SOURCE OF TRUTH for tabular list pages.
                                    Built-in search, filters, sort, pagination,
                                    selection, bulk + row actions, ConfirmDialog,
                                    skeleton, CSV/XLSX export, sticky header,
                                    column-visibility, virtualization.
ConfirmDialog.tsx                   Confirmation modal — invoked automatically by
                                    DynamicTable when a RowAction / BulkAction
                                    sets `requireConfirm`. Do NOT roll your own
                                    confirm modal in a page.
TableToolbar.tsx                    Toolbar: search input, filter dropdowns,
                                    column visibility, export, inline bulk
                                    actions, custom `toolbarActions` slot.
TableHeader.tsx / TableBody.tsx /
TableRow.tsx / TableCell.tsx        Internal renderers used by DynamicTable.
TableActions.tsx                    Per-row action menu (uses RowAction defs).
TableBulkBar.tsx                    Floating selection bar (style: 'bar' actions).
TablePagination.tsx                 Page controls + page-size selector.
TableSkeleton.tsx                   Loading state placeholder.
TableTooltip.tsx                    Tooltip used for truncated cells.
types.ts                            Public types: ColumnDef, RowAction,
                                    BulkAction, FilterDef, ConfirmConfig,
                                    PaginationConfig, DynamicTableProps.
useTableState.ts                    Hooks: useTableFilter, useTableSort,
                                    useTablePagination, useTableSelection,
                                    useTableColumns. Internal to DynamicTable.
```

---

### `/src/pages/` — Route-level page components

#### Core
```
Dashboard.tsx         (1281 lines)  Main dashboard: portfolio KPIs, strategic insights, AI summary
Login.tsx                           Firebase email/password login form
Landing.tsx           (826 lines)   Public marketing landing page
```

#### Compliance
```
ComplianceSetup.tsx   (2301 lines)  LARGEST FILE: multi-phase compliance profiler (state + AI + UI)
ComplianceDashboard.tsx             Compliance items overview with status cards
ComplianceTracker.tsx (1237 lines)  Compliance item table with inline editing and filters
ComplianceProfiler.tsx              Compliance profiling tool entry point
ComplianceAlerts.tsx                Compliance breach/alert viewer
LinkedRegs.tsx                      View regulations linked to compliance items
EvidenceDocuments.tsx               Evidence document upload and management
```

#### Risk Management
```
RiskSetup.tsx         (951 lines)   Risk profiler + KRI setup wizard (multi-phase)
RiskDashboard.tsx     (832 lines)   Risk overview: heatmap, by-category charts, KRI status
RiskRegister.tsx                    Risk register table with sorting/filtering
RiskTracker.tsx                     Risk monitoring and status tracking
RiskAlerts.tsx                      Risk threshold breach alert viewer
RiskIssues.tsx                      Issues linked to risks
AIRiskID.tsx          (802 lines)   AI-powered risk identification workflow
RiskIdentifier.tsx                  Manual risk identifier tool
RiskAggregation.tsx                 Portfolio-wide risk aggregation view
```

#### Monitoring & Reporting
```
KRITracker.tsx                      Key Risk Indicator tracking and threshold management
TrendsHeatmaps.tsx                  Risk and compliance trend heatmaps over time
ExecutiveReport.tsx                 Executive summary report (exportable PDF)
ProjectReport.tsx     (834 lines)   Project-specific report with charts
ProgrammeReport.tsx                 Programme-level report
ClientProgrammeReport.tsx           Client-facing programme report view
```

#### Programme Management
```
Programmes.tsx                      List all programmes with status cards
ProgrammeInitiation.tsx (1069 lines) Create/edit programme form (large, multi-section)
ProgrammeSetup.tsx                  Initial programme setup flow
ProgrammeContext.tsx                Programme context configuration
ProgrammeRiskRegister.tsx (768 lines) Programme-level risk register table
ProgrammeIssues.tsx                 Programme-level issue tracker
```

#### Project Management
```
Projects.tsx                        List all projects (cards/table view)
ProjectInitiation.tsx (986 lines)   Create/edit project form (multi-section)
ProjectPlan.tsx                     Project planning and milestone view
NewProgramme.tsx                    New programme creation wizard
```

#### Administrative
```
AdminPanel.tsx                      Admin dashboard container (tabs: users, activity, projects, pricing)
ClientTeamPanel.tsx                 Client team management (invite PMs, assign roles)
WorkspaceSettings.tsx               Workspace/organisation settings
BillingPanel.tsx                    Billing overview and subscription info
InvoiceManager.tsx    (1030 lines)  Invoice CRUD with PDF generation
Invoices.tsx                        Invoice list viewer (client view)
CostCalculator.tsx                  Fee/cost calculation tool
```

#### AI & Intelligence
```
AIControlSuggestions.tsx            AI-suggested control measures for risks
AIComplianceOutlook.tsx             AI compliance forecasting and outlook
```

#### Learning & Support
```
RegulationLibrary.tsx (802 lines)   Searchable regulation library with detail panels
CPDTraining.tsx                     CPD training module viewer
LessonsLearned.tsx                  Lessons learned tracker and logger
HelpCenter.tsx                      In-app help documentation
Calendar.tsx          (1189 lines)  Event calendar (compliance deadlines, milestones)
```

#### Developer
```
DeveloperSettings.tsx               API key generation and management
APIDocs.tsx                         In-app API documentation viewer
MyTasks.tsx                         Personal task list for logged-in user
```

#### `/src/pages/public/` — Public marketing pages
```
About.tsx             About the company
Contact.tsx           Contact form page
Product.tsx           Product feature page
News.tsx              News article list
NewsArticle.tsx       Individual news article
Support.tsx           Support/FAQ page
```

---

### `/src/store/`
```
useStore.ts           (2000+ lines) Single Zustand store: all app state, API calls, derived selectors
```

### `/src/lib/`
```
api.ts                (188 lines)  API client: all frontend→backend calls via action-dispatch pattern
firebase.ts           (81 lines)   Firebase client init, auth helpers (signIn, signOut, onAuthChange)
roles.ts              (119 lines)  Role hierarchy helpers (isAtLeastClientAdmin, isSuperAdmin, etc.)
utils.ts                           Utility functions: ID generation, date formatting, markdown stripping
riskMetrics.ts                     Shared risk-score / ALE helpers + thresholds — SINGLE SOURCE OF TRUTH for
                                   getGrossScore / getResidualScore / getGrossALE / getResidualALE /
                                   SEVERE_SCORE_THRESHOLD (= 19) / MAJOR_SCORE_THRESHOLD (= 12). Used by
                                   Dashboard, RiskBurnDown, RiskCallout, AIInquiryPopup.
```

### `/src/services/`
```
aiService.ts          (300+ lines) AI prompt construction and response parsing (compliance + risk)
api/cpdContent.ts                  CPD content fetch service
```

### `/src/data/` — Static seed/library data
```
complianceData.ts                  100+ compliance item definitions with metadata
complianceQuestions.ts             Questionnaire phase definitions (questions, options, weights)
complianceRegisterData.ts          Sample compliance register entries
riskData.ts                        Risk category definitions, KRI templates, sample risks
regulationsLibraryData.ts          Regulations library reference data
newsData.ts                        Static news articles data
```

### `/src/constants/`
```
ribaStages.ts                      RIBA project stage definitions (0–7)
```

### `/src/utils/`
```
complianceCategorization.ts        Logic for categorising compliance items by domain/type
```

### `/api/` — Backend (Vercel serverless)
```
index.ts                           Express entry point: CORS, auth header extraction, action dispatcher
lib/context.ts        (345 lines)  Firebase Admin init, ApiContext creation, multi-tenancy authZ
routes/index.ts                    Aggregates all route handler maps
routes/auth.ts                     API key generate/revoke, user account deletion
routes/ai.ts          (165 lines)  Gemini calls with retry, dual-key fallback, quota handling
routes/compliance.ts  (62 lines)   Compliance library CRUD (admin-only writes)
routes/projects.ts                 Project CRUD with multi-tenancy authorization
routes/programmes.ts  (47 lines)   Programme CRUD with ownership checks
routes/admin.ts                    Super-admin operations: stats, users, activity, invoices
routes/data.ts                     Generic save/getData for all Firestore collections
routes/profile.ts                  User profile get/save, preferences
routes/team.ts                     Team member management, role assignment, PM invites
routes/notifications.ts            FCM push notification registration
__tests__/context.test.ts          Tests for API context creation
__tests__/dispatcher.test.ts       Tests for action route dispatching
```

---

## Problem Areas

### Oversized Files (urgent)
| File | Lines | Core issue |
|---|---|---|
| `src/pages/ComplianceSetup.tsx` | **2301** | 4-phase form mixing UI, form state, AI API calls, data transformation, and result display all in one file |
| `src/store/useStore.ts` | **2000+** | Single store with 100+ state properties, 50+ methods, data-fetching logic, and derived selectors — impossible to test in isolation |
| `src/pages/Dashboard.tsx` | **1281** | Portfolio overview + AI strategic insights + complex data loading + charts all colocated |
| `src/pages/ComplianceTracker.tsx` | **1237** | Table rendering, inline editing, filter state, and API persistence mixed together |
| `src/pages/Calendar.tsx` | **1189** | Full calendar with event CRUD, compliance deadline sync, and modal management |
| `src/pages/ProgrammeInitiation.tsx` | **1069** | Multi-section form: validation, state, API calls, role checks all inline |
| `src/pages/InvoiceManager.tsx` | **1030** | Invoice CRUD + PDF generation + permission checks in one component |
| `src/pages/ProjectInitiation.tsx` | **986** | Same pattern as ProgrammeInitiation |
| `src/pages/RiskSetup.tsx` | **951** | Multi-phase risk profiler with embedded AI calls |

### Mixed Concerns (UI + State + API in one file)
- **ComplianceSetup.tsx**: Should be split into Phase1Form/Phase2Form/Phase3Form components, a `useComplianceQuestionnaire` hook, and a results display component.
- **Dashboard.tsx**: AI insight generation, data loading, and rendering should be separated.
- **All large pages**: Pattern of `useState` for form + direct `api.*` calls inside handlers + conditional render logic — no separation layer.
- **useStore.ts**: Mixes UI state (`isDarkMode`, `isSidebarOpen`) with domain data (`risks`, `complianceItems`) with API calls (`saveData`, `fetchProjects`) in a single flat object.

### Duplicate Logic
- **Compliance item filtering**: `ComplianceDashboard.tsx` and `ComplianceTracker.tsx` both implement identical filter logic by project, status, and domain — no shared hook or selector.
- **Risk status badge colours**: Colour maps for risk severity defined inline in multiple pages instead of a shared constant.
- **API error handling**: Each page has its own try/catch error display pattern; no centralised error handler.
- **Role/permission checks**: Frontend role checks repeated across pages instead of being encapsulated in hooks or the existing `RoleGuard`.
- **URL ↔ store sync**: At least 4 pages manually sync `searchParams.get('projectId')` with `setActiveProjectId` in separate `useEffect` calls — identical pattern repeated, could be one hook.

### Other Issues
- No `/src/hooks/` directory — custom hooks are either non-existent or embedded in components.
- AI prompt strings (~100 lines each) hardcoded in `aiService.ts` with manual JSON healing (`parseAIResponse`) — fragile and untestable.
- Only 2 test files exist for the entire application (`context.test.ts`, `dispatcher.test.ts`) — no component tests, no store tests, no utility tests.
- Magic numbers and status strings scattered (e.g., timeout `120000`, statuses `'Verified'`/`'Pending'`/`'Open'`) instead of named constants.
- `api/lib/context.ts` duplicates authorization logic that overlaps with `firestore.rules`.

---

## State Management

All global state lives in a **single Zustand store** at `src/store/useStore.ts`. Components read state with `const { x, setX } = useStore()`.

### Auth & Identity
| State Variable | Type | File |
|---|---|---|
| `user` | `any` (Firebase User) | useStore.ts |
| `isInitialized` | `boolean` | useStore.ts |
| `clientId` | `string \| null` | useStore.ts |
| `deferredPrompt` | `any` (PWA install event) | useStore.ts |

### UI / Theme
| State Variable | Type | File |
|---|---|---|
| `isDarkMode` | `boolean` | useStore.ts |
| `isMarketingDarkMode` | `boolean` | useStore.ts |
| `isSidebarOpen` | `boolean` | useStore.ts |
| `isProfileSettingsOpen` | `boolean` | useStore.ts |
| `isMobileMenuOpen` | `boolean` | useStore.ts |

### Project / Programme Context
| State Variable | Type | File |
|---|---|---|
| `activeProject` | `Project \| null` | useStore.ts |
| `activeProgramme` | `Programme \| null` | useStore.ts |
| `activeProjectId` | `string \| null` | useStore.ts |
| `activeProgrammeId` | `string \| null` | useStore.ts |
| `projects` | `Project[]` | useStore.ts |
| `programmes` | `Programme[]` | useStore.ts |
| `currentProject` | `any` | useStore.ts |
| `projectInfo` | `any` | useStore.ts |
| `portfolioInfo` | `any` | useStore.ts |

### Compliance Data
| State Variable | Type | File |
|---|---|---|
| `complianceItems` | `ComplianceItem[]` | useStore.ts |
| `complianceAnalysis` | `any \| null` | useStore.ts |
| `customRegulations` | `RegulationItem[]` | useStore.ts |
| `remoteDomains` | `any[]` | useStore.ts |
| `lastAnalysisResults` | `any \| null` | useStore.ts |
| `isComplianceLocked` | `boolean` | useStore.ts |

### Risk Management
| State Variable | Type | File |
|---|---|---|
| `risks` | `RiskItem[]` | useStore.ts |
| `issues` | `IssueItem[]` | useStore.ts |
| `kris` | `KRI[]` | useStore.ts |
| `suggestedRisks` | `any` | useStore.ts |
| `strategicRiskAnalysis` | `any \| null` | useStore.ts |

### Notifications & Alerts
| State Variable | Type | File |
|---|---|---|
| `notifications` | `AppNotification[]` | useStore.ts |
| `acknowledgedAlerts` | `string[]` | useStore.ts |
| `snoozedAlerts` | `Record<string, number>` | useStore.ts |

### Tasks, Training & Misc
| State Variable | Type | File |
|---|---|---|
| `tasks` | `TaskItem[]` | useStore.ts |
| `lessonsLearned` | `any[]` | useStore.ts |
| `cpdModules` | `any[]` | useStore.ts |
| `pricingConfig` | `PricingConfig \| null` | useStore.ts |

### Local Component State (representative examples)
Individual pages manage transient local state via `useState`. Common patterns:
- `loading: boolean` / `error: string | null` — every page that fetches
- `formData: {...}` — every create/edit form
- `selectedItem: T | null` — row selection in tables
- `isModalOpen: boolean` — modal visibility
- `filterText: string`, `filterStatus: string` — table filters (duplicated across pages, not in store)

No `useReducer`, `createContext`, or React Context API used for state. No Redux.

---

## API Calls

All frontend API calls go through `src/lib/api.ts` using a single action-dispatch pattern:

```
POST /api?action={actionName}
Body: JSON object
Auth: Firebase ID token in Authorization header
```

### Auth & API Keys
| Action | Caller | Purpose |
|---|---|---|
| `generateApiKey` | DeveloperSettings.tsx | Create named API key |
| `getApiKeys` | DeveloperSettings.tsx | List user's API keys (masked) |
| `revokeApiKey` | DeveloperSettings.tsx | Delete an API key |
| `deleteUserAccount` | ProfileSettingsModal.tsx | Delete account and all data |

### Projects
| Action | Caller | Purpose |
|---|---|---|
| `createProject` | ProjectInitiation.tsx | Create new project |
| `getProjects` / `clientGetProjects` | useStore.ts (fetchProjects) | List accessible projects |
| `updateProject` | useStore.ts | Update project fields |
| `deleteProject` | useStore.ts | Delete project |
| `getProjectById` | useStore.ts | Fetch single project |
| `clientGetProjectData` | useStore.ts | Enriched project data for client view |
| `adminGetProjects` | admin/ProjectsTab.tsx | Super-admin project list |
| `adminDeleteProject` | admin/ProjectsTab.tsx | Admin-force delete |
| `adminTransferProject` | admin/ProjectsTab.tsx | Reassign project owner |

### Programmes
| Action | Caller | Purpose |
|---|---|---|
| `updateProgramme` | useStore.ts | Update programme |
| `deleteProgramme` | useStore.ts | Delete programme |
| `getProgrammeById` | useStore.ts | Fetch single programme |
| `adminGetProgrammes` | admin/ProjectsTab.tsx | Admin programme list |
| `adminDeleteProgramme` | admin/ProjectsTab.tsx | Admin-force delete |
| `adminTransferProgramme` | admin/ProjectsTab.tsx | Reassign owner |

### Data Persistence (generic collections)
| Action | Caller | Purpose |
|---|---|---|
| `saveData` | useStore.ts (saveData method) | Persist any collection to Firestore |
| `getData` | useStore.ts (loadProjectData etc.) | Retrieve any collection |
| `getSystemMappings` | useStore.ts | Fetch AI directive mappings |
| `savePreference` | useStore.ts | Save user preference |
| `getPreferences` | useStore.ts | Load user preferences |

### AI Services
| Action | Caller | Purpose |
|---|---|---|
| `geminiPrompt` | DeveloperSettings.tsx (test), aiService.ts | Direct Gemini call |
| `analyzeCompliance` | ComplianceSetup.tsx, aiService.ts | AI compliance gap analysis |
| `analyzeRisks` | AIRiskID.tsx, RiskSetup.tsx, aiService.ts | AI risk identification |
| `analyzeControls` | AIControlSuggestions.tsx, aiService.ts | AI control recommendations |
| `chatWithAI` | AIInquiryPopup.tsx | Conversational AI interface |

### Team & Collaboration
| Action | Caller | Purpose |
|---|---|---|
| `inviteProjectManager` | ClientTeamPanel.tsx | Email invite for PM |
| `clientGetPMs` | ClientTeamPanel.tsx | List PMs in organisation |
| `clientGetTeam` | ClientTeamPanel.tsx | List all team members |
| `clientRemoveUser` | ClientTeamPanel.tsx | Remove user from org |
| `clientUpdateUserRole` | ClientTeamPanel.tsx | Change user's role |
| `getAssignablePMs` | ProjectInitiation.tsx | PMs available to assign |

### Evidence
| Action | Caller | Purpose |
|---|---|---|
| `getEvidence` | EvidenceDocuments.tsx | List evidence docs for project |
| `addEvidence` | EvidenceDocuments.tsx | Attach evidence document |
| `deleteEvidence` | EvidenceDocuments.tsx | Remove evidence doc |

### Profile
| Action | Caller | Purpose |
|---|---|---|
| `getProfile` | useStore.ts (initStore) | Load user profile |
| `saveProfile` | ProfileSettingsModal.tsx | Save profile changes |

### Compliance Library (admin)
| Action | Caller | Purpose |
|---|---|---|
| `getComplianceLibrary` | useStore.ts | Load compliance item library |
| `upsertComplianceLibraryItem` | admin/RegulationManager.tsx | Create/update library item |
| `deleteComplianceLibraryItem` | admin/RegulationManager.tsx | Delete library item |
| `getComplianceDomains` | useStore.ts | Load domain list |
| `upsertComplianceDomain` | admin/RegulationManager.tsx | Add/update domain |

### Admin
| Action | Caller | Purpose |
|---|---|---|
| `adminStats` | admin/OverviewTab.tsx | Platform-wide statistics |
| `adminGetUsers` | admin/UsersTab.tsx | All users list |
| `adminUpdateUser` | admin/UsersTab.tsx | Edit user (role, active) |
| `adminGetActivity` | admin/ActivityTab.tsx | Activity log |
| `adminGetMappings` | admin/MappingManager.tsx | AI mapping directives |
| `adminSaveMapping` | admin/MappingManager.tsx | Save mapping |
| `adminDeleteMapping` | admin/MappingManager.tsx | Delete mapping |
| `adminGetPricingConfig` | admin/PricingTab.tsx | Load pricing config |
| `adminUpdatePricingConfig` | admin/PricingTab.tsx | Save pricing config |
| `adminCreateInvoice` | InvoiceManager.tsx | Create invoice |
| `adminGetInvoices` | InvoiceManager.tsx | List all invoices |
| `adminDeleteInvoice` | InvoiceManager.tsx | Delete invoice |
| `clientGetInvoices` | Invoices.tsx | Client's own invoices |

### Portfolio
| Action | Caller | Purpose |
|---|---|---|
| `getPortfolioData` | useStore.ts (loadAggregateData) | Portfolio-wide aggregate data |
| `clientGetPortfolioInfo` | useStore.ts | Client portfolio overview |

---

## Components Inventory

### Navigation & Layout
| Component | File | What it does |
|---|---|---|
| `Header` | components/Header.tsx | Top bar: project/programme switcher, notifications, dark mode toggle, user menu |
| `Sidebar` | components/Sidebar.tsx | Left nav: role-gated menu groups (Compliance, Risk, Reports, Admin); collapses on mobile |
| `MobileHeader` | components/MobileHeader.tsx | Mobile-specific top header |
| `MobileNav` | components/MobileNav.tsx | Mobile bottom tab bar |
| `PublicLayout` | components/public/PublicLayout.tsx | Wrapper with public header/footer for marketing pages |
| `ServiceManagementBar` | components/ServiceManagementBar.tsx | Pinned bar showing last analysis run timestamps |

### Auth & Route Control
| Component | File | What it does |
|---|---|---|
| `AuthProvider` | components/AuthProvider.tsx | Firebase `onAuthStateChanged` watcher; calls `initStore()` on login |
| `RoleGuard` | components/RoleGuard.tsx | Renders children only if user meets role requirement, else shows access-denied |
| `ChecklistGate` | components/ChecklistGate.tsx | Prevents action until setup checklist is complete |
| `ErrorBoundary` | components/ErrorBoundary.tsx | Top-level React error boundary with fallback UI |

### Modals
| Component | File | What it does |
|---|---|---|
| `ProfileSettingsModal` | components/ProfileSettingsModal.tsx | Edit user profile, preferences, password |
| `IssueModal` | components/IssueModal.tsx | Create/edit issue with fields: title, description, priority, owner, due date |
| `RiskModal` | components/RiskModal.tsx | Create/edit risk with full fields: likelihood, impact, controls, links |
| `KRIModal` | components/KRIModal.tsx | Create/edit Key Risk Indicator with thresholds |
| `MilestoneManager` | components/MilestoneManager.tsx | Milestone list with add/edit/complete and history timeline |
| `DeliveryTeamCRUD` | components/DeliveryTeamCRUD.tsx | Add/edit/remove delivery team members |
| `DetailsModal` | components/DetailsModal.tsx | Generic read-only details modal |

### AI Components
| Component | File | What it does |
|---|---|---|
| `AIErrorAlert` | components/AIErrorAlert.tsx | Formats and displays AI/API errors with recovery suggestions |
| `AIInquiryPopup` | components/AIInquiryPopup.tsx | Chat popup for asking AI about compliance/risk items |
| `AIWriter` | components/AIWriter.tsx | AI-assisted text generation (risk descriptions, report text) |

### Compliance Components
| Component | File | What it does |
|---|---|---|
| `ComplianceQuestionnaire` | components/compliance/ComplianceQuestionnaire.tsx | Multi-phase questionnaire for compliance profiling |
| `AnalysisSummary` | components/compliance/AnalysisSummary.tsx | Displays AI compliance analysis with scores, gaps, recommendations |
| `PublicationChecklist` | components/PublicationChecklist.tsx | Pre-publish checklist modal with pass/fail items |

### Admin Components
| Component | File | What it does |
|---|---|---|
| `OverviewTab` | components/admin/OverviewTab.tsx | Platform stats: user count, project count, revenue |
| `UsersTab` | components/admin/UsersTab.tsx | User list with role editor and deactivation |
| `ActivityTab` | components/admin/ActivityTab.tsx | Paginated activity log |
| `ProjectsTab` | components/admin/ProjectsTab.tsx | All projects across all clients with admin actions |
| `PricingTab` | components/admin/PricingTab.tsx | Per-tier pricing configuration editor |
| `MappingManager` | components/admin/MappingManager.tsx | AI system mapping directive CRUD |
| `RegulationManager` | components/admin/RegulationManager.tsx | Regulation library item CRUD |

### Common
| Component | File | What it does |
|---|---|---|
| `EmptyState` | components/common/EmptyState.tsx | Reusable empty-list state (icon + title + description + optional CTA) |
| `PremiumAIBanner` | components/common/PremiumAIBanner.tsx | Upgrade banner shown when AI feature requires higher tier |
| `NotificationWrapper` | components/NotificationWrapper.tsx | react-hot-toast `<Toaster>` provider |
| `InfoTooltip` | components/InfoTooltip.tsx | `?` icon with hover tooltip text |
| `UserAvatar` | components/UserAvatar.tsx | Shared avatar — `<img src={photoURL}>` with `onError` fallback to gradient initials badge. Three sizes (sm/md/lg). Used by Header, Sidebar, MobileHeader; required for any new avatar rendering. |

### Pages — Compliance
| Component | File | What it does |
|---|---|---|
| `ComplianceSetup` | pages/ComplianceSetup.tsx | 4-phase compliance profiler wizard; AI analysis trigger and result display |
| `ComplianceDashboard` | pages/ComplianceDashboard.tsx | Compliance KPI cards and item status overview |
| `ComplianceTracker` | pages/ComplianceTracker.tsx | Filterable table of all compliance items with inline status updates |
| `ComplianceProfiler` | pages/ComplianceProfiler.tsx | Entry point for starting a compliance profiling session |
| `ComplianceAlerts` | pages/ComplianceAlerts.tsx | Active compliance breach and warning alerts |
| `LinkedRegs` | pages/LinkedRegs.tsx | Regulations linked to selected compliance items |
| `EvidenceDocuments` | pages/EvidenceDocuments.tsx | Upload, view, and delete evidence documents per project |

### Pages — Risk
| Component | File | What it does |
|---|---|---|
| `RiskSetup` | pages/RiskSetup.tsx | Risk profiler wizard with KRI configuration |
| `RiskDashboard` | pages/RiskDashboard.tsx | Risk overview: heat map, category pie charts, KRI gauges |
| `RiskRegister` | pages/RiskRegister.tsx | Full risk register table with sort/filter |
| `RiskTracker` | pages/RiskTracker.tsx | Risk monitoring timeline and status tracking |
| `RiskAlerts` | pages/RiskAlerts.tsx | Active risk threshold breach alerts |
| `RiskIssues` | pages/RiskIssues.tsx | Issues that escalated from or link to risks |
| `AIRiskID` | pages/AIRiskID.tsx | AI-assisted risk discovery workflow |
| `RiskIdentifier` | pages/RiskIdentifier.tsx | Manual risk identification tool |
| `RiskAggregation` | pages/RiskAggregation.tsx | Portfolio-level risk roll-up view |

### Pages — Reporting
| Component | File | What it does |
|---|---|---|
| `ExecutiveReport` | pages/ExecutiveReport.tsx | Exportable PDF executive summary |
| `ProjectReport` | pages/ProjectReport.tsx | Full project status report with charts |
| `ProgrammeReport` | pages/ProgrammeReport.tsx | Programme-level consolidated report |
| `ClientProgrammeReport` | pages/ClientProgrammeReport.tsx | Client-facing programme summary report |
| `TrendsHeatmaps` | pages/TrendsHeatmaps.tsx | Heatmap visualisations of risk/compliance trends |
| `KRITracker` | pages/KRITracker.tsx | KRI status dashboard with threshold indicators |

### Pages — Programme & Project
| Component | File | What it does |
|---|---|---|
| `Programmes` | pages/Programmes.tsx | Programme list with status cards and actions |
| `ProgrammeInitiation` | pages/ProgrammeInitiation.tsx | Create/edit programme multi-section form |
| `ProgrammeSetup` | pages/ProgrammeSetup.tsx | Initial programme setup flow |
| `ProgrammeContext` | pages/ProgrammeContext.tsx | Programme context and background configuration |
| `ProgrammeRiskRegister` | pages/ProgrammeRiskRegister.tsx | Programme-scoped risk register table |
| `ProgrammeIssues` | pages/ProgrammeIssues.tsx | Programme-level issue list |
| `Projects` | pages/Projects.tsx | Project list with status cards |
| `ProjectInitiation` | pages/ProjectInitiation.tsx | Create/edit project multi-section form |
| `ProjectPlan` | pages/ProjectPlan.tsx | Project milestone and delivery plan |
| `NewProgramme` | pages/NewProgramme.tsx | New programme creation wizard |

### Pages — Admin & Settings
| Component | File | What it does |
|---|---|---|
| `AdminPanel` | pages/AdminPanel.tsx | Super-admin dashboard with tabbed sub-sections |
| `ClientTeamPanel` | pages/ClientTeamPanel.tsx | Client admin: invite PMs, manage team, assign roles |
| `WorkspaceSettings` | pages/WorkspaceSettings.tsx | Organisation name, branding, API settings |
| `BillingPanel` | pages/BillingPanel.tsx | Subscription tier, billing info |
| `InvoiceManager` | pages/InvoiceManager.tsx | Invoice CRUD with PDF generation (admin-only) |
| `Invoices` | pages/Invoices.tsx | Invoice list for client users |
| `CostCalculator` | pages/CostCalculator.tsx | Fee estimation calculator |
| `DeveloperSettings` | pages/DeveloperSettings.tsx | API key management and Gemini test console |
| `APIDocs` | pages/APIDocs.tsx | In-app API documentation |

### Pages — Learning & Support
| Component | File | What it does |
|---|---|---|
| `RegulationLibrary` | pages/RegulationLibrary.tsx | Searchable regulations reference library |
| `CPDTraining` | pages/CPDTraining.tsx | CPD training module viewer |
| `LessonsLearned` | pages/LessonsLearned.tsx | Lessons-learned repository on `DynamicTable` (category filter, search on title/problem/resolution, delete-with-confirm). Preserves the Capture modal (with AIWriter suggestions) and the rich View modal (Problem / Resolution / Prevention). |
| `HelpCenter` | pages/HelpCenter.tsx | In-app help documentation |
| `Calendar` | pages/Calendar.tsx | Event calendar with compliance/milestone deadlines |
| `MyTasks` | pages/MyTasks.tsx | Personal action register on `DynamicTable`. Merges manual tasks + actionable compliance items + risk reviews + issue deadlines into one feed. Three filters (timeline / source / context), bulk delete with confirm, pagination. |

### Pages — AI
| Component | File | What it does |
|---|---|---|
| `AIControlSuggestions` | pages/AIControlSuggestions.tsx | AI-recommended control measures |
| `AIComplianceOutlook` | pages/AIComplianceOutlook.tsx | AI forward-looking compliance forecast |

### Pages — Public
| Component | File | What it does |
|---|---|---|
| `Landing` | pages/Landing.tsx | Public marketing landing page |
| `Login` | pages/Login.tsx | Firebase email/password login form |
| `About` | pages/public/About.tsx | About the company |
| `Contact` | pages/public/Contact.tsx | Contact form |
| `Product` | pages/public/Product.tsx | Product feature overview |
| `News` | pages/public/News.tsx | News article list |
| `NewsArticle` | pages/public/NewsArticle.tsx | Individual news article |
| `Support` | pages/public/Support.tsx | Support FAQ page |

---

## Key Conventions

### File Naming
- **Components and pages**: PascalCase — `Header.tsx`, `ComplianceSetup.tsx`, `AIRiskID.tsx`
- **Utilities, lib, services**: camelCase — `api.ts`, `firebase.ts`, `aiService.ts`, `utils.ts`
- **Data files**: camelCase — `complianceData.ts`, `riskData.ts`
- **Test files**: `*.test.ts` suffix — `context.test.ts`
- **API route files**: camelCase — `auth.ts`, `compliance.ts`, `projects.ts`

### Folder Structure Patterns
- Feature sub-folders inside `components/` are lowercase: `admin/`, `compliance/`, `common/`, `public/`
- No `hooks/` directory — custom hook logic embedded in components or store
- No `contexts/` directory — all context via Zustand store
- Backend under `/api/` with `lib/` and `routes/` sub-folders
- Static data under `/src/data/`; app-wide constants under `/src/constants/`

### Export Style
- **Components and pages**: `export default function ComponentName()` (default exports)
- **Utilities and lib**: `export const functionName` / `export function` (named exports)
- **Store**: `export const useStore = create(...)` (named export)
- **Types**: `export type TypeName = ...` (named exports, often in same file as usage)
- **Data files**: named exports — `export const complianceItems = [...]`

### Import Style
- Absolute path alias `@/` maps to repo root (defined in `tsconfig.json`)
- Components import via `@/components/Header`, utilities via `@/lib/api`, store via `@/store/useStore`
- Relative imports rare and mostly in same-feature sub-folders
- No barrel `index.ts` files — every import targets specific file

### State & Props Patterns
- **Global/shared state**: Zustand store destructured at top of component — `const { user, risks, setActiveProject } = useStore()`
- **Local/transient state**: `useState` inline in the component where it's used
- **No prop drilling**: components read from store directly rather than receiving props
- **No React Context API** used anywhere for state

### API Call Pattern
```ts
// All calls go through src/lib/api.ts
const result = await api.someAction(params);
// Which dispatches: POST /api?action=someAction with JSON body
```
- All requests are `POST` regardless of semantics
- Firebase ID token sent in `Authorization: Bearer <token>` header
- Errors thrown as `ApiError` with `.status` and `.message`
- Default timeout: 120000ms (120s) for AI calls

### Backend Route Pattern
```ts
// Each route file exports a map of action name → handler function
export const authRoutes = {
  generateApiKey: async (req, res, ctx) => { ... },
  revokeApiKey: async (req, res, ctx) => { ... },
};
```
- `ctx` is the `ApiContext` from `api/lib/context.ts` — contains `uid`, `clientId`, `isAdmin`, `isAuthorizedForContext()`
- Authorization always checked at start of handler via `ctx.*` helpers

### Styling
- Pure **Tailwind CSS v4** (Vite plugin; no `tailwind.config.js`) — no CSS modules, no styled-components, no SCSS
- `clsx()` for conditional class names: `clsx('base-class', condition && 'extra-class')`
- `tailwind-merge` used where conflicting utility classes need resolution
- Dark mode via `isDarkMode` store flag + `dark:` variant classes
- Colour palette mostly Tailwind's `indigo-*`, `slate-*`, `emerald-*`, `red-*`
- **Scoped CSS exception**: [`src/pages/Login.tsx`](src/pages/Login.tsx) ships a custom OKLCH-palette design under a `.cg-login-root` scope (CSS embedded as a `<style>` block in the component). This is a deliberate exception — Login is on the typography exclusion list and the design uses features (custom OKLCH operations, scoped CSS variables, keyframe animations) that don't translate cleanly to Tailwind. **Do not extend this pattern to other pages** — Tailwind remains the rule everywhere else.

### Page wrapper convention
- The app shell wraps every authenticated page with `<main className="flex-1 overflow-y-auto p-4 md:p-6 ...">` containing `<div className="max-w-[1600px] mx-auto">` ([`src/App.tsx:181-182`](src/App.tsx#L181)). Pages should **not** add their own page-level padding (`p-2 sm:p-4 lg:p-6`), `max-w-*`, or `mx-auto` — that double-wraps the layout.
- Canonical page root: `<div className="space-y-6 sm:space-y-8">` (as used in [`src/pages/ComplianceTracker.tsx`](src/pages/ComplianceTracker.tsx)). The matching tighter variant `space-y-5 sm:space-y-6` is reserved for sub-sections inside a page, not page roots.
- `ServiceManagementBar` (when used) renders as a sibling **before** the `space-y-*` page root, not inside it.

### Typography — v4 calibration (load-bearing across the authenticated app)
**Geist (sans) + Geist Mono** loaded globally via Google Fonts import in [`src/index.css:1`](src/index.css#L1); Tailwind `@theme` maps `--font-sans` and `--font-mono` ([`src/index.css:7-8`](src/index.css)). `font-sans` cascades from the authenticated root in [`src/App.tsx:174`](src/App.tsx#L174).

**Canonical class strings** (lifted from [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx) `KpiCard` at line 2349-2459):
- **Eyebrow labels** (small UPPERCASE headings): `font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500`
- **KPI big-numbers** (stat values): sans Geist + `font-medium ... tabular-nums` — NOT mono
- **Status chips / badges** (uppercase pills): `font-mono uppercase tracking-wide font-medium` + colour utilities
- **Table column headers** (`<th>`): `font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500`
- **Inline numeric badges + IDs**: `font-mono tabular-nums`
- **Kbd hints**: `font-mono text-[10px]`
- **Sub-line / footer metadata with numeric content**: `font-mono text-[11px] text-slate-500 tabular-nums`

**Bans across the authenticated app:**
- ❌ `font-black` (weight 900) — looks wrong in Geist Mono. Use `font-semibold` (600) max.
- ❌ `tracking-widest` / `tracking-tighter` on small uppercase labels. Use `tracking-wide`.
- ❌ `italic` on regular text. **PRESERVED only on**: PDF/report pages (`ExecutiveReport`, `ProjectReport`, `ProgrammeReport`, `ClientProgrammeReport`, `InvoiceManager`, `Invoices`) and rich-text editor tooling (`src/components/governance/{editor,extensions,templates,meetings,forwardPlan,framework,reports}/`, `src/components/technicalAssurance/`). Default-exclude any file using `jspdf` / `html2canvas`.
- ❌ Hardcoded score thresholds (`>= 16`, `>= 22`, etc.). Import `SEVERE_SCORE_THRESHOLD` / `MAJOR_SCORE_THRESHOLD` from [`src/lib/riskMetrics.ts`](src/lib/riskMetrics.ts).

**Stay sans (Rule 7):**
- H1 / H2 / H3 page or modal titles: `font-semibold tracking-tight`
- Body paragraphs, descriptions, helper text
- Action buttons (primary / secondary CTAs): `font-medium` — drop any inherited uppercase + tracking + bold
- Form input labels and input fields

**Exclusion list** (never touch for typography sweeps): `src/pages/Landing.tsx`, `src/pages/Login.tsx`, everything under `src/pages/public/`, `src/components/public/`, governance `.ts` extension files (HTML template strings).

### Form Handling
- **No form library** (React Hook Form, Formik, etc. not used)
- All forms: `useState` object + `onChange` handlers spread-updating state
- `onSubmit` calls store method or direct `api.*` call inline in component
- No client-side schema validation library (Zod, Yup not present)

### Modal Pattern
```tsx
const [isOpen, setIsOpen] = useState(false);
{isOpen && <SomeModal onClose={() => setIsOpen(false)} data={item} />}
// Inside modal — backdrop click to close:
onClick={(e) => e.target === e.currentTarget && onClose()}
```

### Data Flow
```
User action → Component handler → useStore method → api.ts → /api endpoint
→ Firebase Firestore → response → store.set({ ... }) → component re-render
```

### Role Values (defined in `src/lib/roles.ts`)
- `"super_admin"` — platform owner
- `"admin"` — internal admin (deprecated/same as super_admin in some checks)
- `"client_admin"` — organisation admin
- `"project_manager"` — PM within an organisation
- `"viewer"` — read-only access

### TypeScript
- `strict` mode not explicitly enabled — `noEmit` lint only via `tsc --noEmit`
- Many `any` types in store and component state (especially around Firebase user and AI responses)
- Interfaces/types defined inline in files that use them (no shared `types/` directory)

### Risk-metric conventions
- **Always import score / ALE helpers from [`src/lib/riskMetrics.ts`](src/lib/riskMetrics.ts).** Never re-derive scores inline.
  - `getGrossScore(risk)` → prefers stored `grossRating`, falls back to `calculateMatrixScore(grossL, grossI)`, then raw `L × I`.
  - `getResidualScore(risk)` → same precedence for residual.
  - `getGrossALE(risk)` / `getResidualALE(risk)` → use stored ALE if present, else recompute from `impact × probability` (handles probability as decimal or percentage).
  - `SEVERE_SCORE_THRESHOLD = 19`, `MAJOR_SCORE_THRESHOLD = 12`.
- Risk matrix cell colour bands always use `calculateMatrixScore(L, I)` from [`src/data/riskScoringMatrix.ts`](src/data/riskScoringMatrix.ts), never raw `L × I`.
- `normalizeRisk` in [`src/store/useStore.ts`](src/store/useStore.ts) backfills missing `residualALE` / `grossALE` from `impact × probability` on every risk load — downstream KPI math relies on this.

### Refresh / skeleton conventions (dashboard surfaces)
- During `isRefreshing` (or context-switch loaders `isLoadingContent` / `loadingOverview`), every visible content surface should render a skeleton, not freeze with stale data.
- Setup-pending CTAs (`!isComplianceSetup || !isRiskSetup`) must be **gated on `!isLoadingContent && !loadingOverview && !isRefreshing`** — otherwise they flash during the gap between previous-context-clear and new-context-load.
- Available skeleton helpers in [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx): `SkeletonStatCards`, `SkeletonBar`, `SkeletonTable`, `SkeletonMatrix`, `SkeletonCriticalList`, `SkeletonSidePanel`, `SkeletonProjectsGrid`, `SkeletonRiskSummary`, `SkeletonIssueSummary`.

### AI inquiry / StrictMode
- `<React.StrictMode>` is enabled in [`src/main.tsx`](src/main.tsx). Any effect that calls a side-effectful function (API call, navigation) must be **idempotent** or **guarded with a ref**. See [`src/components/AIInquiryPopup.tsx`](src/components/AIInquiryPopup.tsx) — `autoSentRef` prevents StrictMode from firing two AI requests for the same prefilled prompt.

### Table conventions
- **`DynamicTable` is canonical** for any list page that needs search, filters, pagination, selection, or row/bulk actions. Do not hand-roll `<table>` markup, do not introduce a separate table library, and do not build a page-level confirm modal — DynamicTable ships all of that. Component: [`src/components/table/DynamicTable.tsx`](src/components/table/DynamicTable.tsx); public types: [`src/components/table/types.ts`](src/components/table/types.ts).
- **Reference patterns** (copy from these when migrating a new page):
  - Minimal (no actions, just search + columns): [`src/pages/ProgrammeIssues.tsx:174-189`](src/pages/ProgrammeIssues.tsx#L174)
  - Full (row actions + bulk actions + filters + `requireConfirm`): [`src/pages/RiskRegister.tsx:843-941`](src/pages/RiskRegister.tsx#L843)
  - Merged-source feed with cross-field filters: [`src/pages/MyTasks.tsx`](src/pages/MyTasks.tsx)
- **Confirm dialog**: route destructive actions through `requireConfirm: ConfirmConfig` on the relevant `RowAction` / `BulkAction`. DynamicTable mounts [`ConfirmDialog`](src/components/table/ConfirmDialog.tsx) automatically and awaits the handler with a spinner. Never `window.confirm()`, never build a parallel modal.
- **Cross-field filter pattern**: `FilterDef.match(rowValue, filterValue)` only receives one row field. When a filter needs multiple fields (e.g. a "timeline" bucket derived from both `status` and `dueDate`), **flatten the bucket onto the row** as a derived `_underscorePrefixed` field at the `useMemo` that builds the data array, then point the filter at that synthetic key. See `_timeline` / `_contextId` / `_isOverdue` in [`src/pages/MyTasks.tsx`](src/pages/MyTasks.tsx). Do not subclass DynamicTable or move filter logic outside it.
- **Pagination default**: `pagination: { enabled: true, pageSize: 25, pageSizeOptions: [10, 25, 50] }` for any list that can plausibly exceed ~50 rows.
- **Page-level toolbar buttons** (e.g. "Add task", "Capture lesson") belong in DynamicTable's `toolbarActions` slot, not as a sibling above the table. The empty-state CTA is a separate `emptyState.action` slot.

### Auth / avatar conventions
- **Avatar rendering**: always use [`<UserAvatar/>`](src/components/UserAvatar.tsx). Never inline `<img src={user.photoURL}/>` — the component handles the `onError` → gradient initials fallback, so stale or revoked URLs never leave a broken-image icon. Three sizes (`sm`/`md`/`lg`) cover all current call sites (Header, Sidebar, MobileHeader).
- **`photoURL` is the canonical avatar field** on the user profile (set in [`api/routes/profile.ts`](api/routes/profile.ts) whitelist). Do **not** introduce a parallel `avatarUrl` field.
- **Profile keys are always initialized on first sign-in**: [`src/store/useStore.ts initStore`](src/store/useStore.ts) writes `photoURL` and `displayName` to the Firestore profile doc on first init, even for magic-link sign-ups where Firebase Auth supplies neither (the values may be `null`, but the keys always exist). Downstream code can assume those keys are present on every loaded profile.
- **Friendly auth errors**: when surfacing Firebase auth failures to the UI, map known error codes to safe copy and fall back to a generic message — never echo raw `err.message`. See `FRIENDLY_AUTH_ERRORS` + `friendlyAuthError()` in [`src/pages/Login.tsx`](src/pages/Login.tsx) for the current mapping.
- **Magic-link throttle**: client-side throttle for repeated magic-link submissions is **5 seconds** (`MAGIC_LINK_THROTTLE_MS`), enforced via a `useRef` timestamp in `Login.tsx`. Backend rate limits are layered on top, but the client guard keeps the UX honest.

### Standing rules for sweeps / refactors
- **Never run regex passes on backtick template literals.** A pattern like `(["'`])((?:[^\\]|\\.)*?)\1` matches across newlines inside backticks and corrupts JSX inside `${...}`. Always restrict regex find/replace to single-line `'...'` or `"..."` strings unless the pattern is anchored on a definite per-line attribute.
- **Never commit with `--no-verify`, never push with `--force` to `main` / `master`.** No model names, no co-authored-by footer in commit messages.
- **Never push without explicit user instruction.** Commit locally; wait for "push".
- **`api/routes/ai.ts` is out of bounds** — standing project rule. Do not edit.
- **5×5 risk matrix is user-locked** — do not change the layout shape.

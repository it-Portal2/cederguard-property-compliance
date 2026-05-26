# CedarGuard — Property Compliance & Risk Intelligence

> The control tower for social housing compliance, risk and governance.
> Real-time intelligence across every project, programme and portfolio — built for the **Building Safety Act 2022**, the **Fire Safety Act 2021**, the **Social Housing (Regulation) Act 2023**, and **Awaab's Law**.

CedarGuard is a multi-tenant SaaS platform that helps UK social housing providers, local authorities, and PMOs prove compliance, manage risk, and surface what their boards actually need to see — **before** the breach line.

---

## Who it's for

| Persona | What CedarGuard does for them |
| --- | --- |
| **Housing executives & boards** | A live, RAG-coded view of portfolio compliance health, financial exposure, and the top risks driving it. Exportable executive reports in two clicks. |
| **Programme & project managers** | One register for risks, issues, controls, and compliance items across every project and programme they own. AI-assisted risk identification and control suggestions cut the discovery work from days to minutes. |
| **Compliance officers** | A regulation library mapped to statutory authorities, evidence linking, KRI tracking, and breach-alert routing — built around the new wave of post-Grenfell legislation. |
| **Auditors & regulators** | Tamper-evident activity log, role-gated access, historical snapshots that show portfolio state at any past month, and audit-ready evidence packs. |

---

## What's inside

### Compliance intelligence
- **Compliance profiler** — multi-phase questionnaire that maps each property to its statutory obligations based on building height, tenure, jurisdiction, and use class.
- **AI compliance gap analysis** — Google Gemini scores every requirement against your evidence and surfaces the gaps with a recommended remediation path.
- **Regulation library** — searchable, admin-curated reference set covering the BSA, FSA, Decent Homes Standard, HHSRS, and emerging Awaab's Law obligations.
- **Evidence vault** — attach inspection reports, safety cases, and certificates to specific compliance items, with role-gated access.

### Risk management
- **Programme- and project-level risk registers** with full 5×5 matrix scoring (gross, residual, ALE).
- **AI risk identification** — describe the project context, get a starter risk register seeded with category-appropriate risks and KRIs.
- **AI control suggestions** — for any risk, generate plausible mitigation controls with cost/impact framing.
- **KRI tracking** — define thresholds, get breach alerts when a portfolio-wide indicator crosses the line.
- **Risk → issue conversion** — promote a realised risk to an issue without losing the audit trail.

### Executive & operational dashboards
- **Strategic portfolio dashboard** — KPI tiles with honest period-over-period deltas, a 5×5 risk heatmap, financial exposure roll-up, AI-generated strategic insight panel, and a **Risk outlook — next 90 days** projection with a tolerance line.
- **Activity timeline** — every meaningful state change across the workspace in one feed.
- **Historical view** — pick any past month and the dashboard rewinds to that month-end snapshot.

### Governance & collaboration
- **Multi-tenant by design** — strict client/programme/project authorisation enforced at both the API layer and Firestore security rules.
- **Role-gated UX** — `super_admin`, `client_admin`, `project_manager`, `viewer` — every menu item, action, and field write checked.
- **Team management** — client admins invite PMs by email, assign them to programmes and projects, and rotate roles.
- **In-app calendar** — compliance deadlines, risk reviews, and milestones in one place.
- **PWA + push notifications** — install on mobile, get FCM alerts for KRI breaches and overdue actions.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| **Frontend** | React 19 · TypeScript · Vite 6 · Tailwind CSS v4 · React Router v7 · Zustand · Motion (Framer v12) · Recharts |
| **Backend** | Express on Vercel serverless · single action-dispatch endpoint · multi-tenant authorisation context |
| **Data** | Firebase Auth · Firestore · Firebase Cloud Messaging |
| **AI** | Google Gemini (`@google/genai`) with retry, dual-key fallback, and quota handling |
| **Infra** | Vercel (Fluid Compute) · PWA via `vite-plugin-pwa` · Firestore security rules + composite indexes |
| **Design system** | Geist + Geist Mono · OKLCH-driven palette · scoped CSS where Tailwind cannot reach (auth pages) |

Production build: ~6 seconds. TypeScript strict-mode-lite checked via `tsc --noEmit`. PWA precaches 27 entries.

---

## Quick start

**Prerequisites**
- Node.js 20+ (24 LTS recommended)
- A Firebase project (Auth + Firestore enabled)
- A Google Gemini API key

**Install & run**

```bash
npm install
npm run dev          # dev server on http://localhost:3000
```

**Useful scripts**

```bash
npx tsc --noEmit     # type-check (canonical "is it broken" gate)
npm run build        # production build (~6s)
npm run test         # Vitest — currently API tests only
```

Set environment variables in `.env.local`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
GEMINI_API_KEY=...
GEMINI_API_KEY_BACKUP=...   # optional dual-key fallback
```

---

## Repository map

```
src/
├── App.tsx                  Router + authenticated/public layout split
├── main.tsx                 Bootstrap, StrictMode, PWA registration
├── components/
│   ├── table/               DynamicTable + ConfirmDialog (canonical table primitive)
│   ├── dashboard/           v4-calibrated dashboard primitives (KPI cards, RiskBurnDown…)
│   ├── compliance/          Compliance questionnaire + analysis summary
│   ├── admin/               Super-admin panels
│   ├── common/              EmptyState, StatsCard, PremiumAIBanner
│   └── …                    Header, Sidebar, RiskModal, IssueModal, UserAvatar, AIWriter
├── pages/                   Route-level pages (Dashboard, RiskRegister, ComplianceTracker…)
├── store/useStore.ts        Zustand store — single source of truth for app state
├── lib/                     api.ts, firebase.ts, roles.ts, riskMetrics.ts, utils.ts
├── services/aiService.ts    Gemini prompt construction + response parsing
└── data/                    Static regulation library, risk categories, sample data

api/
├── index.ts                 Express entry — action dispatcher
├── lib/context.ts           Firebase Admin + multi-tenant authorisation context
└── routes/                  Per-feature handler maps (auth, ai, compliance, projects, …)
```

For deeper architectural context, conventions, and contributor rules see **[CLAUDE.md](./CLAUDE.md)** — it's the canonical onboarding document.

---

## Architecture in one paragraph

A single-page React 19 app talks to a single Vercel serverless endpoint (`/api?action=…`) that dispatches to per-feature handlers and authorises every request against a `clientId`-scoped multi-tenant context. State lives in one Zustand store; Firestore is the system of record. AI features go through Gemini with retry + a backup key. The UI is Tailwind v4 first with a small set of scoped-CSS exceptions for public surfaces. Tables across the app are powered by a single `DynamicTable` primitive — search, filters, pagination, bulk and row actions, and confirm-on-action all built in. Every avatar, every status chip, every score threshold has one canonical helper — drift is treated as a bug.

---

## Security & compliance posture

- **Authentication** — Firebase Auth, passwordless by default (Google OAuth + magic-link). Friendly error mapping, client-side throttling, no raw SDK strings to the UI.
- **Authorisation** — every API action checks `clientId`, role, and project/programme membership via `ApiContext`. Firestore rules are the second line.
- **Data hygiene** — profile fields are whitelisted server-side; avatar URLs are `onError`-guarded so revoked OAuth tokens never break the UI.
- **Audit trail** — every meaningful write is logged with actor + timestamp and surfaced in the admin activity log.
- **Built for**: SOC 2 Type II, ISO 27001, and GDPR alignment.

---

## Status

Actively developed. The current sprint focus is the DynamicTable migration across all list pages, the strategic dashboard hardening pass, and the Geist Mono typography calibration sweep across the authenticated app.

## Roadmap

### Desktop application (in progress)
A native desktop build for **macOS** and **Windows** packaged with **Electron.js**, so the same UI runs offline-capable on inspectors' laptops with a native install experience, OS-native notifications, and seamless update channels for both platforms.

### Dual-cloud deployment (planned)
CedarGuard will ship in two parallel deployment modes so customers can pick the cloud that matches their procurement and data-residency posture:

| Mode | Backend | Target customers |
| --- | --- | --- |
| **Azure** | Microsoft Entra ID auth, Azure Cosmos DB / Azure SQL, Azure Functions, Azure Blob Storage, Azure AI Foundry | UK central government, local authorities, and any organisation that requires sovereign hosting under G-Cloud / OFFICIAL-SENSITIVE controls |
| **Google Firebase** *(current)* | Firebase Auth, Firestore, Cloud Functions / Vercel, Firebase Storage, Google Gemini | Non-government social housing providers, registered providers, and PMOs |

The application layer is being refactored to a thin storage/auth abstraction so the same React + TypeScript codebase can target either cloud at build time, with feature parity across both.

---

## License

Internal proprietary software. © CedarGuard Risk Intelligence. All rights reserved.

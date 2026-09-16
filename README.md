# CedarGuard — Property Compliance & Risk Intelligence

> The control tower for UK social housing compliance, risk and governance.
> Real-time intelligence across every project, programme and portfolio — built for the **Building Safety Act 2022**, the **Fire Safety Act 2021**, the **Social Housing (Regulation) Act 2023**, and **Awaab's Law**.

CedarGuard is a multi-tenant SaaS platform that helps UK social housing providers, local authorities, and PMOs prove statutory compliance, manage multi-tier risks, and surface actionable governance insights — **before** the breach line.

---

## Who It's For

| Persona | What CedarGuard Delivers |
| :--- | :--- |
| **Housing Executives & Boards** | A live, RAG-coded view of portfolio compliance health, financial exposure, and critical risks. One-click exportable board and statutory packs. |
| **Programme & Project Managers** | Unified registers for risks, issues, controls, and compliance obligations across all projects. AI-assisted risk identification and control generation. |
| **Compliance & Safety Officers** | Golden Thread repository, regulation library mapped to statutory authorities, evidence linking, and automated breach alerts. |
| **Auditors & Regulators** | Tamper-evident activity logs, granular RBAC access controls, immutable monthly audit snapshots, and ready-to-inspect evidence dossiers. |

---

## Core Capabilities

### 1. Compliance Intelligence & Golden Thread
- **Compliance Profiler**: Multi-phase questionnaire mapping properties to statutory obligations based on height, tenure, jurisdiction, and use class.
- **AI Gap Analysis**: Model-driven evaluation scoring evidence against statutory requirements with actionable remediation guidance.
- **Statutory Stream Coverage**: Pre-configured matrices for Fire Safety (FRAEW, PAS 79 / PAS 9980), Gas (LGSR), Electrical (EICR), Asbestos, Water/Legionella, and Damp & Mould (Awaab's Law).
- **Evidence Vault**: Secure, role-gated asset storage with cryptographic verification and document linking.

### 2. Enterprise Risk & Issue Management
- **5×5 Risk Scoring**: Qualitative and quantitative scoring (Gross, Residual, Annualised Loss Expectancy / ALE).
- **KRI Monitoring**: Portfolio-level Key Risk Indicators with threshold tracking and automated breach alerts.
- **Risk-to-Issue Escalation**: Convert emerging risks into active issues without breaking the audit chain.

### 3. Enterprise Support Desk & Communication Portal
- **Dual-Mode `/contact` Portal**: Public landing page for unauthenticated visitors; enterprise **Support Ticket & Resolution Desk** for authenticated council and housing teams.
- **Diagnostics & Image Uploads**: Categorised technical stream selection, property/UPRN tagging, and screenshot/error image attachments with instant preview.
- **Interactive Chat & Tracking Drawer**: Live two-way communication thread per ticket with status updates (*Open*, *In Progress*, *Waiting on Council*, *Resolved*) and a 24-hour SLA guarantee.
- **Leadership Escalation**: Prefilled `mailto:cto@cedarguard.co.uk` action with comprehensive ticket telemetry for critical statutory bottlenecks.
- **Admin Resolution Console**: Dedicated management view in `/admin` for support engineers to inspect attachments, converse with councils, and mark issues resolved.

### 4. Resilient Multi-Provider AI Architecture
- **Cascading Router**: Transparent failover across admin-curated OpenRouter models, free fallback tiers, and Google Gemini Direct.
- **Admin Model Catalog**: Real-time OpenRouter model picker and operational controls in `/admin` allowing dynamic model rotation without code deployments.
- **Per-User Backup Keys**: Individual users can register private Gemini API keys via their profile as an isolated fallback.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19 · TypeScript · Vite 6 · Tailwind CSS v4 · React Router v7 · Zustand · Motion · Recharts |
| **Backend** | Node.js Express · Action-dispatch architecture · Multi-tenant authorization context (`ApiContext`) |
| **Database & Auth** | Google Firebase Authentication · Cloud Firestore · Firebase Storage |
| **AI Routing** | OpenRouter (`openrouter.ai`) · Google Gemini (`@google/genai`) · Structured JSON outputs |
| **Hosting & Infra** | Oracle Cloud Linux (Ubuntu) with PM2 & Nginx · Compatible with Vercel Serverless |

---

## Getting Started

### Prerequisites
- Node.js 20+ (Node 22 or 24 LTS recommended)
- Firebase Project with Authentication, Cloud Firestore, and Cloud Storage enabled
- OpenRouter API Key and/or Google Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/cedarguard-co-uk/cedarguard.git
   cd cedarguard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment configuration template:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your project's configuration values (see [Environment Configuration](#environment-configuration)).

4. **Run in Development Mode:**
   ```bash
   npm run dev
   ```
   Access the web application at `http://localhost:3000`.

---

## Useful Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite development server with hot module replacement |
| `npm run build` | Generates optimised production frontend bundle in `dist/` |
| `npx tsc --noEmit` | Performs comprehensive TypeScript type-checking |
| `npm run test` | Executes Vitest automated test suite |
| `node server.js` | Runs the production Express server on port 4000 |

---

## Environment Configuration

All credentials and sensitive configuration are strictly managed via environment variables. **Never commit `.env` or service account keys to version control.**

Refer to [`.env.example`](./.env.example) for the full configuration reference:

```env
# Frontend (Client-side exposed via Vite)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_URL=/api

# Backend (Server-side runtime only)
PORT=4000
NODE_ENV=production
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
OPENROUTER_API_KEY=your_openrouter_api_key
GEMINI_API_KEY=your_gemini_api_key
CORS_ALLOWED_ORIGINS=https://cedarguard.co.uk,https://www.cedarguard.co.uk
```

---

## Production Deployment

CedarGuard runs on production Linux instances managed via **PM2** and reverse-proxied by **Nginx**:

1. **Build the production assets:**
   ```bash
   npm run build
   ```
2. **Launch API service:**
   ```bash
   pm2 start server.js --name cedarguard-api
   pm2 save
   ```
3. **Configure Nginx:**
   - Proxy `/api` requests to `http://127.0.0.1:4000/api`
   - Serve static frontend files from `dist/` with single-page application fallback:
     ```nginx
     location / {
         try_files $uri $uri/ /index.html;
     }
     ```

---

## Security & Compliance Standards

- **Zero-Credential Policy**: All keys and certificates are excluded via `.gitignore`.
- **Role-Based Access Control (RBAC)**: Granular role gating across `super_admin`, `client_admin`, `project_manager`, and `viewer`.
- **Multi-Tenant Data Isolation**: Tenant boundary checks enforced at both the API layer and Firestore security rules.
- **Audit Trails**: All state mutations and administrative actions are permanently recorded with actor identity and timestamps.

---

## License

Proprietary and confidential. © CedarGuard Risk Intelligence. All rights reserved.

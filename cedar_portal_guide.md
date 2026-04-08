# Cedar Property Compliance & Risk Manager
**Comprehensive System & Workflow Guide**

## 1. System Overview
The Cedar Property Compliance & Risk Manager is a specialized portal built for local governments, housing associations, and their project managers to manage high-risk building (HRB) projects, social housing developments, and complex property portfolios. 

The software ensures that all projects strictly adhere to UK housing regulations (like the Building Safety Act 2022 and CDM 2015) by streamlining compliance tracking, risk management, and evidence management into a single source of truth.

---

## 2. User Roles & Permissions

The system is built on a strict role-based access control (RBAC) model to ensure that users only see the tools and data relevant to their specific responsibilities.

### 2.1 Client Admin (Local Government / Housing Association)
**Purpose:** Top-down portfolio oversight.
Client Admins are the primary stakeholders who sponsor the projects. They need to monitor how their hired Project Managers are performing, assess overall risk exposure across their entire housing portfolio, and generate executive reports.

**What they can do:**
- **Programme Context & Oversight:** View aggregated data across all projects managed by their PMs.
- **Monitoring & Analytics:** Access the **KRI Tracker**, **Alerts & Thresholds**, and **Trends & Heatmaps** to spot failing projects or systemic risks early on.
- **Reporting:** Generate the **Unified Executive Report** (a high-level statistical breakdown of all open risks, compliance scores, and issues) and comprehensive **Programme Reports**.
- **Project Selection:** They can use the top navigation dropdown to filter the portal's data to a specific project to do a "deep dive" into a Project Manager's work.
- **Setup Toggle:** By default, they do *not* see the tools to create new projects (as this is the PM's job). However, they have a "Unhide project creation" toggle in their menu if they ever need direct control.

### 2.2 Project Manager
**Purpose:** Daily project execution and compliance management.
Project Managers are assigned to specific housing developments. They are the "boots on the ground" responsible for ensuring individual projects meet all legal and compliance benchmarks.

**What they can do:**
- **Project Setup:** Define the project context (e.g., Is it a Higher-Risk Building? Is it a brownfield site? What is the expected value?).
- **Compliance Tracker:** A granular checklist of required compliance tasks (e.g., verifying asbestos surveys, managing Gateway 2 submissions).
- **Evidence & Documents:** Securely upload mandatory certificates, inspection reports, and sign-offs to the cloud (Firebase Storage) to prove compliance.
- **Risk & Issues Logs:** Identify active risks, rate their likelihood/impact, assign owners, and escalate them to Issues if they materialize on-site.
- **AI Tools:** Utilize advanced Artificial Intelligence to analyze their project parameters and auto-generate risk registers, control suggestions, and compliance summaries.

### 2.3 Super Admin
**Purpose:** Platform administration and technical support.
**What they can do:** 
- Full visibility over the entire platform.
- **User & Role Management:** They can invite new users, approve KYC verifications, and change user roles (e.g., upgrading a base user to a Client Admin or Project Manager).

---

## 3. Core Workflows & Features

### 3.1 Project Creation & Context (Programme Details)
*Primary User: Project Manager*
Every project begins with setup. The Project Manager defines the building's characteristics (height, unit count, tenure type) and selects specific compliance tags (e.g., `hrb`, `demolition`). This profile acts as the foundation—tuning the rest of the portal (and the AI) to surface only the regulations that matter for this specific development.

### 3.2 Compliance Tracking & Evidence Collection
*Primary User: Project Manager*
Once a project is set up, the PM uses the **Compliance Tracker** to work through mandatory checks logically separated by phase (Pre-Construction, Construction, Handover). 
- As tasks are completed, the PM navigates to **Evidence & Documents** to upload the corresponding proof. All files are securely backed up to the cloud.
- Client Admins can click into a project at any time to verify that the PM has actually uploaded the required documentation.

### 3.3 Risk & Issue Management
*Primary User: Project Manager (Input), Client Admin (Review)*
- **Risk Register:** PMs log potential future problems (e.g., Contractor bankruptcy, archaeological finds delay). The system calculates the Gross and Residual Risk ratings automatically.
- **Issues Log:** If a risk happens, it is moved to the Issues Log. 
- *Client Admin View:* Client Admins can view the **Programme Risk Register** and **Programme Issues Log** to see a master list of all fires that need putting out across their entire municipality.

### 3.4 AI-Powered Assistance
*Primary User: Project Manager*
To reduce human error and save time, the portal includes three state-of-the-art AI assistants connected to our custom database:
1. **AI Risk Identification:** Analyzes the exact project profile (e.g., "22-storey social rent tower") and automatically suggests 5-8 highly specific risks the PM might not have considered.
2. **AI Control Suggestions:** Looks at the PM's current High Priority risks and suggests industry-standard mitigation tactics.
3. **AI Compliance Summary:** Reads the project context and generates a plain-English briefing of the most critical legal obligations the site faces right now.

*Note: These AI features are gated behind premium subscription tiers.*

### 3.5 Executive Monitoring & Dashboards
*Primary User: Client Admin*
Client Admins rely heavily on the **Monitoring** tab. 
- **KRI Tracker (Key Risk Indicators):** Visual gauges showing the health of the portfolio.
- **Heatmaps:** Matrix charts pushing the most dangerous, highest-probability risks to the top right corner so executives know exactly where to focus their attention today.

### 3.6 Automated Reporting
*Primary Users: Client Admin & Project Manager*
Reporting is streamlined into unified, one-click exports.
- **Project Report (PMs):** A localized PDF export detailing exactly where a single project stands.
- **Executive Report (Client Admins):** A high-level, data-driven overview aggregating stats (Total Projects, Average Compliance Score, Active Escalated Issues) across the local government's whole portfolio, packaged into an easy-to-read layout for stakeholder meetings.

---

## 4. Subscription & Access
The platform operates on a SaaS model. Client Admins can navigate to **Subscription & Billing** to upgrade their tier. Upgrading to Pro or Enterprise unlocks advanced capabilities, primarily the AI Risk and Compliance Copilots, which drastically reduce the consulting hours normally required for HRB compliance.

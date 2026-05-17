# GOV_DESKTOP_DEPLOYMENT_GUIDE.md
## CedarGuard Gov — Desktop Deployment Runbook
### For: Government IT Operators & Infrastructure Teams
### Version: 1.0 | Classification: OFFICIAL

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Prerequisites](#2-prerequisites)
3. [Backend Deployment](#3-backend-deployment)
4. [Desktop App Distribution](#4-desktop-app-distribution)
5. [First-Run Setup Screen](#5-first-run-setup-screen)
6. [Post-Install Verification Checklist](#6-post-install-verification-checklist)
7. [User Provisioning](#7-user-provisioning)
8. [Operations & Maintenance](#8-operations--maintenance)
9. [Troubleshooting](#9-troubleshooting)
10. [Security & Compliance](#10-security--compliance)
11. [Appendix](#11-appendix)

---

## 1. Overview & Architecture

CedarGuard Gov is an air-gappable, Electron-based desktop application for compliance and risk management in the built environment, designed to meet UK Government security standards (Cyber Essentials Plus, OFFICIAL tier).

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Government Network                                                       │
│                                                                           │
│  ┌─────────────────────┐         ┌──────────────────────────────────┐    │
│  │  End-User Workstation │         │  Azure (UK South / UK West)      │    │
│  │                       │         │                                  │    │
│  │  ┌─────────────────┐ │  HTTPS  │  ┌────────────────────────────┐ │    │
│  │  │  CedarGuard.exe  │◄├─────────┤►│  Azure App Service          │ │    │
│  │  │  (Electron App)  │ │         │  │  (Node 20, Linux)           │ │    │
│  │  │                  │ │         │  │  cedarguard-gov-api          │ │    │
│  │  │  ┌────────────┐ │ │         │  └────────────┬───────────────┘ │    │
│  │  │  │ Chromium   │ │ │         │               │                  │    │
│  │  │  │ Renderer   │ │ │         │  ┌────────────▼───────────────┐ │    │
│  │  │  │ (HashRouter│ │ │         │  │  Azure Cosmos DB (NoSQL)    │ │    │
│  │  │  │  file://)  │ │ │         │  │  54 containers              │ │    │
│  │  │  └────────────┘ │ │         │  └────────────────────────────┘ │    │
│  │  │                  │ │         │                                  │    │
│  │  │  ┌────────────┐ │ │         │  ┌────────────────────────────┐ │    │
│  │  │  │ Main       │ │ │  MSAL   │  │  Microsoft Entra Ext. ID    │ │    │
│  │  │  │ Process    │◄├─┼─────────┤►│  (cedarguard://  callback)  │ │    │
│  │  │  │ (MSAL,IPC) │ │ │         │  └────────────────────────────┘ │    │
│  │  │  └────────────┘ │ │         │                                  │    │
│  │  │                  │ │         │  ┌────────────────────────────┐ │    │
│  │  │  ┌────────────┐ │ │         │  │  Azure Blob Storage         │ │    │
│  │  │  │safeStorage │ │ │         │  │  6 containers               │ │    │
│  │  │  │(encrypted  │ │ │         │  └────────────────────────────┘ │    │
│  │  │  │ creds)     │ │ │         │                                  │    │
│  │  │  └────────────┘ │ │         │  ┌────────────────────────────┐ │    │
│  │  └─────────────────┘ │         │  │  Azure OpenAI (GPT-4o)     │ │    │
│  └─────────────────────┘         │  └────────────────────────────┘ │    │
│                                   │                                  │    │
│                                   │  ┌────────────────────────────┐ │    │
│                                   │  │  Azure Logic Apps (3 crons) │ │    │
│                                   │  └────────────────────────────┘ │    │
│                                   └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Components

| Component | Azure Service | Purpose |
|---|---|---|
| Desktop shell | Electron 31 (Windows) | Chromium renderer + Node main process |
| API backend | Azure App Service (Linux Node 20) | Express REST handler |
| Database | Azure Cosmos DB (NoSQL API) | All application data (54 containers) |
| Identity | Microsoft Entra External ID | User authentication + role claims |
| File storage | Azure Blob Storage | Evidence docs, invoices, PDFs |
| AI | Azure OpenAI GPT-4o | Compliance analysis, risk AI, chat |
| Scheduled jobs | Azure Logic Apps (3 workflows) | Chase engine, snapshots, retention |
| Secrets | Azure Key Vault | API keys, connection strings |

### 1.3 Data Residency

All data resides in **UK South** (primary) with geo-redundancy to **UK West**. No data transits outside UK regions. Azure OpenAI endpoint is deployed in **East US** (nearest with GPT-4o availability) — only prompt text transits; no PII should be included in AI prompts per the system design.

---

## 2. Prerequisites

### 2.1 Azure Subscription Requirements

| Requirement | Detail |
|---|---|
| Subscription type | Pay-As-You-Go or EA (Gov tenants: CSP is acceptable) |
| Required roles | `Owner` on target resource group, OR `Contributor` + `User Access Administrator` |
| Entra tenant type | Microsoft Entra External ID tenant (separate from corp tenant) |
| Region availability | UK South must be available for Cosmos DB, App Service, Key Vault |

### 2.2 Azure Resource Quotas

Verify the following quotas before deployment. Raise quota requests 5–7 business days in advance:

| Resource | Required | How to Check |
|---|---|---|
| App Service Plan cores (B2/P1v3) | 2 vCores | Portal → Subscriptions → Usage + Quotas |
| Cosmos DB accounts | 1 | Portal → Subscriptions → Resource Providers |
| Azure OpenAI (GPT-4o) TPM | 30,000 TPM minimum | AI Studio → Quota |
| Azure Blob Storage accounts | 1 | Unlimited by default |
| Logic App (Standard) workflows | 3 | Unlimited by default |

### 2.3 Tooling Required on Deploy Workstation

```powershell
# Verify all tools are installed before proceeding
az --version          # Azure CLI >= 2.60.0
az bicep version      # Bicep CLI >= 0.28.0 (auto-installs with az bicep install)
node --version        # Node.js >= 20.0.0
npm --version         # npm >= 10.0.0
git --version         # Git >= 2.40.0

# Install Azure CLI if missing
winget install Microsoft.AzureCLI

# Install Bicep
az bicep install
```

### 2.4 Network Requirements

The deployment workstation and end-user workstations must be able to reach:

| Endpoint | Port | Purpose |
|---|---|---|
| `*.azure.com` | 443 | Azure management APIs |
| `*.azurewebsites.net` | 443 | App Service API |
| `*.documents.azure.com` | 443 | Cosmos DB |
| `*.blob.core.windows.net` | 443 | Blob Storage |
| `*.openai.azure.com` | 443 | Azure OpenAI |
| `login.microsoftonline.com` | 443 | Entra authentication |
| `*.b2clogin.com` | 443 | Entra External ID token endpoint |

Add these to your proxy/firewall allow-list **before** deployment. See [Appendix C](#appendix-c-firewall-allow-list) for the complete list with CIDRs.

### 2.5 Code Signing Certificate

> **Important**: Procure an EV (Extended Validation) code signing certificate **at Week 0** of the project. EV certificates require 2–3 weeks for identity validation. Windows SmartScreen will block unsigned `.exe` files.

| Requirement | Detail |
|---|---|
| Certificate type | EV Code Signing (OV is insufficient for SmartScreen bypass) |
| Recommended CA | DigiCert, Sectigo, or GlobalSign |
| Key storage | Azure Key Vault HSM-backed (FIPS 140-2 Level 2) recommended |
| Validity | 3 years maximum |

---

## 3. Backend Deployment

### 3.1 Clone the Repository

```powershell
git clone https://github.com/your-org/cedarguard-gov-azure.git
cd cedarguard-gov-azure
```

### 3.2 Login to Azure CLI

```powershell
az login --tenant <YOUR_ENTRA_TENANT_ID>
az account set --subscription <YOUR_SUBSCRIPTION_ID>

# Verify correct subscription
az account show --query "{name:name, id:id, tenantId:tenantId}"
```

### 3.3 Create Resource Group

```powershell
$RG = "rg-cedarguard-gov-prod"
$LOCATION = "uksouth"

az group create --name $RG --location $LOCATION --tags \
  environment=production \
  project=cedarguard-gov \
  classification=official \
  dataResidency=uk
```

### 3.4 Deploy Bicep Infrastructure

The Bicep template provisions all Azure resources in a single deployment:

```powershell
cd infra/

# Dry-run first (what-if)
az deployment group what-if \
  --resource-group $RG \
  --template-file main.bicep \
  --parameters \
    appName=cedarguard-gov \
    location=$LOCATION \
    openAiLocation=eastus \
    entraExternalTenantId=<ENTRA_EXTERNAL_TENANT_ID>

# Deploy for real
az deployment group create \
  --resource-group $RG \
  --template-file main.bicep \
  --parameters \
    appName=cedarguard-gov \
    location=$LOCATION \
    openAiLocation=eastus \
    entraExternalTenantId=<ENTRA_EXTERNAL_TENANT_ID> \
  --name "cedarguard-gov-deploy-$(Get-Date -Format 'yyyyMMdd-HHmm')"
```

**Expected deployment time**: 12–18 minutes.

**Resources created by Bicep**:
- Azure App Service Plan (P1v3 Linux)
- Azure App Service (`cedarguard-gov-api`)
- Azure Cosmos DB account with all 54 containers
- Azure Blob Storage account with 6 containers
- Azure Key Vault with access policies
- Azure OpenAI account + GPT-4o deployment
- Azure Logic Apps (3 workflows: chase, snapshot, retention)
- Application Insights
- Log Analytics Workspace

### 3.5 Configure Microsoft Entra External ID

> **Screenshot placeholder**: Entra External ID tenant creation screen

**Step 1**: Create the External ID tenant (if not already done)

```
Azure Portal → Microsoft Entra ID → Manage tenants → Create
→ Select "Workforce" or "External" → Choose "External"
→ Organisation name: "CedarGuard Gov"
→ Domain: cedarguard-gov.onmicrosoft.com
→ Location: United Kingdom
```

**Step 2**: Register the desktop application

```
Entra External ID tenant → App registrations → New registration
→ Name: "CedarGuard Gov Desktop"
→ Supported account types: "Accounts in this organizational directory only"
→ Redirect URI: Public client/native → cedarguard://auth/callback
→ Register
```

Record the `Application (client) ID` — you'll need it for the `.env` file.

**Step 3**: Configure app registration

```
App registration → Authentication:
  ✓ Allow public client flows: YES
  ✓ Live SDK support: NO

App registration → Token configuration:
  → Add optional claim → Access token → "roles"
  → Add optional claim → ID token → "email", "given_name", "family_name"

App registration → Manifest:
  Set "accessTokenAcceptedVersion": 2
```

**Step 4**: Create app roles

```
App registration → App roles → Create app role:

Role 1:
  Display name: Super Admin
  Allowed types: Users/Groups
  Value: super_admin
  Description: Platform super-administrator

Role 2:
  Display name: Client Admin
  Allowed types: Users/Groups
  Value: client_admin
  Description: Organisation administrator

Role 3:
  Display name: Project Manager
  Allowed types: Users/Groups
  Value: project_manager
  Description: Project manager

Role 4:
  Display name: Viewer
  Allowed types: Users/Groups
  Value: viewer
  Description: Read-only access
```

**Step 5**: Create the API application registration (for backend token validation)

```
Entra External ID tenant → App registrations → New registration
→ Name: "CedarGuard Gov API"
→ Supported account types: "Accounts in this organizational directory only"
→ Redirect URI: (leave blank for API)
→ Register

API → Expose an API:
  → Set Application ID URI: api://<API_CLIENT_ID>
  → Add scope:
    Scope name: access_as_user
    Who can consent: Admins and users
    Admin consent display name: Access CedarGuard API
    Admin consent description: Allows the app to access CedarGuard on behalf of the signed-in user
    State: Enabled

Desktop app registration → API permissions:
  → Add permission → My APIs → CedarGuard Gov API
  → Select: access_as_user
  → Grant admin consent ✓
```

### 3.6 Set Environment Variables on App Service

```powershell
# Get outputs from Bicep deployment
$COSMOS_ENDPOINT = az cosmosdb show \
  --resource-group $RG --name "cosmos-cedarguard-gov" \
  --query documentEndpoint -o tsv

$BLOB_CONN = az storage account show-connection-string \
  --resource-group $RG --name "stcedarguardgov" \
  --query connectionString -o tsv

$OPENAI_ENDPOINT = az cognitiveservices account show \
  --resource-group $RG --name "oai-cedarguard-gov" \
  --query properties.endpoint -o tsv

$OPENAI_KEY = az cognitiveservices account keys list \
  --resource-group $RG --name "oai-cedarguard-gov" \
  --query key1 -o tsv

# Set App Service configuration
az webapp config appsettings set \
  --resource-group $RG \
  --name "cedarguard-gov-api" \
  --settings \
    NODE_ENV=production \
    COSMOS_ENDPOINT=$COSMOS_ENDPOINT \
    COSMOS_DATABASE=cedarguard \
    AZURE_BLOB_CONNECTION_STRING=$BLOB_CONN \
    AZURE_OPENAI_ENDPOINT=$OPENAI_ENDPOINT \
    AZURE_OPENAI_KEY=$OPENAI_KEY \
    AZURE_OPENAI_DEPLOYMENT=gpt-4o \
    ENTRA_TENANT_ID=<ENTRA_EXTERNAL_TENANT_ID> \
    ENTRA_API_CLIENT_ID=<API_CLIENT_ID> \
    ENTRA_API_AUDIENCE=api://<API_CLIENT_ID> \
    CORS_ALLOWED_ORIGINS=null
```

> **Note on `CORS_ALLOWED_ORIGINS=null`**: The Electron renderer runs on `file://` origin, which browsers report as `"null"`. The App Service must allow this origin explicitly.

### 3.7 Enable Cosmos DB Data-Plane RBAC

> **Critical**: This is the #1 silent failure in Azure Cosmos DB deployments. Without data-plane RBAC, the App Service managed identity can reach the Cosmos control plane but NOT read/write data. All Cosmos operations will return `403 Forbidden`.

```powershell
# Get App Service managed identity object ID
$MANAGED_IDENTITY_ID = az webapp identity show \
  --resource-group $RG \
  --name "cedarguard-gov-api" \
  --query principalId -o tsv

$COSMOS_ACCOUNT_ID = az cosmosdb show \
  --resource-group $RG --name "cosmos-cedarguard-gov" \
  --query id -o tsv

# Assign Cosmos DB Built-in Data Contributor role
# Role ID: 00000000-0000-0000-0000-000000000002
az cosmosdb sql role assignment create \
  --account-name "cosmos-cedarguard-gov" \
  --resource-group $RG \
  --role-definition-id "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/$RG/providers/Microsoft.DocumentDB/databaseAccounts/cosmos-cedarguard-gov/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002" \
  --principal-id $MANAGED_IDENTITY_ID \
  --scope $COSMOS_ACCOUNT_ID
```

Verify the assignment:
```powershell
az cosmosdb sql role assignment list \
  --account-name "cosmos-cedarguard-gov" \
  --resource-group $RG \
  --query "[].{principalId:principalId, roleId:roleDefinitionId}" \
  -o table
```

### 3.8 Seed the Database

The seed script creates the initial super-admin user and populates the compliance library and regulation data:

```powershell
cd apps/api/

# Copy and populate env file
Copy-Item .env.example .env
notepad .env  # Fill in all values from previous steps

# Install dependencies
npm ci

# Run seed script
npm run seed

# Expected output:
# ✓ Compliance library: 127 items seeded
# ✓ Regulations: 84 items seeded
# ✓ Super-admin user created: <email>
# ✓ Default pricing config seeded
# Seed complete.
```

### 3.9 Deploy API to App Service

```powershell
cd apps/api/

# Build TypeScript
npm run build

# Create deployment package
Compress-Archive -Path dist/, node_modules/, package.json -DestinationPath deploy.zip

# Deploy to App Service
az webapp deploy \
  --resource-group $RG \
  --name "cedarguard-gov-api" \
  --src-path deploy.zip \
  --type zip \
  --async false
```

### 3.10 Smoke Test the API

```powershell
$API_URL = "https://cedarguard-gov-api.azurewebsites.net"

# Health check (no auth required)
Invoke-RestMethod -Uri "$API_URL/health" -Method GET
# Expected: {"status":"ok","version":"1.0.0","db":"connected","blob":"connected"}

# Verify CORS for Electron origin
$headers = @{ Origin = "null" }
Invoke-WebRequest -Uri "$API_URL/health" -Headers $headers -Method OPTIONS
# Expected: 200 with Access-Control-Allow-Origin: null
```

---

## 4. Desktop App Distribution

### 4.1 Build the Electron App

On a Windows build machine (or CI runner):

```powershell
cd apps/desktop/

# Install dependencies
npm ci

# Copy and configure env
Copy-Item .env.example .env.production
# Set values:
#   VITE_API_URL=https://cedarguard-gov-api.azurewebsites.net
#   VITE_ENTRA_CLIENT_ID=<DESKTOP_APP_CLIENT_ID>
#   VITE_ENTRA_TENANT_ID=<ENTRA_EXTERNAL_TENANT_ID>
#   VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/<ENTRA_EXTERNAL_TENANT_ID>

# Build web assets (Vite)
npm run build:web

# Package Electron (produces installer in dist/)
npm run dist
```

The build process produces:
- `dist/CedarGuard Gov Setup 1.0.0.exe` — NSIS installer (for manual distribution)
- `dist/CedarGuard Gov-1.0.0-win.zip` — Portable (for GPO deployment)
- `dist/latest.yml` — Auto-update manifest

### 4.2 Code Sign the Installer

```powershell
# Using Azure Key Vault-backed signing (recommended)
# Requires AzureSignTool: https://github.com/vcsjones/AzureSignTool

AzureSignTool sign \
  --azure-key-vault-url "https://kv-cedarguard-gov.vault.azure.net" \
  --azure-key-vault-certificate "cedarguard-ev-cert" \
  --azure-key-vault-client-id <SP_CLIENT_ID> \
  --azure-key-vault-client-secret <SP_SECRET> \
  --azure-key-vault-tenant-id <TENANT_ID> \
  --timestamp-rfc3161 "http://timestamp.digicert.com" \
  --verbose \
  "dist/CedarGuard Gov Setup 1.0.0.exe"

# Verify signature
Get-AuthenticodeSignature "dist/CedarGuard Gov Setup 1.0.0.exe" | \
  Select-Object Status, SignerCertificate
# Expected: Status=Valid, SignerCertificate=<Your EV cert subject>
```

### 4.3 Distribution Methods

#### Option A: GPO Software Deployment (Recommended for domain-joined workstations)

```powershell
# Copy MSI/EXE to network share
Copy-Item "dist/CedarGuard Gov Setup 1.0.0.exe" \\fileserver\software\cedarguard\

# Create GPO:
# Computer Configuration → Software Settings → Software Installation
# → New → Package → \\fileserver\software\cedarguard\CedarGuard Gov Setup 1.0.0.exe
# → Deployment type: Assigned
```

#### Option B: SCCM/Intune Deployment

```powershell
# Silent install command (for SCCM/Intune deployment)
"CedarGuard Gov Setup 1.0.0.exe" /S /D="C:\Program Files\CedarGuard Gov"

# Silent uninstall
"C:\Program Files\CedarGuard Gov\Uninstall CedarGuard Gov.exe" /S
```

#### Option C: Manual Distribution

Distribute the signed installer via secure internal channel. Users run the installer directly. No admin rights required (user-space install to `%LOCALAPPDATA%`).

### 4.4 Auto-Update Configuration

CedarGuard Gov uses `electron-updater` for automatic updates. The update feed is hosted on Azure Blob Storage:

```powershell
# Upload update artifacts to blob storage after each release
az storage blob upload-batch \
  --account-name "stcedarguardgov" \
  --destination "updates" \
  --source "dist/" \
  --pattern "*.exe" \
  --overwrite true

az storage blob upload \
  --account-name "stcedarguardgov" \
  --container-name "updates" \
  --name "latest.yml" \
  --file "dist/latest.yml" \
  --overwrite true
```

The `electron-builder.yml` publish config must point to:
```yaml
publish:
  provider: generic
  url: https://stcedarguardgov.blob.core.windows.net/updates/
```

---

## 5. First-Run Setup Screen

When a user launches CedarGuard Gov for the first time (no stored credentials detected), the setup wizard guides them through configuration.

### 5.1 Screen 1: Welcome

> **Screenshot placeholder**: Welcome screen with CedarGuard logo and gov crest

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│         [CedarGuard Logo]  [Gov Crest]               │
│                                                       │
│    Welcome to CedarGuard Gov                          │
│    Compliance & Risk Management                       │
│    for the Built Environment                          │
│                                                       │
│    This application connects to your organisation's  │
│    CedarGuard API at:                                 │
│                                                       │
│    [ https://cedarguard-gov-api.azurewebsites.net ]  │
│                                                       │
│    ┌──────────────────────────────────────────────┐  │
│    │  [ Use this URL ]  [ Enter custom URL ]      │  │
│    └──────────────────────────────────────────────┘  │
│                                                       │
│                            [ Next → ]                 │
└─────────────────────────────────────────────────────┘
```

The API URL is baked into the build at compile time via `VITE_API_URL`. The custom URL option is for departments with their own App Service deployment.

### 5.2 Screen 2: Sign In

> **Screenshot placeholder**: Microsoft sign-in button screen

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│    Sign in to CedarGuard Gov                          │
│                                                       │
│    Your IT team has configured Single Sign-On        │
│    using your Microsoft work account.                 │
│                                                       │
│    ┌──────────────────────────────────────────────┐  │
│    │                                              │  │
│    │   [M]  Sign in with Microsoft               │  │
│    │                                              │  │
│    └──────────────────────────────────────────────┘  │
│                                                       │
│    A browser window will open for authentication.     │
│    Return here after signing in.                      │
│                                                       │
└─────────────────────────────────────────────────────┘
```

Clicking "Sign in with Microsoft":
1. Opens the system browser to the Entra External ID login page
2. User authenticates with their work account (MFA if configured)
3. Browser redirects to `cedarguard://auth/callback?code=...`
4. Electron intercepts the custom protocol redirect
5. Main process exchanges code for tokens via MSAL
6. Tokens stored in `safeStorage` (OS credential store)
7. App proceeds to the dashboard

### 5.3 Screen 3: Organisation Setup (First-Time Super Admin Only)

> **Screenshot placeholder**: Organisation configuration screen

If the signing-in user is the first super_admin and no organisation has been configured:

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│    Set Up Your Organisation                           │
│                                                       │
│    Organisation Name                                  │
│    [ _________________________________ ]              │
│                                                       │
│    Sector                                             │
│    [ Central Government              ▼ ]              │
│                                                       │
│    Primary Contact Email                              │
│    [ _________________________________ ]              │
│                                                       │
│    Subscription Tier                                  │
│    [ Enterprise                      ▼ ]              │
│                                                       │
│                 [ ← Back ]  [ Complete Setup → ]      │
└─────────────────────────────────────────────────────┘
```

### 5.4 Subsequent Launches

After first run, stored credentials are loaded silently from `safeStorage`. If the token is still valid, the user goes directly to the dashboard. If expired, MSAL performs a silent refresh. If refresh fails, the sign-in screen is shown again.

---

## 6. Post-Install Verification Checklist

Complete all 19 items in order. Do not mark as complete until the item is verified.

### Infrastructure

- [ ] **1. Resource group created** — `rg-cedarguard-gov-prod` visible in Azure Portal
- [ ] **2. Bicep deployment succeeded** — no failed resources in deployment history
- [ ] **3. App Service running** — Status: Running; Runtime: Node 20 LTS
- [ ] **4. API health check passes** — `GET /health` returns `{"status":"ok","db":"connected"}`
- [ ] **5. Cosmos DB data-plane RBAC** — Role assignment for managed identity visible in Portal → Cosmos DB → Data Explorer (can query without errors)
- [ ] **6. Cosmos DB containers** — All 54 containers present (use Data Explorer or `az cosmosdb sql container list`)
- [ ] **7. Blob Storage containers** — All 6 containers present: `evidence`, `invoices`, `branding`, `governance-pdfs`, `updates`, `tac-attachments`

### Authentication

- [ ] **8. Entra External ID tenant** — Tenant created and accessible
- [ ] **9. Desktop app registration** — `cedarguard://` redirect URI registered
- [ ] **10. API app registration** — Scope `access_as_user` exposed and granted consent
- [ ] **11. App roles created** — All 4 roles: `super_admin`, `client_admin`, `project_manager`, `viewer`
- [ ] **12. CORS allows null origin** — `OPTIONS /health` with `Origin: null` returns `Access-Control-Allow-Origin: null`

### Desktop App

- [ ] **13. Installer signed** — `Get-AuthenticodeSignature` returns `Valid`
- [ ] **14. First-run sign-in works** — Can authenticate with Entra account; token stored
- [ ] **15. Dashboard loads** — No console errors; project list visible
- [ ] **16. API connectivity** — Dashboard data loads from API (not cached/empty state)

### AI & Features

- [ ] **17. Azure OpenAI connected** — AI Risk Identification page: run analysis → returns results (not "AI service not configured" error)
- [ ] **18. AI Chat connected** — Chat page: ask "list my projects" → Cedar AI responds with tool use
- [ ] **19. TAC feature accessible** — Technical Assurance menu visible for authorised users; Enquiry Workspace loads without errors

### Optional (Recommended)

- [ ] **20. Logic Apps enabled** — All 3 workflow definitions deployed and in "Enabled" state
- [ ] **21. Application Insights** — Dashboard showing live requests from smoke test
- [ ] **22. Key Vault secrets** — All secrets accessible from App Service (no KeyVaultReference errors in App Service logs)

---

## 7. User Provisioning

### 7.1 Adding New Users

Users are provisioned in the Entra External ID tenant:

```
Entra External ID Portal → Users → New user → Create new user

Fill in:
  User principal name: firstname.lastname@cedarguard-gov.onmicrosoft.com
  Display name: First Last
  Password: (auto-generate, force change on first login)
```

### 7.2 Assigning Roles

```
Entra External ID Portal → Enterprise applications
→ CedarGuard Gov Desktop → Users and groups → Add user/group
→ Select user → Select role (super_admin / client_admin / project_manager / viewer)
→ Assign
```

> **Note**: Role assignments take effect on the next token refresh (up to 1 hour). For immediate effect, ask the user to sign out and back in.

### 7.3 Bulk User Import

For large rollouts, use the Entra bulk import feature:

```powershell
# Download the bulk import template
# Portal → Users → Bulk operations → Bulk create → Download template

# Fill in the CSV with columns:
# version, Name [displayName], User name [userPrincipalName], Initial password, Block sign in, ...

# Upload via Portal → Users → Bulk operations → Bulk create → Upload CSV
```

### 7.4 Deprovisioning

```
Entra External ID Portal → Users → Select user → Delete
```

Deleting the Entra user does NOT delete their CedarGuard data in Cosmos DB. To purge data, a super_admin must use the Admin Panel → Users → Delete Account function within the CedarGuard app.

---

## 8. Operations & Maintenance

### 8.1 Monitoring

**Application Insights Dashboard** — primary operational dashboard:
```
Azure Portal → Application Insights → cedarguard-gov-insights
→ Overview: request rate, failure rate, response time
→ Live Metrics: real-time request stream
→ Failures: exception details + stack traces
→ Performance: slowest operations
```

**Key alerts to configure**:

| Alert | Condition | Action |
|---|---|---|
| API Availability | Success rate < 99% over 5 min | Email IT team |
| Cosmos DB RU Throttling | HTTP 429 rate > 1% | Email IT team + scale up |
| Failed Authentication | > 10 failures in 5 min | Email security team |
| App Service CPU | > 80% for 10 min | Email IT team |

### 8.2 Scheduled Jobs (Logic Apps)

Three Logic Apps run on schedule:

| Workflow | Schedule | Purpose |
|---|---|---|
| `cedarguard-chase-engine` | Daily 08:00 UTC | Sends chase notifications for overdue items |
| `cedarguard-monthly-snapshot` | 1st of month, 00:30 UTC | Takes portfolio-wide data snapshot for trends |
| `cedarguard-retention-purge` | Weekly Sunday 02:00 UTC | Purges soft-deleted items older than 90 days |

To check workflow run history:
```
Azure Portal → Logic Apps → [workflow name] → Run history
```

To manually trigger (e.g., for testing):
```powershell
az logic workflow run trigger \
  --resource-group $RG \
  --workflow-name "cedarguard-chase-engine" \
  --trigger-name "Recurrence"
```

### 8.3 Database Maintenance

**Backup**: Cosmos DB continuous backup is enabled by default (7-day point-in-time restore). For compliance with government retention requirements, enable periodic backup with 30-day retention:
```
Portal → Cosmos DB → cedarguard-gov → Backup & Restore
→ Backup policy: Periodic
→ Backup interval: 4 hours
→ Backup retention: 30 days
→ Backup storage redundancy: Geo-redundant
```

**Monitoring RU consumption**:
```powershell
az monitor metrics list \
  --resource $COSMOS_ACCOUNT_ID \
  --metric "TotalRequestUnits" \
  --interval PT1H \
  --start-time (Get-Date).AddDays(-7).ToString("o") \
  --end-time (Get-Date).ToString("o") \
  --output table
```

### 8.4 Updating the Desktop App

1. Build and sign the new installer (see §4.1–4.2)
2. Upload to Blob Storage `updates` container (see §4.4)
3. The app checks for updates on launch and notifies users
4. Users click "Restart to Update" to apply
5. For forced updates, increment `minimumVersion` in `electron-builder.yml`

### 8.5 Updating the API

```powershell
cd apps/api/
git pull origin main
npm ci
npm run build
Compress-Archive -Path dist/, node_modules/, package.json -DestinationPath deploy.zip -Force
az webapp deploy \
  --resource-group $RG \
  --name "cedarguard-gov-api" \
  --src-path deploy.zip \
  --type zip
```

Zero-downtime deployment is handled by App Service deployment slots. For production, use the staging slot and swap:
```powershell
# Deploy to staging slot first
az webapp deploy --slot staging ...

# Run smoke tests against staging
Invoke-RestMethod "https://cedarguard-gov-api-staging.azurewebsites.net/health"

# Swap staging → production
az webapp deployment slot swap \
  --resource-group $RG \
  --name "cedarguard-gov-api" \
  --slot staging \
  --target-slot production
```

---

## 9. Troubleshooting

| Symptom | Likely Cause | Resolution |
|---|---|---|
| Sign-in browser window opens then returns "Page not found" | `cedarguard://` custom protocol not registered | Reinstall the desktop app; verify protocol registration in `HKCU:\SOFTWARE\Classes\cedarguard` |
| API returns `403` on all Cosmos operations | Data-plane RBAC not assigned | Re-run §3.7 role assignment; verify with `az cosmosdb sql role assignment list` |
| API returns `401` on all requests | CORS not allowing `null` origin | Add `null` to `CORS_ALLOWED_ORIGINS` App Service setting |
| API health check returns `"db":"disconnected"` | Cosmos DB connection string/endpoint wrong | Verify `COSMOS_ENDPOINT` App Service setting; test with `az cosmosdb show` |
| "AI service not configured" in app | `AZURE_OPENAI_KEY` or `AZURE_OPENAI_ENDPOINT` missing | Set App Service config settings; redeploy |
| GPT-4o returns `400 Bad Request` | Prompt does not contain the word "JSON" | System prompt must include "Respond in JSON" — check `apps/api/routes/ai.ts` |
| Desktop app shows blank white screen on launch | HashRouter not used — BrowserRouter fails on `file://` | Rebuild with `HashRouter`; check `apps/web/src/App.tsx` |
| Token silent refresh fails constantly | Entra External ID session policy too short | Increase session lifetime in Entra → Conditional Access → Session controls |
| Logic App runs fail with `401` | Logic App managed identity not granted App Service invoke permission | Assign `Website Contributor` role to Logic App identity on App Service |
| Evidence file upload fails (`403`) | Blob SAS token expired or managed identity not assigned `Storage Blob Data Contributor` | Assign `Storage Blob Data Contributor` to App Service managed identity on storage account |
| TAC Enquiry Workspace blank | `enquiries` Cosmos container not created | Run `npm run seed` again; check container list in Cosmos Data Explorer |
| Desktop app update not detected | `latest.yml` not uploaded to Blob `updates` container | Upload `latest.yml` after each build (see §4.4) |
| "Rate limit reached" in AI Chat | User has hit 20 messages/hour limit | Wait for the window to reset (shown in UI); or adjust `MAX_MESSAGES_PER_HOUR` in `chatRateLimit.ts` |
| App Service out of memory / restarts | Memory leak in streaming endpoint | Check Application Insights for memory metrics; scale to P2v3 if needed |

---

## 10. Security & Compliance

### 10.1 Cyber Essentials Plus Controls

| Control | Implementation |
|---|---|
| Firewalls | Azure NSG restricts inbound to 443 only; outbound restricted to listed endpoints |
| Secure configuration | App Service: HTTPS-only, TLS 1.2 minimum, no FTP; Cosmos DB: no public key auth |
| Access control | Entra External ID with MFA; RBAC for all Azure resources; no shared accounts |
| Malware protection | Windows Defender on workstations; EV-signed installer prevents SmartScreen bypass |
| Patch management | App Service OS patches automatic; Electron auto-update for app patches |

### 10.2 Data Classification

| Data Type | Classification | Stored In | Encryption |
|---|---|---|---|
| User credentials | OFFICIAL | Entra External ID | AES-256 (Microsoft managed) |
| Project/risk data | OFFICIAL | Cosmos DB | AES-256 at rest (Microsoft managed) |
| Evidence documents | OFFICIAL | Azure Blob Storage | AES-256 at rest (Microsoft managed) |
| Auth tokens (client) | OFFICIAL-SENSITIVE | OS credential store via `safeStorage` | OS keychain encryption |
| AI prompts | OFFICIAL | Transit only (Azure OpenAI) | TLS 1.2 in transit; not stored |

### 10.3 Audit Logging

All user actions are logged to the `activityLog` Cosmos container with:
- `userId`, `clientId`, `action`, `resourceType`, `resourceId`, `timestamp`
- Logs are retained for 90 days in Cosmos DB
- Application Insights retains telemetry for 90 days (configurable to 730 days)

To export audit logs for compliance review:
```powershell
# Query activity log via Cosmos DB (requires admin access)
# Or use the Admin Panel → Activity Log tab in the app
```

### 10.4 Penetration Testing

Before go-live, conduct a penetration test covering:
- Electron IPC bridge (renderer → main process privilege escalation)
- API authentication bypass
- Cosmos DB injection via API parameters
- Blob Storage SAS token enumeration
- Electron `contextIsolation` and `nodeIntegration` settings

Verify `apps/desktop/main.ts` has:
```typescript
webPreferences: {
  contextIsolation: true,      // MUST be true
  nodeIntegration: false,      // MUST be false
  sandbox: true,               // Recommended
  webSecurity: true,           // MUST be true
  preload: path.join(__dirname, 'preload.js'),
}
```

---

## 11. Appendix

### Appendix A: Environment Variables Reference

#### App Service (`apps/api/.env`)

| Variable | Required | Example | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Node environment |
| `COSMOS_ENDPOINT` | Yes | `https://cosmos-cedarguard-gov.documents.azure.com:443/` | Cosmos DB account endpoint |
| `COSMOS_DATABASE` | Yes | `cedarguard` | Cosmos DB database name |
| `AZURE_BLOB_CONNECTION_STRING` | Yes | `DefaultEndpointsProtocol=https;...` | Blob Storage connection string |
| `AZURE_OPENAI_ENDPOINT` | Yes | `https://oai-cedarguard-gov.openai.azure.com/` | Azure OpenAI endpoint |
| `AZURE_OPENAI_KEY` | Yes | `abc123...` | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | Yes | `gpt-4o` | Deployment name in Azure AI Studio |
| `ENTRA_TENANT_ID` | Yes | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Entra External ID tenant ID |
| `ENTRA_API_CLIENT_ID` | Yes | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | API app registration client ID |
| `ENTRA_API_AUDIENCE` | Yes | `api://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Token audience for validation |
| `CORS_ALLOWED_ORIGINS` | Yes | `null` | Must be literal `null` for Electron |
| `PORT` | No | `8080` | App Service sets this automatically |

#### Desktop App (`apps/desktop/.env.production`)

| Variable | Required | Example | Description |
|---|---|---|---|
| `VITE_API_URL` | Yes | `https://cedarguard-gov-api.azurewebsites.net` | Backend API URL |
| `VITE_ENTRA_CLIENT_ID` | Yes | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Desktop app registration client ID |
| `VITE_ENTRA_TENANT_ID` | Yes | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Entra External ID tenant ID |
| `VITE_ENTRA_AUTHORITY` | Yes | `https://login.microsoftonline.com/<TENANT_ID>` | MSAL authority URL |
| `VITE_ENTRA_REDIRECT_URI` | Yes | `cedarguard://auth/callback` | Custom protocol redirect |
| `VITE_UPDATE_URL` | No | `https://stcedarguardgov.blob.core.windows.net/updates/` | Auto-update feed URL |

### Appendix B: Cosmos DB Container Schema

All 54 containers in the `cedarguard` database:

#### Core Containers (48)

| Container | Partition Key | Description |
|---|---|---|
| `users` | `/uid` | User profiles and preferences |
| `clients` | `/clientId` | Organisation records |
| `projects` | `/clientId` | Project records |
| `programmes` | `/clientId` | Programme records |
| `risks` | `/clientId` | Risk register items |
| `issues` | `/clientId` | Issue records |
| `kris` | `/clientId` | Key Risk Indicators |
| `complianceItems` | `/clientId` | Compliance item records |
| `complianceAnalysis` | `/clientId` | AI compliance analysis results |
| `complianceDomains` | `/clientId` | Custom compliance domains |
| `complianceLibrary` | `/domain` | Platform compliance library |
| `regulations` | `/domain` | Regulations library |
| `customRegulations` | `/clientId` | Client-specific regulations |
| `activityLog` | `/clientId` | Audit trail |
| `notifications` | `/uid` | User notifications |
| `apiKeys` | `/uid` | Developer API keys |
| `teamMembers` | `/clientId` | Organisation team roster |
| `tasks` | `/uid` | Personal task items |
| `milestones` | `/projectId` | Project milestones |
| `evidence` | `/projectId` | Evidence document metadata |
| `lessonsLearned` | `/clientId` | Lessons learned entries |
| `cpdModules` | `/clientId` | CPD training records |
| `pricingConfig` | `/tier` | Subscription pricing tiers |
| `invoices` | `/clientId` | Invoice records |
| `mappingDirectives` | `/clientId` | AI system mapping config |
| `forwardPlan` | `/clientId` | Governance forward plan items |
| `meetings` | `/clientId` | Governance meeting records |
| `reports` | `/clientId` | Generated report metadata |
| `calendarEvents` | `/clientId` | Calendar event records |
| `monthlySnapshots` | `/clientId` | Historical data snapshots |
| `preferences` | `/uid` | User preferences |
| `remoteContent` | `/type` | Remote CMS content cache |
| `systemMappings` | `/clientId` | AI directive mappings |
| `strategicInsights` | `/clientId` | AI strategic analysis cache |
| `riskAnalysis` | `/clientId` | AI risk analysis results |
| `controlSuggestions` | `/clientId` | AI control measure suggestions |
| `complianceOutlook` | `/clientId` | AI compliance forecast cache |
| `kriHistory` | `/clientId` | KRI value history |
| `deliveryTeam` | `/projectId` | Project delivery team members |
| `projectContext` | `/projectId` | Project context configuration |
| `programmeContext` | `/programmeId` | Programme context config |
| `chaseLog` | `/clientId` | Chase engine notification log |
| `retentionLog` | `/clientId` | Retention purge audit log |
| `pushTokens` | `/uid` | FCM push notification tokens |
| `billingEvents` | `/clientId` | Billing activity log |
| `workspaceSettings` | `/clientId` | Organisation workspace config |
| `featureFlags` | `/clientId` | Per-org feature flag overrides |
| `chatRateLimits` | `/uid` | AI chat rate limit counters |

#### TAC Containers (6)

| Container | Partition Key | Description |
|---|---|---|
| `enquiries` | `/clientId` | TAC enquiry records |
| `rfis` | `/clientId` | Request for Information records |
| `tacDrawings` | `/enquiryId` | Technical drawing references |
| `tacCosts` | `/clientId` | Technical assurance cost records |
| `tacCompliance` | `/clientId` | TAC compliance items |
| `tacAttachmentMeta` | `/enquiryId` | Attachment metadata (files in Blob) |

### Appendix C: Firewall Allow-List

Add the following to your network proxy/firewall allow-list:

```
# Azure Active Directory / Entra ID
login.microsoftonline.com          443/TCP
*.b2clogin.com                     443/TCP
*.msftauth.net                     443/TCP

# Azure Management
management.azure.com               443/TCP
*.azure.com                        443/TCP

# App Service
cedarguard-gov-api.azurewebsites.net   443/TCP

# Cosmos DB
cosmos-cedarguard-gov.documents.azure.com   443/TCP

# Blob Storage
stcedarguardgov.blob.core.windows.net   443/TCP

# Azure OpenAI
oai-cedarguard-gov.openai.azure.com    443/TCP

# NTP (required for token validation)
time.windows.com                   123/UDP
```

---

*Document version: 1.0*
*Last updated: 2026-05-16*
*Classification: OFFICIAL*
*Contact: cedarguard-gov-support@your-org.gov.uk*

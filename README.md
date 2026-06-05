# Nova Central — Server Backup Manager
Syncing and backing up server data (Ubuntu/Windows) to Google Drive.

## 🌟 Key Features

- 🔄 **Auto Backup** — Scheduled synchronization using standard cron expressions.
- 👁 **File Watcher** — Real-time monitoring and auto-sync for instant changes.
- 🖱 **Manual Backup & File Manager** — Browse local server files, trigger uploads to Google Drive, and download items back to local folders.
  - **Persistent Background Tasks:** Uploads and downloads run as background tasks that persist and execute even if the browser is closed or refreshed.
  - **Fault-Tolerant & Resumable:** Failed transfers can be resumed from where they were interrupted. Checkpoint tracking avoids repeating already-completed file transfers. Single-file errors do not abort the entire transfer; instead, other files continue processing, and the task finishes with a `Completed with Errors` status.
  - **Real-Time Log Streaming:** Uses Server-Sent Events (SSE) with fallback polling and auto-reconnection to stream verbose, live transfer logs.
  - **Modern UI Panel:** Includes a minimizable floating panel, running elapsed timer, detailed timestamps, auto-scroll control, and an expandable failed-files panel showing precise error details.
- 🛡️ **Enterprise Security**
  - **Audit Logs:** Global tracking of sensitive user actions (logins, setting changes, backup toggles) with IP logging.
  - **Forced Password Rotation:** Enforced password change upon first administrative login.
  - **Rate Limiting Resilience:** Exponential backoff mechanisms handling Google Drive API constraints safely.
- ☁️ **Google Drive API** — Direct native sync with intelligent collision and integrity handling (SHA-256).
- 📊 **Dashboard & Exclusions** — Real-time stats, logs, and robust File Exclusion Filters (Glob patterns & file sizes).

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React, TypeScript, Tailwind CSS v4, shadcn/ui |
| **Backend** | Express.js, Node.js 20+, TypeScript |
| **Database** | SQLite (sql.js — pure JS/WASM) |
| **Auth & Security** | JWT (jose), bcryptjs, HTTP-Only Cookies, Trust Proxies |
| **Drive Integration** | Google APIs v3 |

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 20+
- A Google Cloud Platform (GCP) Service Account with Google Drive API enabled.

### 2. Setup Backend

```bash
cd backend
cp .env.example .env
npm install
```

> **CRITICAL SECURITY STEP:** Edit your `.env` file. You **must** generate secure random strings for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (e.g. using `openssl rand -base64 64`). You must also define your initial `ADMIN_PASSWORD`.

```bash
# Start backend in dev mode
npm run dev
```

### 3. Setup Frontend

```bash
cd frontend
npm install
# Start frontend in dev mode
npm run dev
```

### 4. Google Drive Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project and enable the **Google Drive API**.
3. Create a **Service Account** and download its JSON key file.
4. Save the key file to the exact path: `backend/credentials/service-account.json`.
5. Create a folder in your personal or organizational Google Drive.
6. Share that Drive folder with your service account's generated email address (giving it Editor access).
7. Copy the ID of the folder from its URL and configure it inside the Nova Central Settings UI.

### 5. Default Login

- **Username:** `admin`
- **Password:** *(Whatever you set as `ADMIN_PASSWORD` in your `.env` file)*

> ⚠️ **Note:** Upon your first successful login, the system will instantly force you to create a new, strong password before you can access the dashboard.

## 🔐 Security Architecture

Nova Central implements strict security practices to ensure data remains secure on public-facing networks:

- **JWT Tokens via HttpOnly Cookies:** Prevents Cross-Site Scripting (XSS) attacks by removing tokens from JavaScript accessibility and JSON response bodies.
- **Path Traversal Protection:** All filesystem interactions are strictly sandboxed against escaping their authorized root boundaries.
- **Audit Trails:** The `/api/audit` subsystem tracks all sensitive activity, ensuring observability over administrative actions.
- **Forced Password Rotation:** Flag-based redirection prevents users with weak or default passwords from using the system.
- **bcrypt Hashing (Cost 12):** Provides strong brute-force resistance.
- **Rate Limiting:** Protects `/auth/login` (5 per 15m) and general APIs (200 per 15m).
- **Data Integrity:** Transfers are verified using streamed SHA-256 hashing.

## 📁 Repository Structure

```
nova_central/
├── backend/          # Express.js API server
│   ├── src/
│   │   ├── config/       # Env validation, database bootstrap
│   │   ├── controllers/  # API business logic (Auth, Filemanager, Audit, Settings)
│   │   ├── middleware/   # Rate Limiters, JWT Verification, Security Headers
│   │   ├── models/       # Database schemas (Backup, Settings, User, Task)
│   │   └── services/     # Drive integration, Sync engine, Watchers
│   └── package.json
├── frontend/         # Next.js UI Application
│   ├── src/
│   │   ├── app/          # Core pages (Login, Dashboard, Audit, Settings)
│   │   ├── components/   # UI elements (Sidebar, Header, shadcn primitives)
│   │   ├── hooks/        # Auth Context, Polling
│   │   └── lib/          # API Client interface
│   └── package.json
└── README.md
```

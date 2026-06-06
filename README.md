# Nova Central — Data Backup Manager

Aplikasi untuk sinkronisasi dan backup data server (Ubuntu/Windows) ke Google Drive secara otomatis maupun manual.

## Fitur Utama

- **Backup Otomatis** — Penjadwalan sinkronisasi menggunakan cron expression standar.
- **File Watcher** — Monitoring file secara real-time, langsung sync ketika ada perubahan.
- **Backup Manual dan File Manager** — Jelajahi file di server lokal, upload ke Google Drive, atau download dari Drive ke folder lokal.
  - **Background Task yang Persistent:** Upload dan download berjalan di background. Tetap jalan meskipun browser ditutup atau di-refresh.
  - **Tahan Gangguan dan Bisa Dilanjutkan:** Transfer yang gagal bisa dilanjutkan dari titik terakhir. Tracking checkpoint mencegah file yang sudah selesai diproses ulang. Kalau satu file error, file lain tetap jalan, dan task selesai dengan status `Completed with Errors`.
  - **Log Streaming Real-Time:** Menggunakan Server-Sent Events (SSE) dengan fallback polling dan auto-reconnect untuk menampilkan log transfer secara live.
  - **Panel UI Modern:** Panel floating yang bisa di-minimize, timer elapsed, timestamp detail, kontrol auto-scroll, dan panel file gagal yang bisa di-expand dengan detail error.
- **Keamanan**
  - **Audit Log:** Tracking global untuk aksi sensitif (login, perubahan setting, toggle backup) lengkap dengan pencatatan IP.
  - **Wajib Ganti Password:** Sistem memaksa ganti password saat login pertama kali.
  - **Rate Limiting:** Mekanisme exponential backoff untuk menangani batasan Google Drive API.
- **Google Drive API** — Sinkronisasi langsung ke Google Drive dengan penanganan collision dan verifikasi integritas file (SHA-256).
- **Dashboard dan Exclusion Filter** — Statistik real-time, log, dan filter exclusion file (pola Glob dan ukuran file).

## Status Saat Ini

### Yang Sudah Jalan

| Komponen | Status |
|---|---|
| Backend API (Express.js) | Selesai |
| Autentikasi (JWT + HttpOnly Cookie) | Selesai |
| Dashboard dengan statistik real-time | Selesai |
| Backup otomatis (scheduler + cron) | Selesai |
| File Watcher (monitoring real-time) | Selesai |
| Integrasi Google Drive API | Selesai |
| File Manager (browse, upload, download) | Selesai |
| Background Task System (persistent, resumable) | Selesai |
| Log streaming via SSE | Selesai |
| Audit Log | Selesai |
| Halaman Settings | Selesai |
| Halaman Log Viewer | Selesai |
| Rate Limiting dan Security Headers | Selesai |
| Forced Password Change (login pertama) | Selesai |

### Halaman Frontend

| Halaman | Keterangan |
|---|---|
| Login | Halaman login dengan validasi |
| Change Password | Wajib ganti password saat pertama kali login |
| Dashboard | Statistik backup, status service, overview |
| Backup | Kontrol start/stop backup, daftar job |
| File Manager | Browse file lokal dan Drive, upload/download |
| Logs | Viewer log aplikasi |
| Audit | Riwayat aksi sensitif user |
| Settings | Konfigurasi backup, Drive, exclusion filter |

### API Endpoint yang Tersedia

| Grup | Endpoint |
|---|---|
| Auth | Login, logout, refresh token, me, change password |
| Backup | Start, stop, status, daftar job, detail job |
| Dashboard | Statistik dashboard |
| Logs | Ambil log aplikasi |
| Settings | Baca/update settings, test koneksi Drive, OAuth flow |
| File Manager | List/create/rename/delete (lokal dan Drive), compare, upload, download |
| Task | List task, detail task, resume task, SSE stream |
| Audit | Ambil audit log |

## Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| **Backend** | Express.js 5, Node.js 20+, TypeScript |
| **Database** | SQLite (sql.js — pure JS/WASM) |
| **Auth dan Keamanan** | JWT (jose), bcryptjs, HttpOnly Cookie, Helmet |
| **Integrasi Drive** | Google APIs v3 |
| **Process Manager** | PM2 (ecosystem.config.js) |

## Cara Menjalankan

### 1. Prasyarat

- Node.js 20 atau lebih baru
- Akun Google Cloud Platform (GCP) Service Account dengan Google Drive API yang sudah diaktifkan

### 2. Setup Backend

```bash
cd backend
cp .env.example .env
npm install
```

> **Langkah Keamanan Penting:** Edit file `.env` kamu. Wajib generate string acak yang kuat untuk `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET` (contoh: pakai `openssl rand -base64 64`). Jangan lupa juga set `ADMIN_PASSWORD`.

```bash
# Jalankan backend dalam mode development
npm run dev
```

### 3. Setup Frontend

```bash
cd frontend
npm install
# Jalankan frontend dalam mode development
npm run dev
```

Frontend akan berjalan di port 4300 (`http://localhost:4300`).

### 4. Setup Google Drive

1. Buka [Google Cloud Console](https://console.cloud.google.com).
2. Buat project baru dan aktifkan **Google Drive API**.
3. Buat **Service Account** dan download file JSON key-nya.
4. Simpan file key tersebut ke path: `backend/credentials/service-account.json`.
5. Buat folder di Google Drive kamu (personal atau organisasi).
6. Share folder tersebut ke email service account (kasih akses Editor).
7. Salin ID folder dari URL-nya dan masukkan di halaman Settings Nova Central.

### 5. Login Pertama Kali

- **Username:** `admin`
- **Password:** *(sesuai yang kamu set di `ADMIN_PASSWORD` pada file `.env`)*

> Saat login pertama kali, sistem akan langsung memaksa kamu membuat password baru yang kuat sebelum bisa masuk ke dashboard.

### 6. Jalankan di Production (PM2)

```bash
# Build backend dan frontend terlebih dahulu
cd backend && npm run build
cd ../frontend && npm run build

# Jalankan dengan PM2
pm2 start ecosystem.config.js
```

## Arsitektur Keamanan

Nova Central menerapkan beberapa lapisan keamanan untuk menjaga data tetap aman di jaringan publik:

- **JWT Token via HttpOnly Cookie:** Mencegah serangan XSS karena token tidak bisa diakses lewat JavaScript atau response body.
- **Proteksi Path Traversal:** Semua interaksi filesystem di-sandbox supaya tidak bisa keluar dari batas direktori yang diizinkan.
- **Audit Trail:** Subsistem `/api/audit` mencatat semua aktivitas sensitif untuk memastikan transparansi aksi admin.
- **Wajib Ganti Password:** Redirect otomatis memaksa user dengan password default untuk mengganti password sebelum bisa menggunakan sistem.
- **Hashing bcrypt (Cost 12):** Memberikan ketahanan yang kuat terhadap brute-force.
- **Rate Limiting:** Proteksi endpoint `/auth/login` (5 request per 15 menit) dan API umum (200 request per 15 menit).
- **Verifikasi Integritas Data:** Transfer file diverifikasi menggunakan hashing SHA-256.

## Struktur Repository

```
nova_central/
├── backend/              # Server API Express.js
│   ├── src/
│   │   ├── config/       # Validasi env, bootstrap database
│   │   ├── controllers/  # Logic API (Auth, Backup, FileManager, Audit, Settings, Task, Logs)
│   │   ├── middleware/   # Rate Limiter, Verifikasi JWT, Security Headers
│   │   ├── models/       # Skema database (Backup, Settings, User, FileRecord)
│   │   ├── routes/       # Definisi route API
│   │   ├── services/     # Integrasi Drive, Sync engine, Watcher, Task, Scheduler
│   │   ├── types/        # TypeScript type definitions
│   │   └── utils/        # Fungsi utility
│   └── package.json
├── frontend/             # Aplikasi UI Next.js
│   ├── src/
│   │   ├── app/          # Halaman (Login, Dashboard, Backup, Files, Logs, Audit, Settings)
│   │   ├── components/   # Komponen UI (Layout, File Manager, shadcn primitives)
│   │   ├── hooks/        # Auth Context, custom hooks
│   │   ├── lib/          # API Client interface
│   │   ├── services/     # Service layer frontend
│   │   └── types/        # TypeScript type definitions
│   └── package.json
├── ecosystem.config.js   # Konfigurasi PM2 untuk production
└── README.md
```

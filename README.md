# 🏥 Dr. Dilip Dey Clinic - Full-Stack Website & Admin Management System

A modern, high-performance web platform for **Dr. Dilip Dey Clinic** featuring public appointment bookings, real-time consultation tracking, and a dedicated, password-protected administrative portal.

---

## 📁 Project Architecture (Single Clean Folder)

```text
├── backend/
│   ├── clinic.db                  # Local SQLite Database (auto-seeds defaults)
│   ├── database.js               # Database connection & schema migration
│   ├── server.js                 # Express REST API (Auth, Appointments, Tracking)
│   ├── appointments_backup.json  # Auto-synchronized fallback backup
│   └── package.json              # Backend dependencies
│
├── frontend/
│   ├── src/
│   │   ├── config.js             # Dynamic API URL (Local vs Production)
│   │   ├── pages/
│   │   │   ├── Home.jsx          # Public Clinic Portal (Hero, Services, Track, Book)
│   │   │   └── AdminDashboard.jsx # Secret Admin Management Portal
│   │   ├── index.css             # Liquid glass UI, responsive styling & animations
│   │   └── main.jsx              # React app entry
│   └── package.json              # Frontend dependencies (React, Vite, Lucide Icons)
│
├── package.json                  # Root orchestration package
├── start-dev.js                  # One-click runner (spawns frontend + backend)
└── README.md                     # Full documentation & client guide
```

---

## 🚀 How to Run Locally in VS Code

### Step 1: Open in VS Code
Open this project folder in Visual Studio Code (`File -> Open Folder...`).

### Step 2: Open Terminal
Press `` Ctrl + ` `` (Windows/Linux) or `` Cmd + ` `` (macOS) to open the built-in terminal.

### Step 3: First Time Setup (Install Dependencies)
If running for the first time, install all dependencies in one step:
```bash
npm run install:all
```

### Step 4: Start the System
Run the unified development command:
```bash
npm run dev
```

Both the **Backend API (with SQLite Database)** and the **Frontend Web App** will start concurrently in the terminal:
- 🌐 **Public Website**: [http://localhost:5173](http://localhost:5173)
- 🔐 **Secret Admin Portal**: [http://localhost:5173/secure-portal-dey-77x9q](http://localhost:5173/secure-portal-dey-77x9q)
- 🗄️ **Backend API & Database**: [http://localhost:5005](http://localhost:5005)
- 🔑 **Default Admin Password**: `admin123`

To stop the servers at any time, press `Ctrl + C` in the terminal.

---

## 🔑 Administrative Access & Credentials

- **Direct Portal URL**: `/secure-portal-dey-77x9q`
- **Default Master Password**: `admin123`
- **Security Features**:
  - Unlisted secret routing (not accessible from public navigation links).
  - Password prompt required on access and refresh.
  - JWT token session management.
  - Status management (`Pending` -> `Confirmed` / `Completed` / `Cancelled`).
  - Dual date filtering: **visitDate** (scheduled clinical visit) and **bookingDate** (date requested).
  - CSV export for clinic patient records.

---

## 🗄️ Local Database & Persistence

- **Engine**: SQLite3 (`backend/clinic.db`). No complex SQL servers (MySQL/Postgres) needed.
- **Safety Fallback**: Automatic synchronization with `backend/appointments_backup.json` guarantees patient logs are never lost even if the database file is rebuilt.
- **Dynamic API Switching**:
  - In local development (`localhost`), the frontend automatically connects to the local Express + SQLite database on port `5005`.
  - In production, it automatically connects to the cloud backend.

---

## 📦 Delivering to Client

You can deliver this complete project folder directly to your client:
1. Simply compress/zip this entire folder (or send the repository).
2. The client only needs [Node.js](https://nodejs.org) installed on their laptop/PC.
3. Once unzipped, opening in VS Code and typing `npm run dev` immediately launches the complete clinic application!

---

## ☁️ Live Cloud Deployments

- **Live Production Website**: [mydoctorbook.vercel.app](https://mydoctorbook.vercel.app)
- **Live Admin Portal**: [mydoctorbook.vercel.app/secure-portal-dey-77x9q](https://mydoctorbook.vercel.app/secure-portal-dey-77x9q)
- **GitHub Repository**: [github.com/jitkarmakar46/DR.-Dey-s-website](https://github.com/jitkarmakar46/DR.-Dey-s-website.git)

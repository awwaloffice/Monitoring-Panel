# Monitoring Panel

A modern NOC/ISP monitoring dashboard for internet destinations and local LAN devices, powered by MikroTik RouterOS API.

## ✅ Windows Compatible

This project uses **knex + sqlite3** which ships prebuilt Windows x64 binaries — **no Python, no node-gyp, no build tools required** on Windows.

---

## Features

- **Destination Monitor** — GGC, FNA, Games, CDN, DNS, IX, Other
- **Local Device Monitor** — ONU, Switch, OLT, AP, CCTV, Server, NAS, Gateway, Printer
- **Multi-Router Support** — Ping from multiple MikroTik routers, averaged results on dashboard
- **Real-time Dashboard** — Health scores, latency graphs, packet loss charts
- **Alerts** — Down/recovery/flapping detection with deduplication
- **Reports** — Latency, uptime, availability, CSV export
- **Bulk Import** — CSV import for routers, destinations, devices
- **Role-Based Access** — Full Access, Write, Readonly
- **Audit Log** — Full activity tracking
- **Docker Support** — One-command deployment

---

## Quick Start (Docker — Recommended)

```bash
cd monitoring-panel
docker-compose up -d
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

Default login: **admin / admin123**

---

## Manual Setup — Windows / Linux / macOS

### Step 1 — Backend

```bash
cd monitoring-panel\backend
npm install
node src/index.js
```

> ✅ No Python needed. `sqlite3` installs from prebuilt binaries automatically.

### Step 2 — Frontend

Open a new terminal:

```bash
cd monitoring-panel\frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## Environment Variables

Create `backend\.env` (optional — defaults work out of the box):

```env
PORT=4000
JWT_SECRET=change_this_to_a_long_random_string
DB_PATH=./data/monitoring.db
NODE_ENV=production
```

Create `frontend\.env` (optional):

```env
VITE_API_URL=http://localhost:4000
```

---

## Production Build

```bash
# Build frontend
cd frontend
npm run build
# Serve dist/ with any static server or nginx

# Run backend
cd ../backend
node src/index.js
```

---

## MikroTik RouterOS API Setup

1. Enable API on your MikroTik router:
   ```
   /ip service enable api
   /ip service set api port=8728
   ```

2. For SSL API (recommended for production):
   ```
   /ip service enable api-ssl
   /ip service set api-ssl port=8729
   ```

3. Create a dedicated read-only API user:
   ```
   /user group add name=monitoring policy=read,api,test
   /user add name=monitor password=SecurePass123 group=monitoring
   ```

4. Add the router in the app: **Management → Router Management → Add Router**

5. Test the connection with the **Test** button

---

## Bulk Import CSV Formats

Download templates from **Management → Bulk Import → Download Template**

### Routers CSV
```
name,host,username,password,apiPort,ssl,location,description,enabled
Core-Router-01,192.168.1.1,monitor,pass,8728,false,HQ,,true
```

### Destinations CSV
```
name,address,group,description,warningLatency,criticalLatency,warningLoss,criticalLoss,enabled
Google GGC,8.8.8.8,GGC,,30,100,10,50,true
```

### Local Devices CSV
```
name,ip,type,location,routerName,priority,description,enabled
ONU-001,192.168.10.1,ONU,POP-North,Core-Router-01,medium,,true
```

---

## User Roles

| Permission             | Full Access | Write | Readonly |
|------------------------|:-----------:|:-----:|:--------:|
| View dashboard/reports | ✅          | ✅    | ✅       |
| Add/edit routers       | ✅          | ✅    | ❌       |
| Add/edit destinations  | ✅          | ✅    | ❌       |
| Add/edit devices       | ✅          | ✅    | ❌       |
| Delete any item        | ✅          | ❌    | ❌       |
| User management        | ✅          | ❌    | ❌       |
| Audit log              | ✅          | ❌    | ❌       |
| System settings        | ✅          | ❌    | ❌       |

---

## API Endpoints

All endpoints require `Authorization: Bearer <token>` header except `/api/auth/login`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/dashboard/summary` | Overall stats |
| GET | `/api/dashboard/destination-groups` | Group summary |
| GET | `/api/dashboard/local-device-summary` | Device summary |
| GET | `/api/dashboard/recent-alerts` | Latest alerts |
| GET | `/api/routers` | List routers |
| POST | `/api/routers` | Add router |
| POST | `/api/routers/:id/test` | Test connection |
| GET | `/api/destinations` | List destinations |
| POST | `/api/destinations` | Add destination |
| GET | `/api/destinations/:id/history?range=1h` | History |
| GET | `/api/local-devices` | List devices |
| POST | `/api/local-devices` | Add device |
| GET | `/api/local-devices/:id/history?range=1h` | History |
| GET | `/api/alerts` | List alerts |
| GET | `/api/audit-logs` | Audit log |
| GET | `/api/audit-logs/export` | Export CSV |
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings` | Update settings |
| GET | `/api/reports/destinations` | Dest report |
| GET | `/api/reports/local-devices` | Device report |
| GET | `/api/reports/uptime` | Uptime report |
| POST | `/api/bulk/routers/preview` | Preview CSV |
| POST | `/api/bulk/routers/import` | Import CSV |

---

## Project Structure

```
monitoring-panel/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json          ← knex + sqlite3 (Windows-compatible)
│   └── src/
│       ├── index.js
│       ├── db/migrate.js     ← Schema + seed data (knex)
│       ├── middleware/auth.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── dashboard.js
│       │   ├── routers.js
│       │   ├── destinations.js
│       │   ├── localDevices.js
│       │   ├── combined.js   ← users, audit, settings, alerts, reports, bulk
│       │   └── *.js          ← re-exports from combined.js
│       ├── services/
│       │   ├── mikrotik.js
│       │   └── monitoringEngine.js
│       └── utils/logger.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── styles/global.css
        ├── context/AuthContext.jsx
        ├── hooks/index.js
        ├── utils/index.js
        ├── services/api.js
        ├── components/
        │   ├── layout/Layout.jsx
        │   ├── layout/Sidebar.jsx
        │   ├── ui/index.jsx
        │   └── charts/index.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── dashboard/DashboardPage.jsx
            ├── destinations/
            ├── devices/
            ├── routers/
            ├── management/
            ├── reports/
            └── settings/
```

---

## Troubleshooting

**`npm install` fails with gyp/Python error**
→ You are using the old version. Download the latest ZIP which uses `sqlite3` (prebuilt).

**`Cannot find module 'knex'`**
→ Run `npm install` inside the `backend/` folder.

**`EADDRINUSE: port 4000`**
→ Another process is using port 4000. Change `PORT=4005` in `.env`.

**Frontend shows "Network Error"**
→ Make sure backend is running on port 4000. Check `frontend/.env` has `VITE_API_URL=http://localhost:4000`.

**Router shows "disconnected"**
→ MikroTik API is not reachable. Check IP, port, credentials. Use **Test** button for details.
The app still works with simulated ping data when routers are offline.

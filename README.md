# QueueLess (Smart Queue & Intelligent Waiting Management System)

> *"Your turn is reserved. Your time is yours."*

QueueLess is an enterprise-grade full-stack smart queue management system designed to eliminate physical queue imprisonment at **government hospitals, banks, DMVs and civic offices, diagnostic testing centers, and university administration offices**.

---

## 1. Problem Statement & Core Innovation

### The Real Problem
Traditional queues do not merely waste time—they force people into physical premises imprisonment. Citizens and sick patients must remain in cramped waiting corridors for hours without knowing their realistic waiting duration or whether they can safely leave to use restrooms, eat, or purchase medicine without forfeiting their turn.

### The QueueLess Solution
**"A queue should reserve your turn, not imprison your time."**
QueueLess transforms physical waiting into predictable, flexible, and human-centered waiting:
1. **Dynamic Wait-Time Model:** Recalculates dynamically based on active counters, queue health status (`NORMAL`, `BUSY`, `DELAYED`, `PAUSED`), and exponential moving averages of actual service completions.
2. **"Wait Elsewhere" Mode:** Patrons can toggle their state to wait in a nearby garden or café without losing their place in line.
3. **Approaching-Turn Alerts:** Sub-second WebSocket notifications alert patrons when 2 people remain, giving them plenty of time to return calmly.
4. **Real Multi-Counter Load Balancing:** Assigns patrons across active staff counters with audit logging.
5. **No Fake Logins:** Built on real Google OAuth 2.0 with persistent relational database sessions.

---

## 2. Architecture & Tech Stack

```
   ┌────────────────────────────────────────────────────────┐
   │             React 19 SPA (TypeScript + Vite)           │
   │  Tailwind CSS 4 · Lucide Icons · Recharts · WebSockets │
   └───────────────────────────▲────────────────────────────┘
                               │ HTTP / WebSocket (:3000)
   ┌───────────────────────────▼────────────────────────────┐
   │             Express + Node.js 22 Runtime               │
   │  Cookie Sessions · Real-Time WS Engine · REST APIs     │
   └─────────────┬───────────────────────────┬──────────────┘
                 │                           │
                 ▼                           ▼
   ┌───────────────────────────┐   ┌─────────────────────────┐
   │   SQLite (Local Native)   │   │ Python FastAPI / Alembic│
   │   PostgreSQL (Production) │   │ Relational ORM Models   │
   └───────────────────────────┘   └─────────────────────────┘
```

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Recharts, Lucide React, Google Identity Services.
- **Backend Server:** Node.js 22 + Express (full-stack dev & prod), WebSocket Server (`ws`), HTTP-only secure cookie session engine.
- **Python / ORM Specification:** SQLAlchemy 2.0 models, Alembic migrations, Pytest suite, Pydantic schemas in `backend/`.
- **Database:** Local SQLite (`queueless.db`) with production-ready PostgreSQL relational mapping.

---

## 3. Relational Database Tables

| Table | Purpose |
|---|---|
| `users` | Real Google identities with roles (`CUSTOMER`, `PROVIDER`, `ADMIN`) |
| `service_locations` | Hospitals, banks, DMVs, diagnostic centers, universities |
| `services` | OPD triage, teller counters, driver license renewal, blood draw |
| `queues` | Dynamic queue records with prefixes, token numbers, average service times |
| `counters` | Physical staff desks (Counter 1, Counter 2, etc.) |
| `queue_entries` | Transactional customer token records, wait times, away states |
| `notifications` | Database notifications (Turn Approaching, Your Turn, Delayed) |
| `queue_events` | Granular event audit stream (Join, Call, Skip, Complete) |
| `audit_logs` | Immutable audit log of administrative actions |
| `sessions` | 30-day cryptographically signed sessions |

---

## 4. Google OAuth 2.0 Setup Guide

QueueLess requires real Google identity authentication for token security. Follow these steps to configure your credentials:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create or select a Google Cloud Project.
3. Configure the **OAuth Consent Screen** (User Type: External, specify app name and user support email).
4. Navigate to **Credentials** &rarr; **Create Credentials** &rarr; **OAuth client ID**.
5. Select **Web application** as the application type.
6. Under **Authorized JavaScript origins**, add your deployment URL and local address:
   - `http://localhost:3000`
   - `https://your-domain.com`
7. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/auth/google/callback`
   - `https://your-domain.com/auth/google/callback`
8. Copy the generated **Client ID** and **Client Secret**.
9. Add them to your `.env` file (or paste into the in-app configuration prompt on the `/login` screen):
   ```bash
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   ```

---

## 5. Local Setup & Execution

### Node.js Full-Stack Application (Default Dev Server)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start full-stack server (Vite + Express + WebSockets on port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser.

### Python Backend & Alembic Migrations

The Python backend architecture is available under `backend/`:

```bash
# 1. Install Python dependencies
pip install -r backend/requirements.txt

# 2. Run Alembic database migrations
alembic upgrade head

# 3. Seed database with sample institutions and counters
python -m backend.seed

# 4. Run Pytest suite
pytest backend/tests/
```

To rollback a migration:
```bash
alembic downgrade -1
```

---

## 6. Dynamic Wait-Time Calculation Formula

The dynamic wait-time estimation engine uses:

$$\text{Estimated Wait} = \max\left(1, \text{round}\left( \frac{\text{People Ahead} \times \text{Average Service Time}}{\max(1, \text{Active Counters})} \times \text{Status Multiplier} \right)\right)$$

Where:
- `People Ahead` is computed transactionally from uncalled `WAITING` entries.
- `Active Counters` reflects currently staffed service desks.
- `Status Multiplier`:
  - `NORMAL`: $1.0\times$
  - `BUSY`: $1.2\times$
  - `DELAYED`: $1.45\times$
  - `PAUSED`: $2.0\times$
- `Average Service Time` is continuously updated using exponential moving averages ($EMA_{\alpha = 0.25}$) upon each counter service completion.

---

## 7. Role-Based Access Control (RBAC)

1. **CUSTOMER (Default):**
   - Join digital queues
   - Receive personal token numbers
   - View live queue position and dynamic wait estimation
   - Toggle "Wait Elsewhere" mode
   - Cancel their own queue entry
   - Receive in-app notifications
2. **PROVIDER:**
   - Call next waiting token to active counter
   - Complete service, calculate elapsed time
   - Skip absent patrons, recall previously skipped patrons
   - Adjust queue speed status (`NORMAL`, `BUSY`, `DELAYED`, `PAUSED`)
   - Manage counter assignment
3. **ADMIN:**
   - Full provider capabilities
   - View Recharts analytics (throughput, peak hours, counter utilization)
   - Assign user roles (`CUSTOMER`, `PROVIDER`, `ADMIN`)
   - Audit log review and system diagnostics

---

## 8. Health Check Endpoint

QueueLess provides an automated health check for monitoring probes:
- `GET /health` &rarr; Returns:
  ```json
  {
    "status": "ok",
    "database": "connected",
    "server": "QueueLess Core",
    "timestamp": "2026-10-04T09:20:00.000Z"
  }
  ```

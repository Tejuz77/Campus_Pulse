# CampusPulse 🎓⚡
### Smart Campus Issue Reporting & Resolution System  
**Shri Vishnu Engineering College for Women (SVECW)**

> Report, track, and resolve campus infrastructure issues — from broken lab PCs to burst pipes — with real-time notifications, intelligent routing, and accountability at every step.

---

## ✨ Features

### Student Portal
- **Submit Reports** — Multi-step form with category, location (block/floor/room), optional system number, description, and photo evidence (up to 3 files)
- **Intelligent Deduplication** — Automatically links your report to an existing incident for the same location/category
- **Propose New Locations** — If your place isn't in the system, propose it — a pending report is held until admin approves
- **Track Tickets** — Real-time status, timeline, and assigned staff
- **Confirm / Dispute Resolution** — When staff marks an issue resolved, you get 72h to confirm or dispute
- **Reopen** — Reopen a closed ticket within 7 days if the issue recurs
- **Rate & Feedback** — Star-rate the resolution quality

### Staff Portal
- **Queue View** — See all tickets assigned to your department, filterable by status/priority
- **Status Transitions** — Move tickets through the workflow: Submitted → Assigned → In Progress → Awaiting Confirmation → Resolved
- **Hold & Unhold** — Put tickets on hold with a reason; attach resolution photos
- **Reassign** — Reassign to your department colleague
- **Transfer** — Transfer to another department with a justification
- **On-Leave Toggle** — Mark yourself on leave; open tickets auto-reassign to your colleague

### Admin Portal
- **System Overview** — Live stats: total, open, resolved, escalated, unassigned tickets; CSV export
- **All Tickets** — Full-featured table with 10+ filters (dept, category, priority, block, date range, escalated, overdue)
- **Admin Override** — Force any status transition with a mandatory audit reason
- **Cross-Department Assignment** — Assign any ticket to any staff
- **Staff Management** — Create/deactivate staff accounts; enforce 2-per-department cap; manage leave
- **Department & Location Management** — Bulk-add rooms, bulk-assign owner departments
- **Pending Location Approvals** — Approve/reject/merge student-proposed places
- **Analytics** — Charts: tickets by status & priority, top recurring locations, resolution rate, avg satisfaction
- **Audit Log** — Color-coded, paginated log of every system action
- **System Settings** — Tune escalation thresholds, rate limits, confirmation windows — all audited

### Background Jobs (node-cron)
- **Escalation Engine** — Marks tickets overdue per priority-based SLA (e.g., CRITICAL: 4h response, 24h resolution)
- **Confirmation Timeout** — Auto-resolves tickets where the 72h window expires without student action

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS v3, React Router v6 |
| Backend | Node.js 20 + Express 5 |
| ORM | Prisma 6 |
| Database | SQLite (local) / PostgreSQL (production) |
| Auth | Argon2 passwords, JWT in httpOnly cookies |
| Validation | Zod on all endpoints |
| File Upload | Multer (magic byte validation) |
| Jobs | node-cron |
| Security | Helmet, express-rate-limit, CORS allowlist |

---

## 🚀 Local Setup

### Prerequisites
- Node.js ≥ 20
- npm ≥ 9

### 1. Clone & Install

```bash
git clone <repo-url>
cd CampusPulse

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Backend Environment

Create `backend/.env`:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET=your-super-secret-jwt-key-change-in-production
COOKIE_SECRET=another-secret-key
CORS_ORIGINS=http://localhost:5173
ADMIN_EMAIL=admin@svecw.edu.in
ADMIN_PASSWORD=Admin@12345
REPORTS_PER_HOUR=5
CONFIRM_WINDOW_HOURS=72
REOPEN_WINDOW_DAYS=7
UPLOAD_DIR=./uploads
```

### 3. Database Setup

```bash
cd backend
npx prisma migrate dev --name init
node prisma/seed.js
```

This seeds:
- **1 Admin** — `admin@svecw.edu.in` / `Admin@12345`
- **13 Departments** — CSE, IT, ECE, EEE, Mechanical, Civil, AIML, AIDS, CSE(CyberSec), ECS, Maintenance, Water & Sanitation, Electrical
- **26 Staff** — 2 per department
- **10 Categories** — Electrical, Plumbing, Computer/IT, Furniture, Sanitation, etc.
- **3 Demo Students** — `25b05a1201@svecw.edu.in` / `Student@123`

### 4. Frontend Environment

Create `frontend/.env`:

```env
VITE_API_URL=
```
> Leave blank for local (Vite proxy handles `/api` → `http://localhost:4000`)

### 5. Run

```bash
# Terminal 1 – Backend
cd backend && npm run dev

# Terminal 2 – Frontend
cd frontend && npm run dev
```

App is at **http://localhost:5173**

---

## 🌐 Deployment

### Backend → Render

1. Push to GitHub
2. On [Render](https://render.com), create **New → Blueprint**
3. Connect your repo — Render reads `render.yaml` automatically
4. Set any secret env vars (the rest auto-generate)
5. Deploy! The startup command runs `prisma migrate deploy && node prisma/seed.js` automatically

> **Note:** Free Render services sleep after 15 min of inactivity. First request wakes them in ~30s. Consider UptimeRobot to keep alive.

### Frontend → Vercel

1. On [Vercel](https://vercel.com), import your repo
2. Set **Root Directory** to `frontend`
3. Set environment variable:
   - `VITE_API_URL` = your Render backend URL (e.g., `https://campuspulse-api.onrender.com`)
4. Deploy!

---

## 🔐 Authentication & Authorization

| Role | Email Pattern | Access |
|---|---|---|
| STUDENT | `^[a-z0-9]{10}@svecw\.edu\.in$` | Own tickets only |
| STAFF | Any `@svecw.edu.in` email (admin-created) | Own department tickets |
| ADMIN | Seeded only (`admin@svecw.edu.in`) | Full system access |

- Passwords hashed with **Argon2id**
- JWTs stored in **httpOnly, SameSite=Strict** cookies (SameSite=None; Secure in production)
- 5 reports/hour rate limit per student
- Optimistic locking via `version` field prevents concurrent update races

---

## 📐 Architecture Decisions

### Incident Deduplication
When a student submits a report, the system checks for an active incident with the same `(categoryId, locationId, systemNumber)` within the last 7 days. If found, the new report is linked to the existing incident (fan-in), avoiding duplicate work.

### Routing
`incidentService.routeToDocument()` resolves the owning department by following:
1. `Location.ownerDepartmentId` → department that owns the room
2. `Category.defaultDepartmentId` → fallback by issue type
3. If neither, incident is placed in the **unassigned queue** and admin is notified

### State Machine
Strict status transitions are enforced server-side. STAFF can only move through allowed paths; ADMIN can override any transition (with audit reason).

### SLA Escalation
Priority-based thresholds (configurable in System Settings):
| Priority | Response | Resolution |
|---|---|---|
| CRITICAL | 4h | 24h |
| HIGH | 8h | 48h |
| MEDIUM | 24h | 96h |
| LOW | 48h | 168h |

---

## 📁 Project Structure

```
CampusPulse/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js
│   ├── src/
│   │   ├── index.js              # Express app entry
│   │   ├── lib/prisma.js
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT verify, requireRole
│   │   │   ├── errorHandler.js
│   │   │   └── validate.js       # Zod middleware
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── reports.js        # Student report submission
│   │   │   ├── incidents.js      # Staff/admin incident management
│   │   │   ├── users.js
│   │   │   ├── departments.js
│   │   │   ├── locations.js
│   │   │   ├── categories.js
│   │   │   ├── notifications.js
│   │   │   ├── settings.js
│   │   │   ├── admin.js          # Overview, analytics, audit log
│   │   │   └── attachments.js
│   │   └── services/
│   │       ├── incidentService.js  # Core state machine + routing
│   │       ├── notificationService.js
│   │       ├── auditService.js
│   │       ├── storageService.js
│   │       └── cronJobs.js
│   └── tests/api.test.js
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # All routes
│   │   ├── main.jsx
│   │   ├── index.css             # Design system
│   │   ├── contexts/AuthContext.jsx
│   │   ├── lib/api.js            # Axios client + helpers
│   │   ├── lib/utils.js
│   │   ├── components/
│   │   │   ├── Badges.jsx
│   │   │   ├── UI.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── layouts/
│   │   │   ├── StudentLayout.jsx
│   │   │   ├── StaffLayout.jsx
│   │   │   └── AdminLayout.jsx
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── RegisterPage.jsx
│   │       ├── student/
│   │       ├── staff/
│   │       └── admin/
│   ├── vercel.json
│   └── tailwind.config.js
│
├── render.yaml
└── README.md
```

---

## 🧪 Running Tests

```bash
cd backend
npm test
```

Tests cover: auth, registration constraints, report submission, deduplication, routing, staff capacity.

---

## 🎓 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@svecw.edu.in | Admin@12345 |
| Student | 25b05a1201@svecw.edu.in | Student@123 |
| Staff (CSE) | staff.cse1@svecw.edu.in | Staff@12345 |
| Staff (IT) | staff.it1@svecw.edu.in | Staff@12345 |

---

*Built for SVECW — Shri Vishnu Engineering College for Women*

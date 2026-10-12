require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const incidentRoutes = require('./routes/incidents');
const departmentRoutes = require('./routes/departments');
const categoryRoutes = require('./routes/categories');
const locationRoutes = require('./routes/locations');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const attachmentRoutes = require('./routes/attachments');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const { startCronJobs } = require('./services/cronService');

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production';

// ── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 200,
  message: { error: 'Too many login attempts. Please try again later.' },
  skip: () => !isProd && process.env.DISABLE_RATE_LIMIT === 'true',
});

// ── BODY PARSING ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 CampusPulse API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  startCronJobs();
});

module.exports = app; // for tests

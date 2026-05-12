const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const morgan = require('morgan');
const env    = require('./config/env');
const prisma = require('./config/database');
const { notFound, globalHandler } = require('./middleware/errorHandler');

// ── Module routers ────────────────────────────────────────────────────────────
const authRoutes        = require('./modules/auth/auth.routes');
const doctorRoutes      = require('./modules/doctors/doctors.routes');
const leadRoutes        = require('./modules/leads/leads.routes');
const appointmentRoutes = require('./modules/appointments/appointments.routes');
const blogRoutes        = require('./modules/blogs/blogs.routes');
const dashboardRoutes   = require('./modules/dashboard/dashboard.routes');
const webhookRoutes     = require('./modules/webhooks/webhooks.routes');
const publicRoutes      = require('./modules/public/public.routes');
const staffRoutes       = require('./modules/staff/staff.routes');
const practiceRoutes    = require('./modules/practice/practice.routes');
const adminRoutes       = require('./modules/admin/admin.routes');

const app = express();
app.set('trust proxy', 1);

// ── Proxy trust — MUST be set before rate-limit and any IP-dependent middleware ──
//
// We run behind Nginx (reverse proxy). Without this:
//   - express-rate-limit v7 throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and crashes
//     every request before any route handler runs.
//   - req.ip returns the Nginx internal IP instead of the real client IP.
//   - Secure cookies don't work (sameSite/secure flags).
//
// '1' means: trust exactly ONE hop of proxy (Nginx). Reads X-Forwarded-For[0].
// Do NOT set to 'true' — that trusts all hops and is exploitable.
app.set('trust proxy', 1);

// ── Request logging ───────────────────────────────────────────────────────────
// 'dev' in development: "GET /api/leads 200 12ms"
// 'combined' in production: Apache-style with real client IP (from X-Forwarded-For)
app.use(morgan(env.isDev ? 'dev' : 'combined'));

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman / server-to-server / curl
      if (env.ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Webhook-Secret'],
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// trust proxy (set above) ensures req.ip is the real client IP, not Nginx's IP.
// Without trust proxy, rate-limit v7 throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
}));

// Tighter limit on auth endpoint to prevent brute-force
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
}));

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', env.UPLOAD_DIR)));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', env: env.NODE_ENV, ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── API route map ─────────────────────────────────────────────────────────────
//
//  JWT-protected (CRM dashboard)
//  POST   /api/auth/login
//  GET    /api/auth/me
//  PUT    /api/auth/profile
//  PUT    /api/auth/change-password
//  POST   /api/auth/logout
//
//  GET|POST|PUT|PATCH|DELETE  /api/doctors/**
//  GET|POST|PUT|PATCH|DELETE  /api/leads/**
//  GET|POST|PUT|PATCH|DELETE  /api/appointments/**
//  GET|POST|PUT|PATCH|DELETE  /api/blogs/**
//  GET    /api/dashboard/summary
//
//  API-key protected (external doctor websites)
//  POST   /api/public/appointments
//  POST   /api/public/leads              ← API key auth, dedup + rate-limit
//  GET    /api/public/blogs
//  GET    /api/public/blogs/:slug
//
//  Webhook ingestion (Make.com / Zapier) — shared-secret auth
//  POST   /api/public/meta-webhook       ← canonical
//  POST   /api/public/google-webhook     ← canonical
//  POST   /api/public/generic-webhook    ← canonical
//
//  Legacy webhook paths (backward compat — old Make.com scenarios)
//  POST   /api/meta-webhook
//  POST   /api/google-webhook
//  POST   /api/generic-webhook
//  POST   /api/site-lead

app.use('/api/auth',         authRoutes);
app.use('/api/doctors',      doctorRoutes);
app.use('/api/leads',        leadRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/blogs',        blogRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/public',       publicRoutes);
app.use('/api/staff',        staffRoutes);    // DOCTOR_ADMIN manages own staff
app.use('/api/practice',     practiceRoutes); // DOCTOR_ADMIN manages own clinic profile
app.use('/api/admin',        adminRoutes);    // SUPER_ADMIN global management + audit logs
app.use('/api',              webhookRoutes);

// ── 404 + global error ────────────────────────────────────────────────────────
app.use(notFound);
app.use(globalHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log('[DB] MySQL connected via Prisma');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }

  app.listen(env.PORT, () => {
    console.log(`[API] Running → http://localhost:${env.PORT}  (${env.NODE_ENV})`);
    console.log(`[API] Health  → http://localhost:${env.PORT}/health`);
  });
}

start();

module.exports = app;

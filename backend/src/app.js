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

const app = express();
app.set('trust proxy', 1);

// ── Request logging ───────────────────────────────────────────────────────────
// 'dev' in development: "GET /api/leads 200 12ms"
// 'combined' in production: Apache-style with IP + user-agent (useful for Hostinger logs)
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
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
}));

// Tighter limit on auth to prevent brute-force
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
//  GET    /api/public/blogs
//  GET    /api/public/blogs/:slug
//
//  Webhook (Make.com)
//  POST   /api/meta-webhook
//  POST   /api/generic-webhook

app.use('/api/auth',         authRoutes);
app.use('/api/doctors',      doctorRoutes);
app.use('/api/leads',        leadRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/blogs',        blogRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/public',       publicRoutes);
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

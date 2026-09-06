// =============================================================
// Express Application Entry Point
// =============================================================

require('dotenv').config();

const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const express        = require('express');
const cors           = require('cors');
const morgan         = require('morgan');
const helmet         = require('helmet');
const errorHandler   = require('./middleware/errorHandler');
const inputSanitizer = require('./middleware/inputSanitizer');
const { apiLimiter } = require('./middleware/rateLimiter');
const { router, wordRepo, challengeRepo } = require('./routes/index');
const DailyWordScheduler = require('../infrastructure/scheduler/DailyWordScheduler');
const { initializeDatabase } = require('../infrastructure/database/init');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---- Trust proxy (needed for rate limiter behind nginx) ----
app.set('trust proxy', 1);

// ---- Security Headers (helmet) ----
app.use(helmet({
  contentSecurityPolicy: false,   // CSP managed by nginx/frontend
  crossOriginEmbedderPolicy: false,
}));

// ---- CORS ----
// ---- CORS Configuration ----
const getAllowedOrigin = () => {
  const origin = process.env.CORS_ORIGIN;
  if (!origin || origin === '*') {
    return true;
  }
  try {
    // Extract protocol + host to handle cases where a path or trailing slash is included
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/+$/, '');
  }
};

app.use(cors({
  origin:      getAllowedOrigin(),
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ---- Body Parsing ----
app.use(express.json({ limit: '10kb' }));  // Limit body size for security

// ---- Input Sanitization ----
app.use(inputSanitizer);

// ---- Logging ----
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ---- Global Rate Limit ----
app.use('/api', apiLimiter);

// ---- API Routes ----
app.use('/api', router);

// ---- 404 handler ----
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---- Global Error Handler ----
app.use(errorHandler);

// ---- Start server ----
async function start() {
  const maxRetries = 15;
  const retryIntervalMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Server] Connecting to database (attempt ${attempt}/${maxRetries})...`);
      await initializeDatabase();

      app.listen(PORT, () => {
        console.log(`[Server] Akshara API running on port ${PORT}`);
        console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);

        // Start the daily word scheduler (FR-3)
        const scheduler = new DailyWordScheduler(wordRepo, challengeRepo);
        scheduler.start();
      });
      return;
    } catch (err) {
      console.error(`[Server] Database connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt === maxRetries) {
        console.error('[Server] Critical: Failed to initialize database after maximum retries:', err);
        process.exit(1);
      }
      console.log(`[Server] Retrying in ${retryIntervalMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }
  }
}

start();

module.exports = app;

// Express app wiring. No `listen` here — that's in server.js.
// Phase 0: /api/health
// Phase 2: /api/auth (register, login, /me)
// Phase 3: /api/partners, /api/ngos (verification profiles)
// Phase 4: /api/donations (create, get-by-id), /api/uploads (image upload)

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('express-async-errors');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const partnerRoutes = require('./routes/partner.routes');
const ngoRoutes = require('./routes/ngo.routes');
const donationRoutes = require('./routes/donation.routes');
const uploadRoutes = require('./routes/upload.routes');
const impactRoutes = require('./routes/impact.routes');
const adminRoutes = require('./routes/admin.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security & parsing middleware.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || '*',
    credentials: true,
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets from public/ directory
app.use(express.static(path.join(process.cwd(), 'public')));

// Static serve for uploaded images. Path is relative to repo root.
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'uploads'), {
    // Helmet defaults to same-origin. Uploaded photos need to be embeddable by
    // the separately hosted web/mobile client.
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  }),
);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Routes.
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api/admin', adminRoutes);

// 404 for unknown /api/* paths.
app.use('/api', (req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

// Centralized error handler.
// eslint-disable-next-line no-unused-vars
app.use(errorHandler);

module.exports = app;

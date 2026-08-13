// /api/health — liveness probe.
// Phase 0: returns basic status. Phase 1 will extend this to report DB
// up/down by reading the Mongoose connection state.

const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'rescuebite-backend',
    version: '0.1.0',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

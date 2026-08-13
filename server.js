// RescueBite backend entrypoint.
// Loads .env, creates the Express app, starts listening.
//
// Note: DB connection is wired in Phase 1. For Phase 0 the server starts
// and /api/health reports a basic liveness response.

require('dotenv').config();

const app = require('./src/app');
const { PORT, validateRuntimeConfig } = require('./src/config/env');
const connectDB = require('./src/config/db');

const port = Number(PORT) || 4000;

const startServer = async () => {
  validateRuntimeConfig();
  await connectDB();

  app.listen(port, () => {
    console.log(`[rescuebite] server listening on http://localhost:${port}`);
  });
};

startServer();

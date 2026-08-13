// Centralized env access. Keep this the only place that reads process.env
// so we can validate and fail fast on misconfiguration.

const required = (name) => {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
};

const optional = (name, fallback) => {
  const v = process.env[name];
  return v && v.trim() !== '' ? v : fallback;
};

const validateRuntimeConfig = () => {
  const mongoUri = required('MONGODB_URI');
  const jwtSecret = required('JWT_SECRET');
  if (jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be at least 16 characters');
  }
  if (!Number.isInteger(Number(optional('PORT', '4000'))) || Number(optional('PORT', '4000')) < 1) {
    throw new Error('PORT must be a positive integer');
  }
  return { mongoUri, jwtSecret };
};

module.exports = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: optional('PORT', '4000'),
  CLIENT_ORIGIN: optional('CLIENT_ORIGIN', '*'),

  // Wired in Phase 1.
  MONGODB_URI: optional('MONGODB_URI', ''),

  // Wired in Phase 2.
  JWT_SECRET: optional('JWT_SECRET', ''),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),

  // Wired in Phase 7.
  ADMIN_KEY: optional('ADMIN_KEY', ''),

  // Internal helper.
  required,
  optional,
  validateRuntimeConfig,
};

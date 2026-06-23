// Centralized environment configuration.
// Loads .env once and exposes a typed, validated config object so the rest
// of the app never reads process.env directly.

require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tp00001',
  // Comma-separated list of allowed browser origins for CORS.
  // e.g. CLIENT_URL="http://localhost:5173,https://my-app.vercel.app"
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  jwt: {
    // Short-lived access token (stateless, carries identity + jti + tokenVersion).
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-only-insecure-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    // Opaque refresh token lifetime (days). The token itself is random, not a JWT.
    refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS, 10) || 7,
  },
  // httpOnly cookie that carries the refresh token.
  cookie: {
    name: process.env.COOKIE_NAME || 'refreshToken',
    // Send only over HTTPS in production.
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    path: process.env.COOKIE_PATH || '/',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
};

// Fail fast in production if critical config is missing.
if (config.env === 'production' && !process.env.JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET must be set in production');
}

// Fail fast in production if critical config is missing.
if (config.env === 'production' && !process.env.MONGO_URI) {
  throw new Error('MONGO_URI must be set in production');
}

module.exports = config;

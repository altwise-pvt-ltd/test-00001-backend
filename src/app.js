// Builds and configures the Express application.
// Kept separate from server start-up so it can be imported in tests.
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const apiRoutes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Core middleware
// Allow only the configured client origins. The callback form lets us accept
// a list of origins (e.g. localhost during dev + the deployed frontend) while
// still echoing back the specific origin, which is required when credentials
// (cookies) are involved — a wildcard "*" is not allowed with credentials.

console.log("CLIENT_URLS =", process.env.CLIENT_URLS);
console.log("clientUrls =", config.clientUrls);
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (curl, server-to-server, health checks)
      // which send no Origin header.
      if (!origin || config.clientUrls.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // parses the httpOnly refresh-token cookie into req.cookies

// Public root status/health endpoint. Lets you (and uptime checks) hit the
// base URL to confirm the service is live without needing an /api path.
app.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'TP00001 backend',
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api', apiRoutes);

// 404 + centralized error handling (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;

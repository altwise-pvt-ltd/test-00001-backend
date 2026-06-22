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
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // parses the httpOnly refresh-token cookie into req.cookies

// API routes
app.use('/api', apiRoutes);

// 404 + centralized error handling (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;

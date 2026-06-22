// Vercel serverless entry point.
//
// Unlike index.js (the local long-running server), Vercel invokes this module
// per request and never calls app.listen(). We reuse the same Express app, but
// connect to MongoDB lazily and cache the connection across warm invocations so
// we don't open a new socket on every request.
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/env');

// Cache the connection promise on the module scope. Warm Lambdas reuse it;
// cold starts create it once.
let connPromise = null;

async function ensureDB() {
  // 1 === connected. Reuse the live connection if we already have one.
  if (mongoose.connection.readyState === 1) return;
  if (!connPromise) {
    mongoose.set('strictQuery', true);
    connPromise = mongoose.connect(config.mongoUri).catch((err) => {
      // Reset so the next invocation can retry instead of caching a rejection.
      connPromise = null;
      throw err;
    });
  }
  await connPromise;
}

module.exports = async (req, res) => {
  try {
    await ensureDB();
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Database connection failed' }));
    return;
  }
  // Hand the request off to Express.
  return app(req, res);
};

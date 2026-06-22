// Server entry point: connect to the database, start listening, and handle
// graceful shutdown.
const app = require('./src/app');
const config = require('./src/config/env');
const { connectDB, disconnectDB } = require('./src/config/db');

let server;

async function start() {
  try {
    await connectDB();
    server = app.listen(config.port, () => {
      console.log(`[server] running on http://localhost:${config.port} (${config.env})`);
    });
  } catch (err) {
    console.error('[server] failed to start:', err.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n[server] ${signal} received, shutting down...`);
  if (server) server.close();
  await disconnectDB();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
});

start();

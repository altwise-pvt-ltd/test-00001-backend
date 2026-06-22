// MongoDB connection handling via Mongoose.
const mongoose = require('mongoose');
const config = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.log('[db] MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  await mongoose.connect(config.mongoUri);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, disconnectDB };

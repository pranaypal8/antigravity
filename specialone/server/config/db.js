// ============================================================
// DATABASE CONNECTION — MongoDB Atlas via Mongoose
// ============================================================
// This file connects the server to your MongoDB Atlas database.
// It retries on failure and logs connection status clearly.
// ============================================================

const mongoose = require('mongoose');

// Track reconnect attempts so we don't spam logs
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const connectDB = async () => {
  // If no MONGODB_URI is set, skip DB connection (dev mode without credentials)
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI not set in .env — running without database. API calls requiring DB will fail.');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 30000,
      maxPoolSize: 10,
    });

    reconnectAttempts = 0;
    console.log(`✅ MongoDB Atlas connected: ${conn.connection.host}`);
  } catch (error) {
    reconnectAttempts++;
    console.error(`❌ MongoDB connection failed (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`, error.message);

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      console.log(`⏳ Retrying in 5 seconds...`);
      setTimeout(connectDB, 5000);
    } else {
      console.error('💀 Could not connect to MongoDB after multiple attempts. Check your MONGODB_URI in .env');
      console.warn('⚠️  Server will continue running — frontend pages will load, but API calls requiring DB will fail.');
      // Do NOT exit — allow frontend to be served even without DB
    }
  }
};

// Listen for connection events and log them clearly
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
  connectDB();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err.message);
});

module.exports = connectDB;

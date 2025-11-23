// backend/src/db/connection.js
// MongoDB connection setup

const mongoose = require('mongoose');

let isConnected = false;

/**
 * Connect to MongoDB database
 * @param {string} mongoUri - MongoDB connection string
 */
async function connectToDatabase(mongoUri) {
  if (isConnected) {
    console.log('Already connected to MongoDB');
    return;
  }

  try {
    // Modern Mongoose connection (no deprecated options)
    await mongoose.connect(mongoUri);
    
    isConnected = true;
    console.log('✓ Connected to MongoDB successfully');
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
    });
    
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

/**
 * Close MongoDB connection
 */
async function closeDatabase() {
  if (!isConnected) {
    return;
  }
  
  await mongoose.connection.close();
  isConnected = false;
  console.log('MongoDB connection closed');
}

module.exports = {
  connectToDatabase,
  closeDatabase,
  isConnected: () => isConnected
};

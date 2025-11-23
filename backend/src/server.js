// backend/src/server.js
// Entry point: sets up HTTP + Express + WebSocket, then wires ChatServer.

require('dotenv').config();

const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");

const ChatServer = require("./chatServer");
const { connectToDatabase } = require("./db/connection");

// ------------------------------
// Express app to serve frontend
// ------------------------------
const app = express();

// Serve static files from the frontend folder
// Note: ../../frontend from this file
const frontendPath = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(frontendPath));

// Create HTTP server and attach Express
const server = http.createServer(app);

// Attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

// ------------------------------
// Start server with MongoDB
// ------------------------------
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tiny_group_chat';

async function startServer() {
  try {
    // Connect to MongoDB first
    await connectToDatabase(MONGO_URI);
    
    // Wire our chat logic after DB is connected
    new ChatServer(wss);
    
    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`MongoDB URI: ${MONGO_URI}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

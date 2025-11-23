// backend/src/server.js
// Entry point: sets up HTTP + Express + WebSocket, then wires ChatServer.

const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");

const ChatServer = require("./chatServer");

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

// Wire our chat logic
new ChatServer(wss);

// ------------------------------
// Start server
// ------------------------------
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

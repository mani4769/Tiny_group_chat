// backend/src/chatServer.js
// Single-room chat server with basic persistence

const WebSocket = require("ws");
const MESSAGE_TYPES = require("./messageTypes");
const { validateMessage } = require("./utils/validateMessage");
const fs = require('fs').promises;
const path = require('path');

class ChatServer {
  /**
   * @param {WebSocket.Server} wss - WebSocket server instance
   */
  constructor(wss) {
    this.wss = wss;

    // Map of WebSocket -> { name: string }
    this.clients = new Map();

    // In-memory message history
    this.history = [];
    this.MAX_HISTORY = 100;

    // Data directory for persistence
    this.dataDir = path.join(__dirname, '..', '..', 'data');
    this.messagesFile = path.join(this.dataDir, 'messages.json');

    this.init();
  }

  async init() {
    // Create data directory if it doesn't exist
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }

    // Load message history
    await this.loadHistory();
    this.setup();
  }

  async loadHistory() {
    try {
      const data = await fs.readFile(this.messagesFile, 'utf8');
      this.history = JSON.parse(data);
      console.log(`Loaded ${this.history.length} messages from history`);
    } catch {
      console.log('No existing message history found, starting fresh');
      this.history = [];
    }
  }

  async saveHistory() {
    try {
      // Only keep last 100 messages in file
      const toSave = this.history.slice(-100);
      await fs.writeFile(this.messagesFile, JSON.stringify(toSave, null, 2));
    } catch (error) {
      console.error('Failed to save message history:', error);
    }
  }

  setup() {
    this.wss.on("connection", (ws) => {
      this.handleConnection(ws);
    });
  }

  handleConnection(ws) {
    console.log("New client connected");

    // Send history to the new client
    this.sendHistory(ws);

    // Set up message handler
    ws.on("message", (data) => this.handleRawMessage(ws, data));

    // Handle socket close
    ws.on("close", () => this.handleClose(ws));

    // Handle socket error
    ws.on("error", (err) => {
      console.error("WebSocket error:", err.message);
    });
  }

  send(ws, obj) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  broadcast(obj) {
    const data = JSON.stringify(obj);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  sendHistory(ws) {
    if (this.history.length === 0) return;

    this.send(ws, {
      type: MESSAGE_TYPES.HISTORY,
      messages: this.history,
    });
  }

  addToHistory(payload) {
    this.history.push(payload);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }

    // Save to file (async, don't wait)
    this.saveHistory().catch(console.error);
  }

  handleRawMessage(ws, data) {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      this.send(ws, {
        type: MESSAGE_TYPES.ERROR,
        message: "Invalid JSON format",
      });
      return;
    }

    // Validate basic shape depending on type
    const { valid, error } = validateMessage(msg);
    if (!valid) {
      this.send(ws, {
        type: MESSAGE_TYPES.ERROR,
        message: error,
      });
      return;
    }

    // Dispatch by type
    switch (msg.type) {
      case MESSAGE_TYPES.JOIN:
        this.handleJoin(ws, msg);
        break;

      case MESSAGE_TYPES.CHAT:
        this.handleChatMessage(ws, msg);
        break;

      default:
        this.send(ws, {
          type: MESSAGE_TYPES.ERROR,
          message: `Unknown message type: ${msg.type}`,
        });
    }
  }

  handleJoin(ws, msg) {
    const name = msg.name.trim();

    this.clients.set(ws, { name });
    console.log(`User joined: ${name}`);

    const joinMessage = {
      type: MESSAGE_TYPES.SYSTEM,
      message: `${name} joined the chat`,
      timestamp: Date.now(),
    };

    this.addToHistory(joinMessage);
    this.broadcast(joinMessage);
  }

  handleChatMessage(ws, msg) {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) {
      this.send(ws, {
        type: MESSAGE_TYPES.ERROR,
        message: "You must join with a username before sending messages",
      });
      return;
    }

    const text = msg.text.trim();
    if (!text) return;

    const payload = {
      type: MESSAGE_TYPES.CHAT,
      from: clientInfo.name,
      message: text,
      timestamp: Date.now(),
    };

    // Add to history
    this.addToHistory(payload);

    // Broadcast to everyone
    this.broadcast(payload);
  }

  handleClose(ws) {
    const info = this.clients.get(ws);
    if (!info) {
      console.log("Client disconnected before joining");
      return;
    }

    this.clients.delete(ws);
    console.log(`Client disconnected: ${info.name}`);

    const leaveMessage = {
      type: MESSAGE_TYPES.SYSTEM,
      message: `${info.name} left the chat`,
      timestamp: Date.now(),
    };

    this.addToHistory(leaveMessage);
    this.broadcast(leaveMessage);
  }
}

module.exports = ChatServer;

module.exports = ChatServer;

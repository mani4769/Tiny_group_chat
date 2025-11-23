// backend/src/chatServer.js
// Multi-room chat server with room-based persistence

const WebSocket = require("ws");
const MESSAGE_TYPES = require("./messageTypes");
const { validateMessage } = require("./utils/validateMessage");
const { 
  loadRoomHistory, 
  addMessageToRoom, 
  getAvailableRooms, 
  isValidRoom 
} = require("./utils/roomPersistence");

class ChatServer {
  /**
   * @param {WebSocket.Server} wss - WebSocket server instance
   */
  constructor(wss) {
    this.wss = wss;

    // Map of WebSocket -> { name: string, currentRoom: string|null }
    this.clients = new Map();

    // Map of room name -> Set of WebSocket connections in that room
    this.rooms = new Map();

    // Initialize rooms
    getAvailableRooms().forEach(room => {
      this.rooms.set(room, new Set());
    });

    this.setup();
  }

  setup() {
    this.wss.on("connection", (ws) => {
      this.handleConnection(ws);
    });
  }

  handleConnection(ws) {
    console.log("New client connected");

    // Send available rooms list
    this.send(ws, {
      type: MESSAGE_TYPES.ROOM_LIST,
      rooms: getAvailableRooms()
    });

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

  broadcastToRoom(roomName, obj, excludeWs = null) {
    const roomClients = this.rooms.get(roomName);
    if (!roomClients) return;

    const data = JSON.stringify(obj);
    for (const client of roomClients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  async sendRoomHistory(ws, roomName) {
    const history = await loadRoomHistory(roomName);
    if (history.length > 0) {
      this.send(ws, {
        type: MESSAGE_TYPES.HISTORY,
        messages: history,
        room: roomName
      });
    }
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

      case MESSAGE_TYPES.JOIN_ROOM:
        this.handleJoinRoom(ws, msg);
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

    // Enforce unique username across connected clients
    for (const [clientWs, info] of this.clients.entries()) {
      if (info && info.name === name) {
        // Notify the requester that the username is taken
        this.send(ws, {
          type: MESSAGE_TYPES.USERNAME_TAKEN,
          message: `Username '${name}' is already in use. Please choose another.`
        });
        return;
      }
    }

    // Set user info but don't put them in any room yet
    this.clients.set(ws, { name, currentRoom: null });
    console.log(`User registered: ${name}`);

    // Send confirmation and room list
    this.send(ws, {
      type: MESSAGE_TYPES.SYSTEM,
      message: `Welcome ${name}! Please select a room to join.`
    });

    this.send(ws, {
      type: MESSAGE_TYPES.ROOM_LIST,
      rooms: getAvailableRooms()
    });
  }

  async handleJoinRoom(ws, msg) {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) {
      this.send(ws, {
        type: MESSAGE_TYPES.ERROR,
        message: "You must register with a username first",
      });
      return;
    }

    const roomName = msg.room.trim();
    if (!isValidRoom(roomName)) {
      this.send(ws, {
        type: MESSAGE_TYPES.ERROR,
        message: `Invalid room: ${roomName}`,
      });
      return;
    }

    const wasInRoom = !!clientInfo.currentRoom;

    // Remove from current room if any
    if (clientInfo.currentRoom) {
      this.leaveCurrentRoom(ws, clientInfo);
    }

    // Add to new room
    clientInfo.currentRoom = roomName;
    this.rooms.get(roomName).add(ws);
    
    console.log(`${clientInfo.name} ${wasInRoom ? 'switched to' : 'joined'} room: ${roomName}`);

    // Send room history to the user
    await this.sendRoomHistory(ws, roomName);

    // Create join message for the room history
    const historySystemMessage = {
      type: MESSAGE_TYPES.SYSTEM,
      message: `${clientInfo.name} joined the room`,
      timestamp: Date.now(),
      room: roomName
    };

    // Persist the system message in room history
    await addMessageToRoom(roomName, historySystemMessage);

    // Broadcast a single live join event to other members (exclude the joining ws)
    const liveJoinMsg = {
      type: MESSAGE_TYPES.USER_JOINED_ROOM,
      user: clientInfo.name,
      timestamp: Date.now(),
      room: roomName
    };
    this.broadcastToRoom(roomName, liveJoinMsg, ws);

    // Confirm to user (private message)
    const confirmText = wasInRoom ? `switched to room: ${roomName}` : `joined room: ${roomName}`;
    this.send(ws, {
      type: MESSAGE_TYPES.SYSTEM,
      message: `You ${confirmText}`
    });
  }

  async handleChatMessage(ws, msg) {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) {
      this.send(ws, {
        type: MESSAGE_TYPES.ERROR,
        message: "You must join with a username before sending messages",
      });
      return;
    }

    if (!clientInfo.currentRoom) {
      this.send(ws, {
        type: MESSAGE_TYPES.ERROR,
        message: "You must join a room before sending messages",
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
      room: clientInfo.currentRoom
    };

    // Add to room history
    await addMessageToRoom(clientInfo.currentRoom, payload);

    // Broadcast to everyone in the room
    this.broadcastToRoom(clientInfo.currentRoom, payload);
  }

  leaveCurrentRoom(ws, clientInfo) {
    if (!clientInfo.currentRoom) return;

    const roomClients = this.rooms.get(clientInfo.currentRoom);
    if (roomClients) {
      roomClients.delete(ws);
    }

    console.log(`${clientInfo.name} left room: ${clientInfo.currentRoom}`);
    // Persist a system leave message into history
    const leaveHistoryMsg = {
      type: MESSAGE_TYPES.SYSTEM,
      message: `${clientInfo.name} left the room`,
      timestamp: Date.now(),
      room: clientInfo.currentRoom
    };
    // Note: we persist asynchronously (don't await here to avoid blocking)
    addMessageToRoom(clientInfo.currentRoom, leaveHistoryMsg).catch(err => console.error(err));

    // Broadcast a single live leave event to remaining room members
    const liveLeave = {
      type: MESSAGE_TYPES.USER_LEFT_ROOM,
      user: clientInfo.name,
      timestamp: Date.now(),
      room: clientInfo.currentRoom
    };
    this.broadcastToRoom(clientInfo.currentRoom, liveLeave, ws);

    // Clear current room
    clientInfo.currentRoom = null;
  }

  async handleClose(ws) {
    const info = this.clients.get(ws);
    if (!info) {
      console.log("Client disconnected before joining");
      return;
    }

    // If user was in a room, notify others they left
    if (info.currentRoom) {
      // When closing, reuse leaveCurrentRoom logic so leave is handled consistently
      this.leaveCurrentRoom(ws, info);
    }

    this.clients.delete(ws);
    console.log(`Client disconnected: ${info.name}`);
  }
}

module.exports = ChatServer;

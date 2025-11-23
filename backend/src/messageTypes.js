// backend/src/messageTypes.js
// Central place for all message type strings

const MESSAGE_TYPES = {
  JOIN: "join",        // client -> server
  CHAT: "message",     // client -> server, server -> clients
  HISTORY: "history",  // server -> client (initial history)
  SYSTEM: "system",    // server -> clients (join/leave info, etc.)
  ERROR: "error"       // server -> client (validation / protocol errors)
};

module.exports = MESSAGE_TYPES;

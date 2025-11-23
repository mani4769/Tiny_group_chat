// backend/src/messageTypes.js
// Message type constants for WebSocket communication

const MESSAGE_TYPES = {
  // Client → Server
  JOIN: "join",                       // Register with username
  JOIN_ROOM: "join_room",             // Join/switch to a room
  CHAT: "message",                    // Send chat message
  
  // Server → Client
  ROOM_LIST: "room_list",             // Available rooms
  HISTORY: "history",                 // Room message history
  SYSTEM: "system",                   // System notifications
  USER_JOINED_ROOM: "user_joined_room", // User joined notification
  USER_LEFT_ROOM: "user_left_room",   // User left notification
  ERROR: "error",                     // Error messages
  USERNAME_TAKEN: "username_taken"    // Username already in use
};

module.exports = MESSAGE_TYPES;

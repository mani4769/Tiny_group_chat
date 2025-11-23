// backend/src/utils/validateMessage.js
// Validation for incoming client messages.

const MESSAGE_TYPES = require("../messageTypes");

/**
 * Validate a parsed message object from the client.
 * Returns: { valid: boolean, error?: string }
 */
function validateMessage(msg) {
  if (typeof msg !== "object" || msg === null) {
    return { valid: false, error: "Message must be a JSON object" };
  }

  if (!msg.type) {
    return { valid: false, error: "Field 'type' is required" };
  }

  switch (msg.type) {
    case MESSAGE_TYPES.JOIN: {
      if (typeof msg.name !== "string" || msg.name.trim().length === 0) {
        return { valid: false, error: "Valid 'name' is required for join" };
      }
      return { valid: true };
    }

    case MESSAGE_TYPES.JOIN_ROOM: {
      if (typeof msg.room !== "string" || msg.room.trim().length === 0) {
        return { valid: false, error: "Valid 'room' is required for join_room" };
      }
      return { valid: true };
    }

    case MESSAGE_TYPES.CHAT: {
      if (typeof msg.text !== "string" || msg.text.trim().length === 0) {
        return { valid: false, error: "Non-empty 'text' is required" };
      }
      return { valid: true };
    }

    default:
      // For unknown types we still return valid, but server decides what to do.
      return { valid: true };
  }
}

module.exports = {
  validateMessage,
};

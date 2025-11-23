// backend/src/utils/roomPersistence.js
// Optimized MongoDB persistence - messages stored in batches like WhatsApp
// Benefits: Fewer documents, faster queries, less storage space

const MessageBatch = require('../db/models/Message');

const MAX_MESSAGES_PER_ROOM = 100;
const MESSAGES_PER_BATCH = 50; // Group messages in batches of 50

// Predefined rooms
const AVAILABLE_ROOMS = ['general', 'random', 'games'];

/**
 * Load message history for a specific room
 * Fetches from batched documents and flattens into message array
 */
async function loadRoomHistory(roomName) {
  if (!AVAILABLE_ROOMS.includes(roomName)) {
    return [];
  }

  try {
    // Fetch all message batches for the room, sorted by time
    const batches = await MessageBatch.find({ room: roomName })
      .sort({ startTime: 1 })
      .lean()
      .exec();
    
    // Flatten all messages from all batches
    const allMessages = [];
    batches.forEach(batch => {
      allMessages.push(...batch.messages);
    });
    
    // Return last MAX_MESSAGES_PER_ROOM messages
    return allMessages.slice(-MAX_MESSAGES_PER_ROOM);
  } catch (error) {
    console.error(`Error loading history for room ${roomName}:`, error);
    return [];
  }
}

/**
 * Add a message to a room's history
 * Uses batching strategy: adds to existing batch or creates new one
 */
async function addMessageToRoom(roomName, message) {
  if (!AVAILABLE_ROOMS.includes(roomName)) {
    return [];
  }

  try {
    const timestamp = message.timestamp || Date.now();
    
    // Find the most recent batch for this room that isn't full
    let batch = await MessageBatch.findOne({
      room: roomName,
      messageCount: { $lt: MESSAGES_PER_BATCH }
    }).sort({ endTime: -1 });
    
    if (batch) {
      // Add message to existing batch
      batch.messages.push({
        type: message.type,
        from: message.from,
        message: message.message,
        timestamp: timestamp
      });
      batch.endTime = timestamp;
      batch.messageCount = batch.messages.length;
      await batch.save();
    } else {
      // Create new batch
      batch = new MessageBatch({
        room: roomName,
        messages: [{
          type: message.type,
          from: message.from,
          message: message.message,
          timestamp: timestamp
        }],
        startTime: timestamp,
        endTime: timestamp,
        messageCount: 1
      });
      await batch.save();
    }
    
    // Clean up old batches if we exceed the limit
    await cleanupOldMessages(roomName);
    
    // Return current history
    return await loadRoomHistory(roomName);
  } catch (error) {
    console.error(`Error adding message to room ${roomName}:`, error);
    return [];
  }
}

/**
 * Clean up old message batches to maintain the message limit per room
 * More efficient: deletes entire batches instead of individual messages
 */
async function cleanupOldMessages(roomName) {
  try {
    // Get total message count across all batches
    const batches = await MessageBatch.find({ room: roomName })
      .sort({ startTime: 1 })
      .select('messageCount')
      .lean();
    
    let totalMessages = batches.reduce((sum, b) => sum + b.messageCount, 0);
    
    // If we exceed the limit, delete oldest batches
    if (totalMessages > MAX_MESSAGES_PER_ROOM) {
      const batchesToDelete = [];
      let messagesToRemove = totalMessages - MAX_MESSAGES_PER_ROOM;
      
      for (const batch of batches) {
        if (messagesToRemove <= 0) break;
        
        batchesToDelete.push(batch._id);
        messagesToRemove -= batch.messageCount;
      }
      
      if (batchesToDelete.length > 0) {
        await MessageBatch.deleteMany({ _id: { $in: batchesToDelete } });
      }
    }
  } catch (error) {
    console.error(`Error cleaning up old messages for room ${roomName}:`, error);
  }
}

/**
 * Get list of available rooms
 */
function getAvailableRooms() {
  return [...AVAILABLE_ROOMS];
}

/**
 * Check if a room name is valid
 */
function isValidRoom(roomName) {
  return AVAILABLE_ROOMS.includes(roomName);
}

module.exports = {
  loadRoomHistory,
  addMessageToRoom,
  getAvailableRooms,
  isValidRoom
};
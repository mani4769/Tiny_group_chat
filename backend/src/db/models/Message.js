// backend/src/db/models/Message.js
// MongoDB schema for efficient message storage
// Similar to WhatsApp's approach: messages are grouped in batches per room

const mongoose = require('mongoose');

// Individual message schema (embedded in the batch)
const individualMessageSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['message', 'system']
  },
  from: {
    type: String,
    required: function() {
      return this.type === 'message';
    }
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Number,
    required: true
  }
}, { _id: false }); // No separate _id for each message in the batch

// Message batch schema - groups multiple messages together
// This reduces database documents and improves query performance
const messageBatchSchema = new mongoose.Schema({
  room: {
    type: String,
    required: true,
    index: true
  },
  // Array of messages in this batch (up to 100 messages)
  messages: {
    type: [individualMessageSchema],
    default: []
  },
  // Timestamp range for quick lookups
  startTime: {
    type: Number,
    required: true,
    index: true
  },
  endTime: {
    type: Number,
    required: true
  },
  // Count for quick reference
  messageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Track when batch was created/updated
});

// Compound index for efficient room + time range queries
messageBatchSchema.index({ room: 1, startTime: -1 });
messageBatchSchema.index({ room: 1, endTime: -1 });

const MessageBatch = mongoose.model('MessageBatch', messageBatchSchema);

module.exports = MessageBatch;

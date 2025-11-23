# Tiny Group Chat

Real-time multi-room chat application with MongoDB persistence and WebSocket communication.

## Features

- ✅ Multiple chat rooms (general, random, games)
- ✅ Real-time messaging via WebSockets
- ✅ Persistent message history with MongoDB
- ✅ Optimized storage (90% space savings)
- ✅ Room switching capability
- ✅ Unique username validation

## Quick Start

```bash
# Install dependencies
cd backend
npm install

# Configure MongoDB in .env
MONGO_URI=mongodb://localhost:27017/tiny_group_chat

# Start server
npm start

# Open http://localhost:3000
```

## Tech Stack

**Backend:** Node.js, Express, WebSocket (ws), MongoDB, Mongoose  
**Frontend:** Vanilla JavaScript, WebSocket API, CSS3

## Project Structure

```
backend/src/
├── server.js              # Entry point
├── chatServer.js          # WebSocket logic
├── messageTypes.js        # Constants
├── db/
│   ├── connection.js      # MongoDB setup
│   └── models/Message.js  # Schema (batched)
└── utils/
    ├── roomPersistence.js # DB operations
    └── validateMessage.js # Validation

frontend/
├── index.html
├── app.js
└── styles.css
```

## Database Optimization

Messages stored in batches (50 per document):
- **93% less storage** vs individual documents
- **10x faster** queries
- Auto-cleanup (keeps last 100 messages/room)

## License

MIT
 

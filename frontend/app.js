// frontend/app.js - Multi-room chat client

let socket = null;
let currentUsername = null;
let currentRoom = null;
let availableRooms = [];

// DOM elements
const usernameInput = document.getElementById("usernameInput");
const joinBtn = document.getElementById("joinBtn");
const statusSpan = document.getElementById("status");
const joinSection = document.getElementById("joinSection");
const roomSection = document.getElementById("roomSection");
const roomButtons = document.getElementById("roomButtons");
const chatWindow = document.getElementById("chatWindow");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const currentRoomDisplay = document.getElementById("currentRoomDisplay");
const roomSwitcher = document.getElementById("roomSwitcher");
const roomSwitchButtons = document.getElementById("roomSwitchButtons");

// Initialize the application
function init() {
  setupEventListeners();
  usernameInput.focus();
  connectToServer();
}

function setupEventListeners() {
  // Username/Join
  joinBtn.addEventListener("click", handleJoin);
  usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleJoin();
  });

  // Chat
  sendBtn.addEventListener("click", sendMessage);
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Room switching is handled by buttons
}

function handleJoin() {
  const name = usernameInput.value.trim();
  if (!name) {
    alert("Please enter a username.");
    return;
  }

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    alert("Not connected to server. Please wait...");
    return;
  }

  // Send join message. Wait for server confirmation (ROOM_LIST) before updating UI.
  socket.send(JSON.stringify({
    type: "join",
    name: name,
  }));
}

function handleRoomJoin(roomName) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    alert("Not connected to server.");
    return;
  }

  // Clear chat window when joining new room
  chatWindow.innerHTML = "";
  
  // Send join room message
  socket.send(JSON.stringify({
    type: "join_room",
    room: roomName,
  }));

  currentRoom = roomName;
  currentRoomDisplay.textContent = `Room: ${roomName}`;
  
  // Hide room selection, enable messaging
  roomSection.style.display = "none";
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.placeholder = `Type a message in ${roomName}...`;
  messageInput.focus();
  
  // Show room switcher in header
  roomSwitcher.style.display = "flex";

  // Update room switch buttons
  updateRoomSwitcher();
}

function switchToRoom(roomName) {
  if (!roomName || roomName === currentRoom) {
    return;
  }

  // Clear chat window when switching rooms
  chatWindow.innerHTML = "";

  // Send join room message (same as initial join)
  socket.send(JSON.stringify({
    type: "join_room",
    room: roomName,
  }));

  currentRoom = roomName;
  currentRoomDisplay.textContent = `Room: ${roomName}`;
  messageInput.placeholder = `Type a message in ${roomName}...`;
  messageInput.focus();

  // Update the room switch buttons so the newly-current room is excluded
  updateRoomSwitcher();
}

function updateRoomSwitcher() {
  // Clear existing buttons
  roomSwitchButtons.innerHTML = "";

  // Add buttons for other available rooms
  availableRooms.forEach(room => {
    if (room !== currentRoom) {
      const button = document.createElement("button");
      button.classList.add("switch-btn");
      button.textContent = `Switch to ${room}`;
      button.addEventListener("click", () => switchToRoom(room));
      roomSwitchButtons.appendChild(button);
    }
  });
}

function connectToServer() {
  // Determine WebSocket URL
  let wsUrl;
  const host = window.location.hostname;
  const port = window.location.port;
  if ((host === "localhost" || host === "127.0.0.1") && port && port !== "3000") {
    wsUrl = "ws://localhost:3000";
  } else {
    wsUrl = `ws://${window.location.host}`;
  }

  console.log("Connecting to WebSocket:", wsUrl);
  socket = new WebSocket(wsUrl);

  socket.addEventListener("open", () => {
    console.log("WebSocket connected");
    statusSpan.innerHTML = '<span class="status-indicator"></span>Connected';
  });

  socket.addEventListener("message", (event) => {
    handleMessage(event);
  });

  socket.addEventListener("close", () => {
    console.log("WebSocket closed");
    statusSpan.innerHTML = '<span class="status-indicator" style="background: #ef4444;"></span>Disconnected';
    
    // Reset UI state
    resetToInitialState();
  });

  socket.addEventListener("error", (err) => {
    console.error("WebSocket error:", err);
    statusSpan.innerHTML = '<span class="status-indicator" style="background: #ef4444;"></span>Connection Error';
  });
}

function resetToInitialState() {
  joinSection.style.display = "flex";
  roomSection.style.display = "none";
  roomSwitcher.style.display = "none";
  messageInput.disabled = true;
  sendBtn.disabled = true;
  messageInput.placeholder = "Select a room to start chatting...";
  currentRoomDisplay.textContent = "Select a room to join";
  chatWindow.innerHTML = "";
  currentRoom = null;
  currentUsername = null;
  usernameInput.value = "";
}

function handleMessage(event) {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch (err) {
    console.error("Invalid message from server:", event.data);
    return;
  }

  console.log("Received message:", msg);

  switch (msg.type) {
    case "room_list":
      handleRoomList(msg.rooms);
      break;
    case "history":
      handleHistory(msg.messages, msg.room);
      break;
    case "message":
      handleChatMessage(msg);
      break;
    case "system":
      handleSystemMessage(msg);
      break;
    case "user_joined_room":
      handleUserJoinedRoom(msg);
      break;
    case "user_left_room":
      handleUserLeftRoom(msg);
      break;
    case "error":
      handleError(msg.message);
      break;
    case "username_taken":
      // Server rejected the attempted username
      alert(msg.message || "Username already taken. Choose another.");
      // Keep the join UI visible and focus the input so the user can try a different name
      usernameInput.focus();
      break;
    default:
      console.log("Unknown message type:", msg.type);
  }
}

function handleRoomList(rooms) {
  availableRooms = rooms;
  
  // Clear existing room buttons
  roomButtons.innerHTML = "";
  
  // Create room buttons
  rooms.forEach(room => {
    const button = document.createElement("button");
    button.classList.add("room-btn");
    button.textContent = room;
    button.addEventListener("click", () => handleRoomJoin(room));
    roomButtons.appendChild(button);
  });
  
  console.log("Available rooms:", rooms);
  // If we haven't set currentUsername yet, this ROOM_LIST likely came after a successful join
  if (!currentUsername && usernameInput.value.trim()) {
    currentUsername = usernameInput.value.trim();
    // Hide join section, show room selection
    joinSection.style.display = "none";
    roomSection.style.display = "block";
  }
}

function handleHistory(messages, room) {
  if (room !== currentRoom) {
    console.log("Received history for different room, ignoring");
    return;
  }
  
  messages.forEach(msg => {
    if (msg.type === "message") {
      displayChatMessage(msg);
    } else if (msg.type === "system") {
      displaySystemMessage(msg);
    }
  });
}

function handleChatMessage(msg) {
  // Only show messages for current room
  if (msg.room !== currentRoom) return;
  displayChatMessage(msg);
}

function handleSystemMessage(msg) {
  // If system message is room-scoped, only show for that room. If it's global (no room), show it.
  if (msg.room && msg.room !== currentRoom) return;
  displaySystemMessage(msg);
}

function handleUserJoinedRoom(msg) {
  // Only show join notifications for current room
  if (msg.room !== currentRoom) return;
  displaySystemMessage({
    message: `${msg.user} joined the room`,
    timestamp: msg.timestamp
  });
}

function handleUserLeftRoom(msg) {
  if (msg.room !== currentRoom) return;
  displaySystemMessage({
    message: `${msg.user} left the room`,
    timestamp: msg.timestamp
  });
}

function displayChatMessage(msg) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message");
  
  const isOwnMessage = msg.from === currentUsername;
  if (isOwnMessage) {
    messageDiv.classList.add("own");
  }

  const bubbleDiv = document.createElement("div");
  bubbleDiv.classList.add("message-bubble");

  // Add sender name (except for own messages)
  if (!isOwnMessage) {
    const senderDiv = document.createElement("div");
    senderDiv.classList.add("message-sender");
    senderDiv.textContent = msg.from;
    bubbleDiv.appendChild(senderDiv);
  }

  // Add message text
  const textDiv = document.createElement("div");
  textDiv.classList.add("message-text");
  textDiv.textContent = msg.message;
  bubbleDiv.appendChild(textDiv);

  // Add timestamp
  const timeDiv = document.createElement("div");
  timeDiv.classList.add("message-time");
  timeDiv.textContent = formatTime(msg.timestamp);
  bubbleDiv.appendChild(timeDiv);

  messageDiv.appendChild(bubbleDiv);
  chatWindow.appendChild(messageDiv);
  
  // Smooth scroll to bottom
  setTimeout(() => {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }, 50);
}

function displaySystemMessage(msg) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", "system", "room-system");

  const bubbleDiv = document.createElement("div");
  bubbleDiv.classList.add("message-bubble");
  bubbleDiv.textContent = msg.message;

  messageDiv.appendChild(bubbleDiv);
  chatWindow.appendChild(messageDiv);
  
  setTimeout(() => {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }, 50);
}

function handleError(errorMessage) {
  alert("Error: " + errorMessage);
  console.warn("Server error:", errorMessage);
}

function sendMessage() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    alert("Not connected to the chat yet.");
    return;
  }

  if (!currentRoom) {
    alert("You must join a room before sending messages.");
    return;
  }

  const text = messageInput.value.trim();
  if (!text) return;

  socket.send(JSON.stringify({
    type: "message",
    text: text,
  }));

  messageInput.value = "";
  messageInput.focus();
}

// Utility functions
function formatTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", init);

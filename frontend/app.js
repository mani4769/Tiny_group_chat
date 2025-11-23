// frontend/app.js - Simple single-room chat client

let socket = null;
let currentUsername = null;

// DOM elements
const usernameInput = document.getElementById("usernameInput");
const joinBtn = document.getElementById("joinBtn");
const statusSpan = document.getElementById("status");
const joinSection = document.getElementById("joinSection");
const chatWindow = document.getElementById("chatWindow");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// Initialize the application
function init() {
  setupEventListeners();
  usernameInput.focus();
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
}

function handleJoin() {
  const name = usernameInput.value.trim();
  if (!name) {
    alert("Please enter a username.");
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    alert("You are already connected.");
    return;
  }

  currentUsername = name;
  connectToServer();
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
    
    // Hide join section and enable messaging
    joinSection.style.display = "none";
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
    
    // Send join message
    socket.send(JSON.stringify({
      type: "join",
      name: currentUsername,
    }));
  });

  socket.addEventListener("message", (event) => {
    handleMessage(event);
  });

  socket.addEventListener("close", () => {
    console.log("WebSocket closed");
    statusSpan.innerHTML = '<span class="status-indicator" style="background: #ef4444;"></span>Disconnected';
    
    // Show join section and disable messaging
    joinSection.style.display = "flex";
    messageInput.disabled = true;
    sendBtn.disabled = true;
  });

  socket.addEventListener("error", (err) => {
    console.error("WebSocket error:", err);
    statusSpan.innerHTML = '<span class="status-indicator" style="background: #ef4444;"></span>Connection Error';
  });
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
    case "history":
      handleHistory(msg.messages);
      break;
    case "message":
      handleChatMessage(msg);
      break;
    case "system":
      handleSystemMessage(msg);
      break;
    case "error":
      handleError(msg.message);
      break;
    default:
      console.log("Unknown message type:", msg.type);
  }
}

function handleHistory(messages) {
  messages.forEach(msg => {
    if (msg.type === "message") {
      displayChatMessage(msg);
    } else if (msg.type === "system") {
      displaySystemMessage(msg);
    }
  });
}

function handleChatMessage(msg) {
  displayChatMessage(msg);
}

function handleSystemMessage(msg) {
  displaySystemMessage(msg);
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
  messageDiv.classList.add("message", "system");

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

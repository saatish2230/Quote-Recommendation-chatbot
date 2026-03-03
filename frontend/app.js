/* ============================================================
   QuotesMind — app.js
   Rasa NLP Chatbot Interface
   ============================================================ */

// ── Configuration ─────────────────────────────────────────────
const CONFIG = {
  API_URL: "http://localhost:5005/webhooks/rest/webhook",
  SENDER:  "user",
};

// ── State ──────────────────────────────────────────────────────
let isBotTyping = false;

// ── DOM References ─────────────────────────────────────────────
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn      = document.getElementById("sendBtn");
const clearBtn     = document.getElementById("clearBtn");
const suggestions  = document.getElementById("suggestions");
const welcomeScreen = document.getElementById("welcomeScreen");

// ── Init ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  spawnParticles();
  messageInput.focus();

  // Auto-resize textarea as user types
  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
  });

  // Enter = send, Shift+Enter = newline
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Send button click
  sendBtn.addEventListener("click", sendMessage);

  // Suggestion chip clicks
  suggestions.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const msg = chip.dataset.msg;
      if (msg) {
        messageInput.value = msg;
        sendMessage();
      }
    });
  });

  // Clear chat button
  clearBtn.addEventListener("click", clearChat);
});

// ── Send Message ───────────────────────────────────────────────
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || isBotTyping) return;

  // Clear & reset textarea
  messageInput.value = "";
  messageInput.style.height = "auto";
  setUIState(false);

  // Hide welcome screen & suggestions on first message
  removeWelcome();
  hideSuggestions();

  // Render user bubble
  appendMessage("user", text);

  // Show typing indicator
  const typingEl = showTyping();

  try {
    const responses = await queryRasa(text);
    removeTyping(typingEl);

    if (responses && responses.length > 0) {
      // Stagger multiple responses slightly
      for (let i = 0; i < responses.length; i++) {
        if (responses[i].text) {
          if (i > 0) await delay(400);
          appendMessage("bot", responses[i].text);
        }
      }
    } else {
      appendMessage("bot", "Hmm, I didn't catch that. Try asking me for a motivational, love, or emotional quote!");
    }
  } catch (err) {
    removeTyping(typingEl);
    appendError(err.message);
  } finally {
    setUIState(true);
    messageInput.focus();
    isBotTyping = false;
  }
}

// ── Rasa API Call ──────────────────────────────────────────────
async function queryRasa(message) {
  const response = await fetch(CONFIG.API_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ sender: CONFIG.SENDER, message }),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ── Render: Message Bubble ─────────────────────────────────────
function appendMessage(role, text) {
  const isBot = role === "bot";
  const time  = getTime();

  const row = document.createElement("div");
  row.className = `msg-row ${role}`;

  // Avatar (only for bot)
  if (isBot) {
    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.textContent = "◈";
    row.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";

  const textEl = document.createElement("div");
  textEl.className = "msg-text" + (isBot ? " is-quote" : "");
  textEl.textContent = text; // safe text — no innerHTML to avoid XSS

  const timeEl = document.createElement("div");
  timeEl.className = "msg-time";
  timeEl.textContent = time;

  bubble.appendChild(textEl);
  bubble.appendChild(timeEl);
  row.appendChild(bubble);

  chatMessages.appendChild(row);
  scrollToBottom();
}

// ── Render: Typing Indicator ───────────────────────────────────
function showTyping() {
  isBotTyping = true;

  const row = document.createElement("div");
  row.className = "msg-row bot";
  row.id = "typingRow";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "◈";

  const bubble = document.createElement("div");
  bubble.className = "typing-bubble";
  bubble.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatMessages.appendChild(row);
  scrollToBottom();
  return row;
}

function removeTyping(el) {
  if (el && el.parentNode) el.remove();
}

// ── Render: Error ──────────────────────────────────────────────
function appendError(msg) {
  const row = document.createElement("div");
  row.className = "msg-row bot";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "◈";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";

  const textEl = document.createElement("div");
  textEl.className = "msg-text error-text";
  textEl.textContent = `⚠ Could not reach Rasa server. Is it running on localhost:5005? (${msg})`;

  bubble.appendChild(textEl);
  row.appendChild(avatar);
  row.appendChild(bubble);
  chatMessages.appendChild(row);
  scrollToBottom();
}

// ── Clear Chat ─────────────────────────────────────────────────
function clearChat() {
  chatMessages.innerHTML = "";
  // Re-show welcome screen
  const welcome = document.createElement("div");
  welcome.className = "welcome-msg";
  welcome.id = "welcomeScreen";
  welcome.innerHTML = `
    <span class="welcome-icon">✦</span>
    <h2>Hello, I'm QuotesMind</h2>
    <p>Share how you're feeling or what you need.<br/>I'll find the perfect quote for you.</p>
  `;
  chatMessages.appendChild(welcome);
  // Re-show suggestions
  suggestions.classList.remove("hidden");
}

// ── Helpers ────────────────────────────────────────────────────
function removeWelcome() {
  const w = document.getElementById("welcomeScreen");
  if (w) w.remove();
}

function hideSuggestions() {
  if (suggestions) suggestions.classList.add("hidden");
}

function setUIState(enabled) {
  sendBtn.disabled      = !enabled;
  messageInput.disabled = !enabled;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Ambient Particles ──────────────────────────────────────────
function spawnParticles() {
  const container = document.getElementById("particlesWrap");
  if (!container) return;

  const colors = ["#00f5ff", "#b14fff", "#ff3dbd", "#3d8bff"];
  const count  = 20;

  for (let i = 0; i < count; i++) {
    const p     = document.createElement("div");
    p.className = "particle";
    const size  = Math.random() * 4 + 2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    Object.assign(p.style, {
      left:            `${Math.random() * 100}%`,
      bottom:          `${Math.random() * 40}%`,
      width:           `${size}px`,
      height:          `${size}px`,
      background:      color,
      boxShadow:       `0 0 ${size * 3}px ${color}`,
      borderRadius:    "50%",
      position:        "absolute",
      animationDuration: `${Math.random() * 8 + 6}s`,
      animationDelay:  `${Math.random() * -12}s`,
      animationName:   "particleFloat",
      animationTimingFunction: "linear",
      animationIterationCount: "infinite",
      opacity: "0",
    });
    container.appendChild(p);
  }
}

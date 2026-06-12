/**
 * AURA — CORE APPLICATION LOGIC
 * Lighthearted White & Sky Blue Redesign
 */

document.addEventListener('DOMContentLoaded', () => {
  // ─── INITIALIZATION ───────────────────────────────────────────
  
  // Lucide Icons
  lucide.createIcons();

  // Lenis Smooth Scroll
  const lenis = new Lenis();
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // ─── DOM ELEMENTS ──────────────────────────────────────────────
  const bootScreen = document.getElementById('boot-screen');
  const appShell = document.getElementById('app');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const messagesContainer = document.getElementById('messages-container');
  const welcomeState = document.getElementById('welcome-state');
  const thinkingBar = document.getElementById('thinking-bar');
  const btnSettings = document.getElementById('btn-settings');
  const settingsOverlay = document.getElementById('settings-overlay');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const clockTime = document.getElementById('clock-time');
  const clockDate = document.getElementById('clock-date');
  const engineBtns = document.querySelectorAll('.engine-btn');
  const engineBadge = document.getElementById('engine-badge');

  // ─── STATE ─────────────────────────────────────────────────────
  let currentEngine = 'gemini';
  let isThinking = false;

  // ─── BOOT SEQUENCE ─────────────────────────────────────────────
  setTimeout(() => {
    bootScreen.classList.add('fade-out');
    appShell.classList.remove('hidden');
    updateClock();
    setInterval(updateClock, 1000);
    loadEnvironment();
  }, 2000);

  // ─── CLOCK & ENVIRONMENT ───────────────────────────────────────
  function updateClock() {
    const now = new Date();
    clockTime.textContent = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    clockDate.textContent = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Greeting update
    const hours = now.getHours();
    const greetingTime = document.getElementById('greeting-time');
    if (hours < 12) greetingTime.textContent = 'morning';
    else if (hours < 18) greetingTime.textContent = 'afternoon';
    else greetingTime.textContent = 'evening';
  }

  function loadEnvironment() {
    document.getElementById('ctx-browser').textContent = navigator.userAgent.split(' ').pop();
    document.getElementById('ctx-screen').textContent = `${window.screen.width}x${window.screen.height}`;
    document.getElementById('ctx-tz').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.getElementById('ctx-online').textContent = navigator.onLine ? 'Online' : 'Offline';
    document.getElementById('ctx-platform').textContent = navigator.platform;
    
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        document.getElementById('ctx-battery').textContent = `${Math.round(battery.level * 100)}%`;
      });
    }
  }

  // ─── CHAT LOGIC ────────────────────────────────────────────────
  function addMessage(text, role) {
    welcomeState.classList.add('hidden');
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `message message-${role}`;
    msgDiv.innerHTML = `
      <div class="msg-bubble">
        ${text}
      </div>
    `;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function handleSendMessage() {
    const text = chatInput.value.trim();
    if (!text || isThinking) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';
    addMessage(text, 'user');
    
    isThinking = true;
    thinkingBar.classList.remove('hidden');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Simulate AI response for now
    setTimeout(() => {
      thinkingBar.classList.add('hidden');
      addMessage(`I am Aura, your intelligent presence. I've received your message: "${text}". How else can I help you today?`, 'aura');
      isThinking = false;
      
      // Update stats
      const msgStat = document.getElementById('stat-messages');
      msgStat.textContent = parseInt(msgStat.textContent) + 2;
    }, 1500);
  }

  sendBtn.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
  });

  // ─── ENGINE SWITCHING ──────────────────────────────────────────
  engineBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      engineBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEngine = btn.dataset.engine;
      engineBadge.textContent = currentEngine.charAt(0).toUpperCase() + currentEngine.slice(1);
    });
  });

  // ─── SETTINGS ──────────────────────────────────────────────────
  btnSettings.addEventListener('click', () => settingsOverlay.classList.remove('hidden'));
  btnCloseSettings.addEventListener('click', () => settingsOverlay.classList.add('hidden'));
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
  });

  // Theme Toggle
  const btnToggleDark = document.getElementById('toggle-dark-mode');
  btnToggleDark.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    btnToggleDark.classList.toggle('active');
    btnToggleDark.setAttribute('aria-checked', !isDark);
  });

  // Suggestion Chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chatInput.value = chip.dataset.prompt;
      handleSendMessage();
    });
  });
});

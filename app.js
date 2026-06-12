/**
 * AURA — CORE APPLICATION LOGIC
 * Production-Ready with Full API Integration
 * Features: Gemini/Ollama API, OpenWeather, Local Storage, Context Injection
 */

// ═══════════════════════════════════════════════════════════════════
// STORAGE & CONFIG MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

const StorageManager = {
  PREFIX: 'aura_',
  
  get(key, defaultValue = null) {
    try {
      const stored = localStorage.getItem(this.PREFIX + key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
      console.error(`Storage get error for ${key}:`, e);
      return defaultValue;
    }
  },
  
  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Storage set error for ${key}:`, e);
      return false;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(this.PREFIX + key);
      return true;
    } catch (e) {
      console.error(`Storage remove error for ${key}:`, e);
      return false;
    }
  },
  
  clear() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.PREFIX)) localStorage.removeItem(key);
      });
      return true;
    } catch (e) {
      console.error('Storage clear error:', e);
      return false;
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

const Toast = {
  stack: null,
  
  init() {
    this.stack = document.getElementById('toast-stack');
  },
  
  show(message, type = 'info', duration = 4000) {
    if (!this.stack) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.stack.appendChild(toast);
    
    if (duration > 0) {
      setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400);
      }, duration);
    }
  },
  
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error', 5000); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); }
};

// ═══════════════════════════════════════════════════════════════════
// ENVIRONMENT CONTEXT
// ═══════════════════════════════════════════════════════════════════

const EnvironmentContext = {
  data: {},
  
  async collect() {
    this.data = {
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      browser: this.getBrowserInfo(),
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth
      },
      platform: navigator.platform,
      language: navigator.language,
      online: navigator.onLine,
      battery: await this.getBatteryStatus(),
      memory: this.getMemoryInfo()
    };
    return this.data;
  },
  
  getBrowserInfo() {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  },
  
  async getBatteryStatus() {
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        return {
          level: Math.round(battery.level * 100),
          charging: battery.charging
        };
      }
    } catch (e) {
      console.debug('Battery API not available');
    }
    return null;
  },
  
  getMemoryInfo() {
    if (performance.memory) {
      return {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576),
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576)
      };
    }
    return null;
  },
  
  getContextString() {
    const ctx = this.data;
    return `
SYSTEM CONTEXT:
- Timezone: ${ctx.timezone}
- Browser: ${ctx.browser}
- Screen: ${ctx.screen.width}x${ctx.screen.height}
- Platform: ${ctx.platform}
- Language: ${ctx.language}
- Online: ${ctx.online ? 'Yes' : 'No'}
- Time: ${new Date().toLocaleString()}
${ctx.battery ? `- Battery: ${ctx.battery.level}% (${ctx.battery.charging ? 'Charging' : 'Discharging'})` : ''}
    `.trim();
  }
};

// ═══════════════════════════════════════════════════════════════════
// WEATHER API
// ═══════════════════════════════════════════════════════════════════

const WeatherAPI = {
  async fetchWeather(city, apiKey, units = 'metric') {
    if (!city || !apiKey) {
      return { error: 'Missing city or API key' };
    }
    
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${units}`;
      const response = await fetch(url, { mode: 'cors' });
      
      if (!response.ok) {
        if (response.status === 401) return { error: 'Invalid API key' };
        if (response.status === 404) return { error: 'City not found' };
        return { error: `API error: ${response.status}` };
      }
      
      const data = await response.json();
      return {
        city: data.name,
        country: data.sys.country,
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        description: data.weather[0].main,
        icon: data.weather[0].icon,
        windSpeed: Math.round(data.wind.speed * 10) / 10
      };
    } catch (e) {
      console.error('Weather fetch error:', e);
      return { error: e.message };
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// GEMINI API
// ═══════════════════════════════════════════════════════════════════

const GeminiAPI = {
  async callAPI(apiKey, model, messages, systemPrompt) {
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add it in Settings.');
    }
    
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      // Format messages for Gemini API
      const contents = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      
      const payload = {
        system: systemPrompt,
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) throw new Error('Invalid Gemini API key');
        if (response.status === 429) throw new Error('Rate limit exceeded. Please wait a moment.');
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response from Gemini API');
      }
      
      return data.candidates[0].content.parts[0].text;
    } catch (e) {
      console.error('Gemini API error:', e);
      throw e;
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// OLLAMA API
// ═══════════════════════════════════════════════════════════════════

const OllamaAPI = {
  async callAPI(endpoint, model, messages, systemPrompt) {
    if (!endpoint || !model) {
      throw new Error('Ollama endpoint or model not configured. Please add it in Settings.');
    }
    
    try {
      // Ensure endpoint doesn't have trailing slash
      const baseUrl = endpoint.replace(/\/$/, '');
      const url = `${baseUrl}/api/chat`;
      
      // Format messages for Ollama
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add system message
      formattedMessages.unshift({
        role: 'system',
        content: systemPrompt
      });
      
      const payload = {
        model: model,
        messages: formattedMessages,
        stream: false
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        if (response.status === 404) throw new Error('Ollama endpoint not found. Is it running?');
        throw new Error(`Ollama error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.message?.content) {
        throw new Error('Invalid response from Ollama');
      }
      
      return data.message.content;
    } catch (e) {
      console.error('Ollama API error:', e);
      throw e;
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════════════════════════════════

const Aura = {
  // State
  state: {
    currentEngine: 'gemini',
    isThinking: false,
    ttsEnabled: false,
    messages: [],
    messageCount: 0,
    tokenCount: 0
  },
  
  // DOM Elements
  elements: {},
  
  // Initialize
  async init() {
    console.log('🚀 Initializing Aura...');
    
    // Cache DOM elements
    this.cacheElements();
    
    // Initialize services
    Toast.init();
    await EnvironmentContext.collect();
    
    // Load stored settings
    this.loadSettings();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Update UI
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
    
    this.updateEnvironment();
    this.loadWeather();
    setInterval(() => this.loadWeather(), 300000); // Every 5 minutes
    
    // Boot sequence
    setTimeout(() => {
      this.elements.bootScreen.classList.add('fade-out');
      this.elements.app.classList.remove('hidden');
      Toast.success('Aura initialized successfully');
    }, 2000);
  },
  
  cacheElements() {
    this.elements = {
      bootScreen: document.getElementById('boot-screen'),
      app: document.getElementById('app'),
      chatInput: document.getElementById('chat-input'),
      sendBtn: document.getElementById('send-btn'),
      messagesContainer: document.getElementById('messages-container'),
      welcomeState: document.getElementById('welcome-state'),
      thinkingBar: document.getElementById('thinking-bar'),
      btnSettings: document.getElementById('btn-settings'),
      settingsOverlay: document.getElementById('settings-overlay'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      clockTime: document.getElementById('clock-time'),
      clockDate: document.getElementById('clock-date'),
      clockTz: document.getElementById('clock-tz'),
      engineBtns: document.querySelectorAll('.engine-btn'),
      engineBadge: document.getElementById('engine-badge'),
      weatherContent: document.getElementById('weather-content'),
      contextGrid: document.getElementById('context-grid'),
      btnTts: document.getElementById('btn-tts'),
      btnClear: document.getElementById('btn-clear'),
      micBtn: document.getElementById('mic-btn'),
      greetingName: document.getElementById('greeting-name'),
      greetingTime: document.getElementById('greeting-time'),
      suggestionChips: document.querySelectorAll('.chip'),
      statusText: document.getElementById('status-text'),
      statMessages: document.getElementById('stat-messages'),
      statTokens: document.getElementById('stat-tokens'),
      personaName: document.getElementById('persona-name-display'),
      personaTone: document.getElementById('persona-tone-display')
    };
  },
  
  setupEventListeners() {
    // Chat
    this.elements.sendBtn.addEventListener('click', () => this.handleSendMessage());
    this.elements.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });
    this.elements.chatInput.addEventListener('input', () => {
      this.elements.chatInput.style.height = 'auto';
      this.elements.chatInput.style.height = this.elements.chatInput.scrollHeight + 'px';
      this.updateSendButtonState();
    });
    
    // Engine switching
    this.elements.engineBtns.forEach(btn => {
      btn.addEventListener('click', () => this.switchEngine(btn.dataset.engine));
    });
    
    // Settings
    this.elements.btnSettings.addEventListener('click', () => this.openSettings());
    this.elements.btnCloseSettings.addEventListener('click', () => this.closeSettings());
    this.elements.settingsOverlay.addEventListener('click', (e) => {
      if (e.target === this.elements.settingsOverlay) this.closeSettings();
    });
    
    // Settings form
    document.getElementById('btn-save-settings').addEventListener('click', () => this.saveSettings());
    document.getElementById('btn-reset-settings').addEventListener('click', () => this.resetSettings());
    document.getElementById('toggle-dark-mode').addEventListener('click', (e) => this.toggleDarkMode(e));
    
    // API key visibility toggles
    document.getElementById('toggle-gemini-key').addEventListener('click', () => {
      this.togglePasswordVisibility(document.getElementById('s-gemini-key'));
    });
    document.getElementById('toggle-weather-key').addEventListener('click', () => {
      this.togglePasswordVisibility(document.getElementById('s-weather-key'));
    });
    
    // Other actions
    this.elements.btnClear.addEventListener('click', () => this.clearChat());
    this.elements.btnTts.addEventListener('click', () => this.toggleTTS());
    
    // Suggestion chips
    this.elements.suggestionChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.elements.chatInput.value = chip.dataset.prompt;
        this.handleSendMessage();
      });
    });
    
    // Network status
    window.addEventListener('online', () => {
      Toast.success('Back online');
      this.updateEnvironment();
    });
    window.addEventListener('offline', () => {
      Toast.warning('You are offline');
      this.updateEnvironment();
    });
  },
  
  updateSendButtonState() {
    const hasText = this.elements.chatInput.value.trim().length > 0;
    this.elements.sendBtn.disabled = !hasText || this.state.isThinking;
  },
  
  // ─── CLOCK & ENVIRONMENT ───────────────────────────────────────
  
  updateClock() {
    const now = new Date();
    this.elements.clockTime.textContent = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    this.elements.clockDate.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    this.elements.clockTz.textContent = EnvironmentContext.data.timezone || '—';
    
    // Update greeting
    const hours = now.getHours();
    if (hours < 12) this.elements.greetingTime.textContent = 'morning';
    else if (hours < 18) this.elements.greetingTime.textContent = 'afternoon';
    else this.elements.greetingTime.textContent = 'evening';
  },
  
  updateEnvironment() {
    const ctx = EnvironmentContext.data;
    document.getElementById('ctx-browser').textContent = ctx.browser || '—';
    document.getElementById('ctx-screen').textContent = `${ctx.screen.width}x${ctx.screen.height}`;
    document.getElementById('ctx-tz').textContent = ctx.timezone || '—';
    document.getElementById('ctx-online').textContent = ctx.online ? 'Online' : 'Offline';
    document.getElementById('ctx-platform').textContent = ctx.platform || '—';
    
    if (ctx.battery) {
      document.getElementById('ctx-battery').textContent = `${ctx.battery.level}%`;
    }
  },
  
  async loadWeather() {
    const city = StorageManager.get('weather_city');
    const apiKey = StorageManager.get('weather_key');
    const units = StorageManager.get('weather_unit', 'metric');
    
    if (!city || !apiKey) {
      this.elements.weatherContent.innerHTML = '<p class="weather-error">Configure weather in settings</p>';
      return;
    }
    
    this.elements.weatherContent.innerHTML = `
      <div class="weather-loading">
        <div class="pulse-dot"></div>
        <span>Fetching…</span>
      </div>
    `;
    
    try {
      const weather = await WeatherAPI.fetchWeather(city, apiKey, units);
      
      if (weather.error) {
        this.elements.weatherContent.innerHTML = `<p class="weather-error">${weather.error}</p>`;
        return;
      }
      
      const unitSymbol = units === 'metric' ? '°C' : '°F';
      this.elements.weatherContent.innerHTML = `
        <div class="weather-display">
          <div class="weather-temp">${weather.temp}${unitSymbol}</div>
          <div class="weather-desc">${weather.description}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">
            ${weather.city}, ${weather.country}
          </div>
        </div>
      `;
    } catch (e) {
      console.error('Weather error:', e);
      this.elements.weatherContent.innerHTML = `<p class="weather-error">Error loading weather</p>`;
    }
  },
  
  // ─── CHAT LOGIC ────────────────────────────────────────────────
  
  async handleSendMessage() {
    const text = this.elements.chatInput.value.trim();
    if (!text || this.state.isThinking) return;
    
    this.elements.chatInput.value = '';
    this.elements.chatInput.style.height = 'auto';
    this.updateSendButtonState();
    
    this.addMessage(text, 'user');
    this.state.messages.push({ role: 'user', content: text });
    
    this.state.isThinking = true;
    this.elements.thinkingBar.classList.remove('hidden');
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    
    try {
      const response = await this.callAI(text);
      this.state.messages.push({ role: 'assistant', content: response });
      this.addMessage(response, 'aura');
      
      if (this.state.ttsEnabled) {
        this.speakMessage(response);
      }
    } catch (e) {
      console.error('AI call error:', e);
      this.addMessage(`Error: ${e.message}`, 'aura', true);
    } finally {
      this.state.isThinking = false;
      this.elements.thinkingBar.classList.add('hidden');
      this.updateSendButtonState();
      this.updateStats();
    }
  },
  
  async callAI(userMessage) {
    const userProfile = StorageManager.get('user_name', 'User');
    const userAbout = StorageManager.get('user_about', '');
    const personaTone = StorageManager.get('persona_tone', 'Professional and precise');
    
    const systemPrompt = `You are Aura, an intelligent AI assistant. You are helpful, harmless, and honest.

User Profile:
- Name: ${userProfile}
${userAbout ? `- About: ${userAbout}` : ''}

Persona & Tone:
${personaTone}

${EnvironmentContext.getContextString()}

Current Weather:
${await this.getWeatherContext()}

Respond concisely and naturally. Avoid unnecessary pleasantries.`;
    
    if (this.state.currentEngine === 'gemini') {
      const apiKey = StorageManager.get('gemini_key');
      const model = StorageManager.get('gemini_model', 'gemini-2.0-flash');
      return await GeminiAPI.callAPI(apiKey, model, this.state.messages, systemPrompt);
    } else {
      const endpoint = StorageManager.get('ollama_url', 'http://localhost:11434');
      const model = StorageManager.get('ollama_model', 'llama2');
      return await OllamaAPI.callAPI(endpoint, model, this.state.messages, systemPrompt);
    }
  },
  
  async getWeatherContext() {
    const city = StorageManager.get('weather_city');
    const apiKey = StorageManager.get('weather_key');
    const units = StorageManager.get('weather_unit', 'metric');
    
    if (!city || !apiKey) return 'Weather not configured';
    
    try {
      const weather = await WeatherAPI.fetchWeather(city, apiKey, units);
      if (weather.error) return `Weather unavailable: ${weather.error}`;
      
      const unitName = units === 'metric' ? 'Celsius' : 'Fahrenheit';
      return `${weather.city}: ${weather.temp}°${units === 'metric' ? 'C' : 'F'}, ${weather.description}, Humidity: ${weather.humidity}%`;
    } catch (e) {
      return 'Weather unavailable';
    }
  },
  
  addMessage(text, role, isError = false) {
    this.elements.welcomeState.classList.add('hidden');
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `message message-${role} ${isError ? 'msg-error' : ''}`;
    msgDiv.innerHTML = `<div class="msg-bubble">${this.escapeHtml(text)}</div>`;
    this.elements.messagesContainer.appendChild(msgDiv);
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    
    this.state.messageCount++;
  },
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  speakMessage(text) {
    if (!('speechSynthesis' in window)) {
      Toast.warning('Text-to-speech not supported');
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  },
  
  // ─── SETTINGS ──────────────────────────────────────────────────
  
  loadSettings() {
    // User profile
    document.getElementById('s-user-name').value = StorageManager.get('user_name', '');
    document.getElementById('s-about').value = StorageManager.get('user_about', '');
    document.getElementById('s-tone').value = StorageManager.get('persona_tone', 'Professional and precise');
    
    // Gemini
    document.getElementById('s-gemini-key').value = StorageManager.get('gemini_key', '');
    document.getElementById('s-gemini-model').value = StorageManager.get('gemini_model', 'gemini-2.0-flash');
    
    // Ollama
    document.getElementById('s-ollama-url').value = StorageManager.get('ollama_url', 'http://localhost:11434');
    document.getElementById('s-ollama-model').value = StorageManager.get('ollama_model', 'llama2');
    
    // Weather
    document.getElementById('s-weather-key').value = StorageManager.get('weather_key', '');
    document.getElementById('s-weather-city').value = StorageManager.get('weather_city', '');
    document.getElementById('s-weather-unit').value = StorageManager.get('weather_unit', 'metric');
    
    // Appearance
    const isDark = StorageManager.get('dark_mode', false);
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.getElementById('toggle-dark-mode').classList.add('active');
      document.getElementById('toggle-dark-mode').setAttribute('aria-checked', 'true');
    }
    
    // Update persona display
    this.elements.personaName.textContent = StorageManager.get('user_name', 'You');
    this.elements.personaTone.textContent = StorageManager.get('persona_tone', 'Professional & Precise');
  },
  
  saveSettings() {
    try {
      // User profile
      StorageManager.set('user_name', document.getElementById('s-user-name').value);
      StorageManager.set('user_about', document.getElementById('s-about').value);
      StorageManager.set('persona_tone', document.getElementById('s-tone').value);
      
      // Gemini
      StorageManager.set('gemini_key', document.getElementById('s-gemini-key').value);
      StorageManager.set('gemini_model', document.getElementById('s-gemini-model').value);
      
      // Ollama
      StorageManager.set('ollama_url', document.getElementById('s-ollama-url').value);
      StorageManager.set('ollama_model', document.getElementById('s-ollama-model').value);
      
      // Weather
      StorageManager.set('weather_key', document.getElementById('s-weather-key').value);
      StorageManager.set('weather_city', document.getElementById('s-weather-city').value);
      StorageManager.set('weather_unit', document.getElementById('s-weather-unit').value);
      
      this.loadSettings();
      this.loadWeather();
      this.closeSettings();
      Toast.success('Settings saved successfully');
    } catch (e) {
      console.error('Settings save error:', e);
      Toast.error('Failed to save settings');
    }
  },
  
  resetSettings() {
    if (confirm('Are you sure? This will clear all settings.')) {
      StorageManager.clear();
      this.loadSettings();
      Toast.success('Settings reset to defaults');
    }
  },
  
  openSettings() {
    this.elements.settingsOverlay.classList.remove('hidden');
  },
  
  closeSettings() {
    this.elements.settingsOverlay.classList.add('hidden');
  },
  
  toggleDarkMode(e) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    e.target.classList.toggle('active');
    e.target.setAttribute('aria-checked', !isDark);
    StorageManager.set('dark_mode', !isDark);
  },
  
  togglePasswordVisibility(input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  },
  
  // ─── ACTIONS ───────────────────────────────────────────────────
  
  switchEngine(engine) {
    this.state.currentEngine = engine;
    this.elements.engineBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-engine="${engine}"]`).classList.add('active');
    this.elements.engineBadge.textContent = engine.charAt(0).toUpperCase() + engine.slice(1);
    Toast.info(`Switched to ${engine === 'gemini' ? 'Gemini' : 'Ollama'}`);
  },
  
  clearChat() {
    if (confirm('Clear all messages?')) {
      this.state.messages = [];
      this.state.messageCount = 0;
      this.state.tokenCount = 0;
      this.elements.messagesContainer.innerHTML = '';
      this.elements.welcomeState.classList.remove('hidden');
      this.updateStats();
      Toast.success('Chat cleared');
    }
  },
  
  toggleTTS() {
    this.state.ttsEnabled = !this.state.ttsEnabled;
    this.elements.btnTts.classList.toggle('active');
    const status = document.getElementById('tts-status');
    status.innerHTML = this.state.ttsEnabled
      ? '<i data-lucide="volume-2" class="tts-icon"></i><span>Voice on</span>'
      : '<i data-lucide="volume-x" class="tts-icon"></i><span>Voice off</span>';
    lucide.createIcons();
    Toast.info(`Text-to-speech ${this.state.ttsEnabled ? 'enabled' : 'disabled'}`);
  },
  
  updateStats() {
    this.elements.statMessages.textContent = this.state.messageCount;
    this.elements.statTokens.textContent = `~${Math.round(this.state.messageCount * 150)}`;
  }
};

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  Aura.init();
});

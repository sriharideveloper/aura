/**
 * AURA — CORE APPLICATION LOGIC
 * Production-Ready with Full API Integration
 * Features: Gemini/Ollama API, OpenWeather, Local Storage, Context Injection, Voice Input
 * BYOK: All API keys stored safely in browser localStorage, never sent to any server except their respective APIs
 */

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

const Utils = {
  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().slice(0, 10000); // Max 10k chars for input
  },

  debounce(func, delay) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  }
};

// ═══════════════════════════════════════════════════════════════════
// STORAGE & CONFIG MANAGEMENT (BYOK - Bring Your Own Key)
// ═══════════════════════════════════════════════════════════════════

const StorageManager = {
  PREFIX: 'aura_',
  MAX_STORAGE_SIZE: 5 * 1024 * 1024, // 5MB limit for localStorage

  get(key, defaultValue = null) {
    try {
      if (!this.isValidKey(key)) return defaultValue;
      const stored = localStorage.getItem(this.PREFIX + key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
      console.error(`Storage get error for ${key}:`, e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      if (!this.isValidKey(key)) return false;
      if (!this.isValidValue(value)) return false;

      const serialized = JSON.stringify(value);
      if (serialized.length > this.MAX_STORAGE_SIZE) {
        console.error(`Storage value too large for ${key}`);
        return false;
      }

      localStorage.setItem(this.PREFIX + key, serialized);
      return true;
    } catch (e) {
      console.error(`Storage set error for ${key}:`, e);
      return false;
    }
  },

  remove(key) {
    try {
      if (!this.isValidKey(key)) return false;
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
  },

  isValidKey(key) {
    return typeof key === 'string' && /^[a-zA-Z0-9_]+$/.test(key);
  },

  isValidValue(value) {
    // Prevent storing functions or circular references
    return value !== undefined && typeof value !== 'function';
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
    toast.innerHTML = `<span>${Utils.escapeHtml(message)}</span>`;
    this.stack.appendChild(toast);

    // Auto-remove after duration
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
    if (ua.includes('Chrome') && !ua.includes('Chromium')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
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
      console.debug('Battery API not available or permission denied:', e);
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
    let contextStr = `SYSTEM CONTEXT:\n`;
    contextStr += `- Timezone: ${ctx.timezone}\n`;
    contextStr += `- Browser: ${ctx.browser}\n`;
    contextStr += `- Screen: ${ctx.screen.width}x${ctx.screen.height}\n`;
    contextStr += `- Platform: ${ctx.platform}\n`;
    contextStr += `- Language: ${ctx.language}\n`;
    contextStr += `- Online: ${ctx.online ? 'Yes' : 'No'}\n`;
    contextStr += `- Time: ${new Date().toLocaleString()}\n`;
    if (ctx.battery) {
      contextStr += `- Battery: ${ctx.battery.level}% (${ctx.battery.charging ? 'Charging' : 'Discharging'})\n`;
    }
    return contextStr.trim();
  }
};

// ═══════════════════════════════════════════════════════════════════
// WEATHER API
// ═══════════════════════════════════════════════════════════════════

const WeatherAPI = {
  async fetchWeather(city, apiKey, units = 'metric') {
    if (!city || !apiKey) {
      throw new Error('Missing city or API key for OpenWeather. Please configure in settings.');
    }

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${units}`;
      const response = await fetch(url, { mode: 'cors' });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) throw new Error('Invalid OpenWeather API key.');
        if (response.status === 404) throw new Error(`City not found: ${city}.`);
        throw new Error(errorData.message || `OpenWeather API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        city: data.name,
        country: data.sys.country,
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        windSpeed: Math.round(data.wind.speed * 10) / 10
      };
    } catch (e) {
      console.error('Weather fetch error:', e);
      throw e;
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// GEMINI API (BYOK)
// ═══════════════════════════════════════════════════════════════════

const GeminiAPI = {
  SUPPORTED_MODELS: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],

  async callAPI(apiKey, model, messages, systemPrompt) {
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add it in Settings (BYOK).');
    }

    if (!this.SUPPORTED_MODELS.includes(model)) {
      throw new Error(`Unsupported Gemini model: ${model}. Please select a valid model in settings.`);
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('No messages provided for Gemini API call.');
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const contents = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const payload = {
        system_instruction: systemPrompt,
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) throw new Error('Invalid Gemini API key. Please check your settings.');
        if (response.status === 429) throw new Error('Gemini API rate limit exceeded. Please try again shortly.');
        throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error('No content received from Gemini API. It might be a safety block or an empty response.');
      }

      return data.candidates[0].content.parts[0].text;
    } catch (e) {
      console.error('Gemini API error:', e);
      throw e;
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// OLLAMA API (Local)
// ═══════════════════════════════════════════════════════════════════

const OllamaAPI = {
  async fetchModels(endpoint) {
    if (!endpoint) {
      throw new Error('Ollama endpoint not configured. Cannot fetch models.');
    }
    try {
      new URL(endpoint); // Validate URL format
    } catch (e) {
      throw new Error('Invalid Ollama endpoint URL format.');
    }

    try {
      const baseUrl = endpoint.replace(/\/$/, '');
      const url = `${baseUrl}/api/tags`;
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Ollama server not found at specified endpoint. Is it running?');
        throw new Error(`Ollama API error fetching models: ${response.status}`);
      }
      const data = await response.json();
      return data.models.map(m => m.name);
    } catch (e) {
      console.error('Ollama model fetch error:', e);
      throw e;
    }
  },

  async callAPI(endpoint, model, messages, systemPrompt) {
    if (!endpoint || !model) {
      throw new Error('Ollama endpoint or model not configured. Please add it in Settings.');
    }
    try {
      new URL(endpoint); // Validate URL format
    } catch (e) {
      throw new Error('Invalid Ollama endpoint URL format.');
    }

    if (!/^[a-zA-Z0-9_:-]+$/.test(model)) {
      throw new Error('Invalid Ollama model name format.');
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('No messages provided for Ollama API call.');
    }

    try {
      const baseUrl = endpoint.replace(/\/$/, '');
      const url = `${baseUrl}/api/chat`;

      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Add system message at the beginning
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
        if (response.status === 404) throw new Error('Ollama server not found at specified endpoint. Is it running?');
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.message?.content) {
        throw new Error('No content received from Ollama API. It might be an empty response.');
      }

      return data.message.content;
    } catch (e) {
      console.error('Ollama API error:', e);
      throw e;
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// SPEECH RECOGNITION & SYNTHESIS
// ═══════════════════════════════════════════════════════════════════

const Speech = {
  recognition: null,
  synth: window.speechSynthesis,
  isListening: false,

  init(onResultCallback, onErrorCallback) {
    if (!('webkitSpeechRecognition' in window)) {
      console.warn('Speech recognition not supported in this browser.');
      return;
    }
    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResultCallback(transcript);
      this.isListening = false;
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      onErrorCallback(event.error);
      this.isListening = false;
    };

    this.recognition.onend = () => {
      this.isListening = false;
      Aura.elements.micBtn.classList.remove('active');
    };
  },

  startListening() {
    if (this.recognition && !this.isListening) {
      this.recognition.start();
      this.isListening = true;
      Aura.elements.micBtn.classList.add('active');
      Toast.info('Listening...');
    }
  },

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      Aura.elements.micBtn.classList.remove('active');
    }
  },

  speak(text) {
    if (!('speechSynthesis' in window)) {
      Toast.warning('Text-to-speech not supported by your browser.');
      return;
    }
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    this.synth.speak(utterance);
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
    tokenCount: 0,
    ollamaModels: []
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
    Speech.init(this.handleVoiceInput.bind(this), this.handleVoiceError.bind(this));
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
      personaTone: document.getElementById('persona-tone-display'),
      sGeminiKey: document.getElementById('s-gemini-key'),
      sGeminiModel: document.getElementById('s-gemini-model'),
      sOllamaUrl: document.getElementById('s-ollama-url'),
      sOllamaModel: document.getElementById('s-ollama-model'),
      sWeatherKey: document.getElementById('s-weather-key'),
      sWeatherCity: document.getElementById('s-weather-city'),
      sWeatherUnit: document.getElementById('s-weather-unit'),
      sUserName: document.getElementById('s-user-name'),
      sAbout: document.getElementById('s-about'),
      sTone: document.getElementById('s-tone'),
      toggleDarkModeBtn: document.getElementById('toggle-dark-mode'),
      toggleGeminiKeyBtn: document.getElementById('toggle-gemini-key'),
      toggleWeatherKeyBtn: document.getElementById('toggle-weather-key'),
      ollamaModelSelect: document.getElementById('s-ollama-model')
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
    this.elements.toggleDarkModeBtn.addEventListener('click', (e) => this.toggleDarkMode(e));

    // API key visibility toggles
    this.elements.toggleGeminiKeyBtn.addEventListener('click', () => {
      this.togglePasswordVisibility(this.elements.sGeminiKey);
    });
    this.elements.toggleWeatherKeyBtn.addEventListener('click', () => {
      this.togglePasswordVisibility(this.elements.sWeatherKey);
    });

    // Ollama model list update on endpoint change
    this.elements.sOllamaUrl.addEventListener('input', Utils.debounce(() => this.fetchOllamaModels(), 1000));

    // Other actions
    this.elements.btnClear.addEventListener('click', () => this.clearChat());
    this.elements.btnTts.addEventListener('click', () => this.toggleTTS());
    this.elements.micBtn.addEventListener('click', () => this.toggleVoiceInput());

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
      this.loadWeather();
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
      document.getElementById('ctx-battery').textContent = `${ctx.battery.level}% (${ctx.battery.charging ? 'Charging' : 'Discharging'})`;
    } else {
      document.getElementById('ctx-battery').textContent = 'N/A';
    }
  },

  async loadWeather() {
    const city = StorageManager.get('weather_city');
    const apiKey = StorageManager.get('weather_key');
    const units = StorageManager.get('weather_unit', 'metric');

    this.elements.weatherContent.innerHTML = `
      <div class="weather-loading">
        <div class="pulse-dot"></div>
        <span>Fetching…</span>
      </div>
    `;

    if (!city || !apiKey) {
      this.elements.weatherContent.innerHTML = '<p class="weather-error">Configure weather in settings</p>';
      return;
    }

    try {
      const weather = await WeatherAPI.fetchWeather(city, apiKey, units);

      const unitSymbol = units === 'metric' ? '°C' : '°F';
      this.elements.weatherContent.innerHTML = `
        <div class="weather-display">
          <div class="weather-temp">${weather.temp}${unitSymbol}</div>
          <div class="weather-desc">${Utils.escapeHtml(weather.description)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">
            ${Utils.escapeHtml(weather.city)}, ${Utils.escapeHtml(weather.country)}
          </div>
        </div>
      `;
    } catch (e) {
      console.error('Weather error:', e);
      this.elements.weatherContent.innerHTML = `<p class="weather-error">${Utils.escapeHtml(e.message)}</p>`;
    }
  },

  // ─── CHAT LOGIC ────────────────────────────────────────────────

  async handleSendMessage() {
    const text = Utils.sanitizeInput(this.elements.chatInput.value);
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
        Speech.speak(response);
      }
    } catch (e) {
      console.error('AI call error:', e);
      this.addMessage(`Error: ${Utils.escapeHtml(e.message)}`, 'aura', true);
    } finally {
      this.state.isThinking = false;
      this.elements.thinkingBar.classList.add('hidden');
      this.updateSendButtonState();
      this.updateStats();
    }
  },

  async callAI(userMessage) {
    const userProfileName = StorageManager.get('user_name', 'User');
    const userProfileAbout = StorageManager.get('user_about', '');
    const auraPersonaTone = StorageManager.get('persona_tone', 'Professional and precise');

    let systemPrompt = `You are Aura, an intelligent AI assistant. You are helpful, harmless, and honest.\n\n`;
    systemPrompt += `User Profile:\n- Name: ${userProfileName}\n`;
    if (userProfileAbout) systemPrompt += `- About: ${userProfileAbout}\n`;
    systemPrompt += `\nPersona & Tone:\n${auraPersonaTone}\n\n`;
    systemPrompt += `${EnvironmentContext.getContextString()}\n\n`;
    systemPrompt += `Current Weather:\n${await this.getWeatherContext()}\n\n`;
    systemPrompt += `Respond concisely and naturally. Avoid unnecessary pleasantries.`;

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

    if (!city || !apiKey) return 'Weather not configured.';

    try {
      const weather = await WeatherAPI.fetchWeather(city, apiKey, units);
      const unitName = units === 'metric' ? 'Celsius' : 'Fahrenheit';
      return `${weather.city}: ${weather.temp}°${units === 'metric' ? 'C' : 'F'}, ${weather.description}, Humidity: ${weather.humidity}%`;
    } catch (e) {
      return `Weather unavailable: ${e.message}`;
    }
  },

  addMessage(text, role, isError = false) {
    this.elements.welcomeState.classList.add('hidden');

    const msgDiv = document.createElement('div');
    msgDiv.className = `message message-${role} ${isError ? 'msg-error' : ''}`;
    msgDiv.innerHTML = `<div class="msg-bubble">${Utils.escapeHtml(text)}</div>`;
    this.elements.messagesContainer.appendChild(msgDiv);
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;

    this.state.messageCount++;
  },

  handleVoiceInput(transcript) {
    this.elements.chatInput.value = transcript;
    this.handleSendMessage();
  },

  handleVoiceError(error) {
    if (error === 'not-allowed') {
      Toast.error('Microphone access denied. Please enable it in your browser settings.');
    } else if (error === 'no-speech') {
      Toast.warning('No speech detected. Please try again.');
    } else {
      Toast.error(`Voice input error: ${error}`);
    }
  },

  // ─── SETTINGS ──────────────────────────────────────────────────

  async loadSettings() {
    // User profile
    this.elements.sUserName.value = StorageManager.get('user_name', '');
    this.elements.sAbout.value = StorageManager.get('user_about', '');
    this.elements.sTone.value = StorageManager.get('persona_tone', 'Professional and precise');

    // Gemini
    this.elements.sGeminiKey.value = StorageManager.get('gemini_key', '');
    this.elements.sGeminiModel.value = StorageManager.get('gemini_model', 'gemini-2.0-flash');

    // Ollama
    this.elements.sOllamaUrl.value = StorageManager.get('ollama_url', 'http://localhost:11434');
    this.elements.sOllamaModel.value = StorageManager.get('ollama_model', '');
    await this.fetchOllamaModels();

    // Weather
    this.elements.sWeatherKey.value = StorageManager.get('weather_key', '');
    this.elements.sWeatherCity.value = StorageManager.get('weather_city', '');
    this.elements.sWeatherUnit.value = StorageManager.get('weather_unit', 'metric');

    // Appearance
    const isDark = StorageManager.get('dark_mode', false);
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      this.elements.toggleDarkModeBtn.classList.add('active');
      this.elements.toggleDarkModeBtn.setAttribute('aria-checked', 'true');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      this.elements.toggleDarkModeBtn.classList.remove('active');
      this.elements.toggleDarkModeBtn.setAttribute('aria-checked', 'false');
    }

    // Update persona display
    this.elements.personaName.textContent = StorageManager.get('user_name', 'You');
    this.elements.personaTone.textContent = StorageManager.get('persona_tone', 'Professional & Precise');

    // Set current engine from storage or default
    this.state.currentEngine = StorageManager.get('current_engine', 'gemini');
    this.elements.engineBtns.forEach(btn => btn.classList.remove('active'));
    const activeEngineBtn = document.querySelector(`[data-engine="${this.state.currentEngine}"]`);
    if (activeEngineBtn) activeEngineBtn.classList.add('active');
    this.elements.engineBadge.textContent = this.state.currentEngine.charAt(0).toUpperCase() + this.state.currentEngine.slice(1);
  },

  async fetchOllamaModels() {
    const endpoint = this.elements.sOllamaUrl.value;
    this.elements.ollamaModelSelect.innerHTML = '<option value="">Loading models...</option>';
    this.elements.ollamaModelSelect.disabled = true;

    try {
      const models = await OllamaAPI.fetchModels(endpoint);
      this.state.ollamaModels = models;
      this.elements.ollamaModelSelect.innerHTML = '';
      if (models.length === 0) {
        this.elements.ollamaModelSelect.innerHTML = '<option value="">No models found</option>';
      } else {
        models.forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model;
          this.elements.ollamaModelSelect.appendChild(option);
        });
      }
      const storedOllamaModel = StorageManager.get('ollama_model');
      if (storedOllamaModel && models.includes(storedOllamaModel)) {
        this.elements.ollamaModelSelect.value = storedOllamaModel;
      } else if (models.length > 0) {
        this.elements.ollamaModelSelect.value = models[0];
        StorageManager.set('ollama_model', models[0]);
      }
      Toast.success('Ollama models loaded.');
    } catch (e) {
      console.error('Failed to fetch Ollama models:', e);
      this.elements.ollamaModelSelect.innerHTML = '<option value="">Error loading models</option>';
      Toast.error(`Failed to load Ollama models: ${e.message}`);
    } finally {
      this.elements.ollamaModelSelect.disabled = false;
    }
  },

  saveSettings() {
    try {
      // User profile
      StorageManager.set('user_name', this.elements.sUserName.value);
      StorageManager.set('user_about', this.elements.sAbout.value);
      StorageManager.set('persona_tone', this.elements.sTone.value);

      // Gemini
      StorageManager.set('gemini_key', this.elements.sGeminiKey.value);
      StorageManager.set('gemini_model', this.elements.sGeminiModel.value);

      // Ollama
      StorageManager.set('ollama_url', this.elements.sOllamaUrl.value);
      StorageManager.set('ollama_model', this.elements.sOllamaModel.value);

      // Weather
      StorageManager.set('weather_key', this.elements.sWeatherKey.value);
      StorageManager.set('weather_city', this.elements.sWeatherCity.value);
      StorageManager.set('weather_unit', this.elements.sWeatherUnit.value);

      // Persist current engine choice
      StorageManager.set('current_engine', this.state.currentEngine);

      this.loadSettings();
      this.loadWeather();
      this.closeSettings();
      Toast.success('Settings saved successfully');
    } catch (e) {
      console.error('Settings save error:', e);
      Toast.error(`Failed to save settings: ${e.message}`);
    }
  },

  resetSettings() {
    if (confirm('Are you sure? This will clear all settings and require a page reload.')) {
      StorageManager.clear();
      Toast.success('Settings reset to defaults. Reloading page...');
      setTimeout(() => location.reload(), 1500);
    }
  },

  openSettings() {
    this.elements.settingsOverlay.classList.remove('hidden');
    this.loadSettings();
  },

  closeSettings() {
    this.elements.settingsOverlay.classList.add('hidden');
  },

  toggleDarkMode(e) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    e.currentTarget.classList.toggle('active');
    e.currentTarget.setAttribute('aria-checked', !isDark);
    StorageManager.set('dark_mode', !isDark);
  },

  togglePasswordVisibility(inputElement) {
    const type = inputElement.getAttribute('type') === 'password' ? 'text' : 'password';
    inputElement.setAttribute('type', type);
    const icon = inputElement.nextElementSibling.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
      lucide.createIcons();
    }
  },

  // ─── ACTIONS ───────────────────────────────────────────────────

  switchEngine(engine) {
    this.state.currentEngine = engine;
    StorageManager.set('current_engine', engine);
    this.elements.engineBtns.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-engine="${engine}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    this.elements.engineBadge.textContent = engine.charAt(0).toUpperCase() + engine.slice(1);
    Toast.info(`Switched to ${engine === 'gemini' ? 'Gemini' : 'Ollama'}`);
  },

  clearChat() {
    if (confirm('Are you sure you want to clear all messages?')) {
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

  toggleVoiceInput() {
    if (Speech.isListening) {
      Speech.stopListening();
    } else {
      Speech.startListening();
    }
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

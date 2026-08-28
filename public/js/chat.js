class Area52Chatbot {
  constructor() {
    this.history = [];
    this.isOpen = false;
    this.init();
  }

  init() {
    this.createUI();
    this.bindEvents();
  }

  createUI() {
    const chatHTML = `
      <div id="chatbot-fab" style="
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #00c896, #00a876);
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(0,200,150,0.4);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.8rem;
        transition: transform 0.3s, box-shadow 0.3s;
      " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
        💬
      </div>

      <div id="chatbot-window" style="
        display: none;
        position: fixed;
        bottom: 100px;
        right: 24px;
        width: 380px;
        max-width: calc(100vw - 48px);
        height: 520px;
        max-height: calc(100vh - 140px);
        background: white;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 10000;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid #e0e0e0;
      ">
        <div id="chatbot-header" style="
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          color: white;
          padding: 1rem 1.2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-size: 1.4rem;">👽</span>
            <div>
              <div style="font-weight: bold; font-size: 0.95rem;">Asistente Área 52</div>
              <div style="font-size: 0.75rem; opacity: 0.8;">En línea</div>
            </div>
          </div>
          <button id="chatbot-close" style="
            background: none;
            border: none;
            color: white;
            font-size: 1.3rem;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
            transition: background 0.2s;
          " onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='none'">✕</button>
        </div>

        <div id="chatbot-messages" style="
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          background: #f8f9fa;
        ">
          <div class="chat-msg bot" style="
            align-self: flex-start;
            max-width: 85%;
            padding: 0.8rem 1rem;
            border-radius: 12px 12px 12px 4px;
            background: white;
            border: 1px solid #e8e8e8;
            font-size: 0.9rem;
            line-height: 1.5;
            box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          ">
            ¡Hola! Soy el asistente de Área 52 UNI 👋<br><br>
            Pregúntame sobre:<br>
            • Temas de matemáticas, física o química<br>
            • Consejos para el examen de ingreso<br>
            • Información de nuestros cursos
          </div>
        </div>

        <div id="chatbot-typing" style="
          display: none;
          padding: 0.6rem 1rem;
          font-size: 0.8rem;
          color: #888;
          background: #f8f9fa;
          border-top: 1px solid #eee;
        ">
          <span class="typing-dots">Escribiendo<span style="animation: blink 1s infinite">...</span></span>
        </div>

        <div style="
          padding: 0.8rem;
          border-top: 1px solid #eee;
          display: flex;
          gap: 0.5rem;
          background: white;
        ">
          <input id="chatbot-input" type="text" placeholder="Escribe tu pregunta..." style="
            flex: 1;
            padding: 0.7rem 1rem;
            border: 2px solid #e0e0e0;
            border-radius: 25px;
            font-size: 0.9rem;
            outline: none;
            transition: border-color 0.3s;
          ">
          <button id="chatbot-send" style="
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: #00c896;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.3s;
            flex-shrink: 0;
          ">➤</button>
        </div>
      </div>

      <style>
        @keyframes blink { 50% { opacity: 0.3; } }
        #chatbot-input:focus { border-color: #00c896 !important; }
        #chatbot-send:hover { background: #00a876 !important; }
        #chatbot-messages::-webkit-scrollbar { width: 6px; }
        #chatbot-messages::-webkit-scrollbar-track { background: transparent; }
        #chatbot-messages::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
        .chat-msg.user {
          align-self: flex-end;
          max-width: 85%;
          padding: 0.8rem 1rem;
          border-radius: 12px 12px 4px 12px;
          background: #00c896;
          color: white;
          font-size: 0.9rem;
          line-height: 1.5;
        }
        @media (max-width: 480px) {
          #chatbot-window {
            right: 8px !important;
            bottom: 80px !important;
            width: calc(100vw - 16px) !important;
            height: calc(100vh - 120px) !important;
          }
        }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', chatHTML);
  }

  bindEvents() {
    document.getElementById('chatbot-fab').addEventListener('click', () => this.toggle());
    document.getElementById('chatbot-close').addEventListener('click', () => this.toggle());
    document.getElementById('chatbot-send').addEventListener('click', () => this.sendMessage());
    document.getElementById('chatbot-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    const win = document.getElementById('chatbot-window');
    const fab = document.getElementById('chatbot-fab');
    win.style.display = this.isOpen ? 'flex' : 'none';
    fab.textContent = this.isOpen ? '✕' : '💬';
    if (this.isOpen) {
      document.getElementById('chatbot-input').focus();
    }
  }

  addMessage(text, isUser = false) {
    const container = document.getElementById('chatbot-messages');
    const msg = document.createElement('div');
    msg.className = `chat-msg ${isUser ? 'user' : 'bot'}`;
    msg.style.cssText = isUser
      ? 'align-self: flex-end; max-width: 85%; padding: 0.8rem 1rem; border-radius: 12px 12px 4px 12px; background: #00c896; color: white; font-size: 0.9rem; line-height: 1.5;'
      : 'align-self: flex-start; max-width: 85%; padding: 0.8rem 1rem; border-radius: 12px 12px 12px 4px; background: white; border: 1px solid #e8e8e8; font-size: 0.9rem; line-height: 1.5; box-shadow: 0 1px 4px rgba(0,0,0,0.06);';
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  showTyping(show) {
    document.getElementById('chatbot-typing').style.display = show ? 'block' : 'none';
    const container = document.getElementById('chatbot-messages');
    container.scrollTop = container.scrollHeight;
  }

  async sendMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    this.addMessage(message, true);
    this.history.push({ role: 'user', content: message });

    this.showTyping(true);
    document.getElementById('chatbot-send').disabled = true;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: this.history.slice(-10)
        })
      });

      const data = await res.json();

      if (res.ok && data.reply) {
        this.addMessage(data.reply, false);
        this.history.push({ role: 'assistant', content: data.reply });
      } else {
        this.addMessage('Lo siento, hubo un error. Intenta de nuevo.', false);
      }
    } catch (err) {
      this.addMessage('No pude conectar con el servidor. Verifica tu conexión.', false);
    } finally {
      this.showTyping(false);
      document.getElementById('chatbot-send').disabled = false;
      document.getElementById('chatbot-input').focus();
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Area52Chatbot());
} else {
  new Area52Chatbot();
}

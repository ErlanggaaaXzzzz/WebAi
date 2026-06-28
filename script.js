let currentChatId = null;
let abortController = null;
let currentUser = null;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const messagesWrapper = document.getElementById('messagesWrapper');
const chatInput = document.getElementById('chatInput');
const btnSend = document.getElementById('btnSend');
const btnStop = document.getElementById('btnStop');
const btnNewChat = document.getElementById('btnNewChat');
const btnClearChat = document.getElementById('btnClearChat');
const btnLogout = document.getElementById('btnLogout');
const historyContainer = document.getElementById('historyContainer');
const usernameDisplay = document.getElementById('usernameDisplay');
const toastNotification = document.getElementById('toastNotification');

// Token Handling
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login.html';
}

// Global Headers Helper
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Global Error Toast System
function showError(message) {
  toastNotification.textContent = message;
  toastNotification.classList.add('show');
  setTimeout(() => { toastNotification.classList.remove('show'); }, 4000);
}

// Verify auth on start
async function initSession() {
  try {
    const res = await fetch('/api/me', { headers: getHeaders() });
    if (!res.ok) throw new Error('Unauthorized Session');
    const data = await res.json();
    currentUser = data.user;
    usernameDisplay.textContent = currentUser.username;
    await loadChatHistory();
    startNewChatSession();
  } catch (err) {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  }
}

// Responsive Sidebar Controls
menuToggle.addEventListener('click', () => {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('show');
});
sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
});

// Auto adjust textarea height
chatInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight - 6) + 'px';
  btnSend.disabled = !this.value.trim();
});

// Textarea Keyboard Shortcuts handler
chatInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (this.value.trim() && !btnSend.disabled) {
      sendMessage();
    }
  }
});

// Load Chat Logs Sidebar
async function loadChatHistory() {
  try {
    const res = await fetch('/api/history', { headers: getHeaders() });
    if (!res.ok) throw new Error();
    const chats = await res.json();
    historyContainer.innerHTML = '';
    
    chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).forEach(chat => {
      const item = document.createElement('div');
      item.className = `history-item ${chat.createdAt === currentChatId ? 'active' : ''}`;
      item.dataset.id = chat.createdAt;
      
      const title = document.createElement('span');
      title.className = 'history-title';
      title.textContent = chat.title || 'Percakapan Baru';
      title.addEventListener('click', () => switchChatSession(chat.createdAt, chat.messages));

      const actions = document.createElement('div');
      actions.className = 'history-actions';

      const btnRename = document.createElement('button');
      btnRename.className = 'action-btn';
      btnRename.innerHTML = '✏️';
      btnRename.addEventListener('click', (e) => { e.stopPropagation(); renameChatSession(chat.createdAt); });

      const btnDel = document.createElement('button');
      btnDel.className = 'action-btn';
      btnDel.innerHTML = '🗑️';
      btnDel.addEventListener('click', (e) => { e.stopPropagation(); deleteChatSession(chat.createdAt); });

      actions.appendChild(btnRename);
      actions.appendChild(btnDel);
      item.appendChild(title);
      item.appendChild(actions);
      historyContainer.appendChild(item);
    });
  } catch (err) {
    showError('Gagal memuat riwayat chat.');
  }
}

function startNewChatSession() {
  currentChatId = 'new-' + Date.now();
  messagesWrapper.innerHTML = `
    <div style="text-align: center; margin-top: 10vh; color: var(--text-muted);" id="welcomePrompt">
      <h2 style="color: #fff; margin-bottom: 12px; font-size: 1.75rem;">Halo, saya ErlanggaAi</h2>
      <p style="max-width: 500px; margin: 0 auto; font-size: 0.95rem; line-height: 1.6;">
        Sistem AI pintar yang siap membantu Anda dalam pemrograman, pembuatan essay, matematika, translasi bahasa, debugging kode, maupun pengetahuan umum secara cepat.
      </p>
    </div>
  `;
  document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
  chatInput.value = '';
  chatInput.style.height = 'auto';
  btnSend.disabled = true;
  if(window.innerWidth <= 768) {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('show');
  }
}

function switchChatSession(id, messages) {
  currentChatId = id;
  messagesWrapper.innerHTML = '';
  document.querySelectorAll('.history-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === String(id));
  });

  messages.forEach(msg => {
    appendMessage(msg.role, msg.content);
  });
  scrollToBottom();
  
  if(window.innerWidth <= 768) {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('show');
  }
}

// UI Rendering Helper for Message Bubbles
function appendMessage(role, text) {
  const welcome = document.getElementById('welcomePrompt');
  if (welcome) welcome.remove();

  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === 'user' ? 'U' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  
  if (role === 'user') {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = parseMarkdown(text);
  }

  if (role === 'user') {
    row.appendChild(bubble);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(bubble);
  }

  messagesWrapper.appendChild(row);
  return bubble;
}

// Markdown Parser Engineering (Simple, secure, robust system built native)
function parseMarkdown(text) {
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks processing matching ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  escaped = escaped.replace(codeBlockRegex, (match, lang, code) => {
    const language = lang || 'code';
    return `
      <div class="code-container">
        <div class="code-header">
          <span>${language}</span>
          <button class="copy-btn" onclick="copyCodePayload(this)">Copy code</button>
        </div>
        <pre><code>${code.trim()}</code></pre>
      </div>
    `;
  });

  // Inline code elements processor `code`
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Paragraph processing structure split
  const paragraphs = escaped.split('\n\n');
  return paragraphs.map(p => {
    if (p.trim().startsWith('<div class="code-container"')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

function copyCodePayload(button) {
  const pre = button.closest('.code-container').querySelector('pre code');
  navigator.clipboard.writeText(pre.textContent).then(() => {
    button.textContent = 'Copied!';
    setTimeout(() => { button.textContent = 'Copy code'; }, 2000);
  });
}

async function sendMessage() {
  const content = chatInput.value.trim();
  if (!content) return;

  appendMessage('user', content);
  chatInput.value = '';
  chatInput.style.height = 'auto';
  btnSend.disabled = true;
  scrollToBottom();

  // Show Skeleton/Typing loader
  const aiRow = document.createElement('div');
  aiRow.className = 'message-row ai';
  aiRow.innerHTML = `
    <div class="avatar ai">AI</div>
    <div class="bubble" id="loadingAiBubble">
      <div class="typing-dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    </div>
  `;
  messagesWrapper.appendChild(aiRow);
  scrollToBottom();

  btnSend.style.display = 'none';
  btnStop.style.display = 'flex';

  abortController = new AbortController();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: getHeaders(),
      signal: abortController.signal,
      body: JSON.stringify({
        chatId: currentChatId.startsWith('new-') ? null : currentChatId,
        message: content
      })
    });

    const loadingBubble = document.getElementById('loadingAiBubble');
    if (loadingBubble) loadingBubble.closest('.message-row').remove();

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Terjadi kesalahan sistem.');
    }

    const data = await res.json();
    
    if (currentChatId.startsWith('new-')) {
      currentChatId = data.chatId;
    }

    appendMessage('assistant', data.reply);
    await loadChatHistory();
    scrollToBottom();

  } catch (err) {
    if (err.name !== 'AbortError') {
      const loadingBubble = document.getElementById('loadingAiBubble');
      if (loadingBubble) loadingBubble.closest('.message-row').remove();
      showError(err.message || 'Gagal berkomunikasi dengan server.');
    }
  } finally {
    btnStop.style.display = 'none';
    btnSend.style.display = 'flex';
    abortController = null;
  }
}

// Stop generation abort framework
btnStop.addEventListener('click', () => {
  if (abortController) {
    abortController.abort();
    const loadingBubble = document.getElementById('loadingAiBubble');
    if (loadingBubble) {
      loadingBubble.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Pembuatan dihentikan oleh pengguna.</span>';
      loadingBubble.removeAttribute('id');
    }
    btnStop.style.display = 'none';
    btnSend.style.display = 'flex';
  }
});

async function renameChatSession(id) {
  const newTitle = prompt('Masukkan nama baru untuk percakapan ini:');
  if (!newTitle || !newTitle.trim()) return;

  try {
    const res = await fetch('/api/history', { headers: getHeaders() });
    const chats = await res.json();
    const chatIndex = chats.findIndex(c => c.createdAt === id);
    if(chatIndex !== -1) {
      chats[chatIndex].title = newTitle.trim();
      chats[chatIndex].updatedAt = new Date().toISOString();
      
      // Save simulation using rewrite endpoint
      await fetch('/api/history/update-all', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ chats })
      });
      await loadChatHistory();
    }
  } catch (err) {
    showError('Gagal mengubah nama percakapan.');
  }
}

async function deleteChatSession(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus percakapan ini?')) return;
  try {
    const res = await fetch(`/api/history?id=${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error();
    if (currentChatId === id) {
      startNewChatSession();
    }
    await loadChatHistory();
  } catch (err) {
    showError('Gagal menghapus percakapan.');
  }
}

// Button New Chat Action
btnNewChat.addEventListener('click', startNewChatSession);

// Clear Chat view visually completely
btnClearChat.addEventListener('click', () => {
  if (confirm('Bersihkan seluruh bubble pesan di layar saat ini?')) {
    messagesWrapper.innerHTML = '';
  }
});

// Logout mechanism execution
btnLogout.addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST', headers: getHeaders() });
  } catch (e) {}
  localStorage.removeItem('token');
  localStorage.removeItem('remember');
  window.location.href = '/login.html';
});

function scrollToBottom() {
  messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
}

// Run initializer context script
initSession();

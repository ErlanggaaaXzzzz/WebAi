const express = require('express');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database Path (Hanya butuh chats.json karena tidak ada data user/password lagi)
const CHATS_FILE = path.join(__dirname, 'chats.json');

// Init Database safely
if (!fs.existsSync(CHATS_FILE)) fs.writeFileSync(CHATS_FILE, JSON.stringify([]));

// Helper functions to read/write JSON files safely
function readData(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return []; }
}
function writeData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// OpenAI Client Initialization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key'
});

// Security & Optimization Middlewares
app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginOpenerPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Global Rate Limiter System
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Terlalu banyak permintaan dari IP Anda, silakan coba lagi nanti.' }
});
app.use('/api/', globalLimiter);

// ID Pengguna Tetap (Karena tidak ada login, semua chat memakai ID ini)
const GLOBAL_USER_ID = 'global_user';

// ====================================
// STATIC FILE SERVING
// ====================================
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ====================================
// CHAT AI LOGIC ENDPOINTS API
// ====================================

app.get('/api/me', (req, res) => {
  // Mengembalikan data user default untuk tampilan nama di pojok aplikasi
  res.json({ user: { id: GLOBAL_USER_ID, username: 'Erlangga User' } });
});

app.get('/api/history', (req, res) => {
  const chats = readData(CHATS_FILE);
  const userChats = chats.filter(c => c.userId === GLOBAL_USER_ID);
  res.json(userChats);
});

app.post('/api/history/update-all', (req, res) => {
  const { chats } = req.body;
  let allChats = readData(CHATS_FILE);
  
  allChats = allChats.filter(c => c.userId !== GLOBAL_USER_ID);
  chats.forEach(c => { if(c.userId === GLOBAL_USER_ID) allChats.push(c); });
  writeData(CHATS_FILE, allChats);
  res.json({ success: true });
});

app.delete('/api/history', (req, res) => {
  const { id } = req.query;
  let chats = readData(CHATS_FILE);
  chats = chats.filter(c => !(c.userId === GLOBAL_USER_ID && c.createdAt === Number(id)));
  writeData(CHATS_FILE, chats);
  res.json({ success: true });
});

app.post('/api/chat', async (req, res) => {
  const { chatId, message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Pesan kosong tidak dapat diproses.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Konfigurasi OpenAI API Key tidak ditemukan pada file server .env.' });
  }

  let chats = readData(CHATS_FILE);
  let chatSession = chats.find(c => c.userId === GLOBAL_USER_ID && c.createdAt === Number(chatId));

  let isNewChat = false;
  if (!chatSession) {
    isNewChat = true;
    chatSession = {
      userId: GLOBAL_USER_ID,
      title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
      messages: [],
      createdAt: Date.now(),
      updatedAt: new Date().toISOString()
    };
  }

  chatSession.messages.push({ role: 'user', content: message });

  try {
    const messagesPayload = chatSession.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    messagesPayload.unshift({
      role: 'system',
      content: 'Kamu adalah ErlanggaAi, sebuah sistem kecerdasan buatan premium yang profesional, cerdas, membantu pemrograman, debugging, translasi bahasa, pengerjaan essay, matematika dan general knowledge dengan output berbasis markdown.'
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', 
      messages: messagesPayload,
      temperature: 0.7
    });

    const aiReply = completion.choices[0].message.content;

    chatSession.messages.push({ role: 'assistant', content: aiReply });
    chatSession.updatedAt = new Date().toISOString();

    if (isNewChat) {
      chats.push(chatSession);
    } else {
      const idx = chats.findIndex(c => c.userId === GLOBAL_USER_ID && c.createdAt === Number(chatId));
      if (idx !== -1) chats[idx] = chatSession;
    }

    writeData(CHATS_FILE, chats);
    res.json({ chatId: chatSession.createdAt, reply: aiReply });

  } catch (error) {
    console.error('OpenAI Error Exception:', error);
    res.status(500).json({ error: 'Gagal mendapatkan response dari OpenAI Engine. Pastikan API KEY valid.' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date(), service: 'ErlanggaAi API Engine' });
});

app.use((req, res, next) => {
  res.status(404).redirect('/');
});

app.use((err, req, res, next) => {
  console.error('Fatal Catch Error:', err.stack);
  res.status(500).json({ error: 'Terjadi kesalahan sistem internal server.' });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ErlanggaAi Server is perfectly running on port ${PORT}`);
  console.log(`====================================================`);
});

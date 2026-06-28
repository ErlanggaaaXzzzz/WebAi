const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_erlangga_ai_2026';

// Database Paths
const USERS_FILE = path.join(__dirname, 'users.json');
const CHATS_FILE = path.join(__dirname, 'chats.json');

// Init Databases if empty safely
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
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
  contentSecurityPolicy: false, // Allow CDNs script execution smoothly
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

// ====================================
// BYPASS AUTHENTICATION MIDDLEWARE
// ====================================
// Menggantikan fungsi JWT check asli agar otomatis login menggunakan akun dummy permanen
function authenticateToken(req, res, next) {
  req.user = {
    id: 'user_default_erlangga',
    username: 'Erlangga User',
    email: 'user@erlangga.ai'
  };
  next();
}

// ====================================
// STATIC FILE SERVING
// ====================================
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Diarahkan langsung ke index.html karena sistem sudah tidak membutuhkan form login
app.get('/login', (req, res) => {
  res.redirect('/');
});

// ====================================
// AUTHENTICATION ENDPOINTS API (Bypassed)
// ====================================

app.post('/api/register', (req, res) => {
  res.status(201).json({ success: true, message: 'User berhasil dibuat (Bypassed).' });
});

app.post('/api/login', (req, res) => {
  // Mengembalikan token dummy agar frontend yang masih membaca localStorage token tidak error
  res.json({ token: 'dummy_bypass_token_erlangga_ai_2026' });
});

app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

// ====================================
// CHAT AI LOGIC ENDPOINTS API
// ====================================

app.get('/api/history', authenticateToken, (req, res) => {
  const chats = readData(CHATS_FILE);
  const userChats = chats.filter(c => c.userId === req.user.id);
  res.json(userChats);
});

// Support system update-all titles for script.js action execution simulation
app.post('/api/history/update-all', authenticateToken, (req, res) => {
  const { chats } = req.body;
  let allChats = readData(CHATS_FILE);
  // Remove current users' data and replace with modified entries payload safely
  allChats = allChats.filter(c => c.userId !== req.user.id);
  chats.forEach(c => { if(c.userId === req.user.id) allChats.push(c); });
  writeData(CHATS_FILE, allChats);
  res.json({ success: true });
});

app.delete('/api/history', authenticateToken, (req, res) => {
  const { id } = req.query;
  let chats = readData(CHATS_FILE);
  chats = chats.filter(c => !(c.userId === req.user.id && c.createdAt === Number(id)));
  writeData(CHATS_FILE, chats);
  res.json({ success: true });
});

app.post('/api/chat', authenticateToken, async (req, res) => {
  const { chatId, message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Pesan kosong tidak dapat diproses.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Konfigurasi OpenAI API Key tidak ditemukan pada file server .env.' });
  }

  let chats = readData(CHATS_FILE);
  let chatSession = chats.find(c => c.userId === req.user.id && c.createdAt === Number(chatId));

  let isNewChat = false;
  if (!chatSession) {
    isNewChat = true;
    chatSession = {
      userId: req.user.id,
      title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
      messages: [],
      createdAt: Date.now(),
      updatedAt: new Date().toISOString()
    };
  }

  // Push user message log payload
  chatSession.messages.push({ role: 'user', content: message });

  try {
    // Transform history context system into exact legal OpenAI messages input matching roles
    const messagesPayload = chatSession.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Inject system directive prompt
    messagesPayload.unshift({
      role: 'system',
      content: 'Kamu adalah ErlanggaAi, sebuah sistem kecerdasan buatan premium yang profesional, cerdas, membantu pemrograman, debugging, translasi bahasa, pengerjaan essay, matematika dan general knowledge dengan output berbasis markdown.'
    });

    // Call modern modern OpenAi standard API Responses endpoints
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Model GPT terbaru & aman dari deprecation endpoints lama
      messages: messagesPayload,
      temperature: 0.7
    });

    const aiReply = completion.choices[0].message.content;

    // Push response data target matching structural system standard
    chatSession.messages.push({ role: 'assistant', content: aiReply });
    chatSession.updatedAt = new Date().toISOString();

    if (isNewChat) {
      chats.push(chatSession);
    } else {
      const idx = chats.findIndex(c => c.userId === req.user.id && c.createdAt === Number(chatId));
      if (idx !== -1) chats[idx] = chatSession;
    }

    writeData(CHATS_FILE, chats);
    res.json({ chatId: chatSession.createdAt, reply: aiReply });

  } catch (error) {
    console.error('OpenAI Error Exception:', error);
    res.status(500).json({ error: 'Gagal mendapatkan response dari OpenAI Engine. Pastikan API KEY valid.' });
  }
});

// ====================================
// HEALTH CHECK, 404 & GLOBAL ERROR HANDLERS
// ====================================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date(), service: 'ErlanggaAi API Engine' });
});

app.use((req, res, next) => {
  // Jika 404, arahkan langsung ke halaman utama chat karena login sudah tidak dipakai
  res.status(404).redirect('/');
});

app.use((err, req, res, next) => {
  console.error('Fatal Catch Error:', err.stack);
  res.status(500).json({ error: 'Terjadi kesalahan sistem internal server.' });
});

// Execute Cluster Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ErlanggaAi Server is perfectly running on port ${PORT}`);
  console.log(`====================================================`);
});

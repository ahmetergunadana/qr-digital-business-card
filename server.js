const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';

app.set('trust proxy', 1); // Trust first proxy (required for Glitch/render)

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60,
    message: { error: 'Çok fazla istek yapıldı, lütfen bir dakika bekleyin.' }
});
app.use('/api/', limiter);

// Data Directory and Files Setup
const dataDir = path.join(__dirname, 'data');
const kartlarFile = path.join(dataDir, 'kartlar.txt');
const analitikFile = path.join(dataDir, 'analitik.txt');
const kullanicilarFile = path.join(dataDir, 'kullanicilar.txt');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(kartlarFile)) fs.writeFileSync(kartlarFile, '');
if (!fs.existsSync(analitikFile)) fs.writeFileSync(analitikFile, '');
if (!fs.existsSync(kullanicilarFile)) fs.writeFileSync(kullanicilarFile, '');

// Memory store for sessions (Tokens)
const sessions = {}; // token: userId

// Helper Functions for Data Access
const readLinesJSON = (file) => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        if (!content.trim()) return [];
        return content.split('\n---\n')
            .filter(str => str.trim())
            .map(str => {
                try { return JSON.parse(str); } catch (e) { return null; }
            })
            .filter(i => i !== null);
    } catch (e) {
        console.error(`Error reading ${file}:`, e);
        return [];
    }
};

const writeLineJSON = (file, data) => {
    const dataStr = JSON.stringify(data) + '\n---\n';
    fs.appendFileSync(file, dataStr);
};

const updateFileJSON = (file, list) => {
    const dataStr = list.map(k => JSON.stringify(k)).join('\n---\n') + (list.length > 0 ? '\n---\n' : '');
    fs.writeFileSync(file, dataStr);
};

// Analytics Helper (Newline separated, not --- separated)
const logAnalytics = (type, kartId, kartSahibi, ip) => {
    const event = { tip: type, kartId, kartSahibi, zaman: new Date().toISOString(), ip };
    fs.appendFileSync(analitikFile, JSON.stringify(event) + '\n');
};
const readAnalytics = () => {
    try {
        const content = fs.readFileSync(analitikFile, 'utf8');
        if (!content.trim()) return [];
        return content.split('\n').filter(s => s.trim()).map(s => JSON.parse(s));
    } catch (e) {
        return [];
    }
};

const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// Middleware
const userAuth = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1] || req.headers['x-auth-token'];
    if (token && sessions[token]) {
        req.userId = sessions[token];
        next();
    } else {
        res.status(401).json({ error: 'Yetkisiz erişim' });
    }
};

const adminAuth = (req, res, next) => {
        const user = req.headers['x-admin-user'];
    const pass = req.headers['x-admin-pass'];
                if (user === ADMIN_USER && pass === ADMIN_PASS) {

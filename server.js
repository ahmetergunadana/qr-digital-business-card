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
    const pass = req.headers['x-admin-pass'];
    if (pass === ADMIN_PASS) {
        next();
    } else {
        res.status(401).json({ error: 'Yetkisiz erişim' });
    }
};

// --- AUTH API ---
app.post('/api/auth/kayit', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunlu' });

    const kullanicilar = readLinesJSON(kullanicilarFile);
    if (kullanicilar.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış' });
    }

    const newUser = {
        id: uuidv4(),
        username,
        passwordHash: hashPassword(password),
        olusturulma: new Date().toISOString()
    };

    writeLineJSON(kullanicilarFile, newUser);
    res.status(201).json({ success: true, message: 'Kayıt başarılı' });
});

app.post('/api/auth/giris', (req, res) => {
    const { username, password } = req.body;
    const kullanicilar = readLinesJSON(kullanicilarFile);
    
    const user = kullanicilar.find(u => u.username === username && u.passwordHash === hashPassword(password));
    
    if (user) {
        const token = uuidv4();
        sessions[token] = user.id;
        res.json({ token, username: user.username });
    } else {
        res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre' });
    }
});

// --- USER & CARD API ---
app.post('/api/kart', userAuth, async (req, res) => {
    try {
        const { ad, soyad, unvan, sirket, tel, email, web, sehir, linkedin, instagram, twitter, whatsapp, bio, renk, ozelAlanlar } = req.body;
        
        if (!ad || !soyad) {
            return res.status(400).json({ error: 'Ad ve soyad zorunludur' });
        }

        const id = uuidv4();
        const kart = {
            id, userId: req.userId, ad, soyad, unvan, sirket, tel, email, web, sehir,
            linkedin, instagram, twitter, whatsapp, bio, renk: renk || '#4F46E5',
            ozelAlanlar: ozelAlanlar || [], // [{label: "...", value: "..."}]
            olusturulma: new Date().toISOString(),
            aktif: true
        };

        writeLineJSON(kartlarFile, kart);

        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const cardUrl = `${protocol}://${req.headers.host || 'localhost:3000'}/kart.html?id=${id}`;
        const qrCodeDataUrl = await qrcode.toDataURL(cardUrl, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } });

        res.status(201).json({ kart, qrCode: qrCodeDataUrl, url: cardUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.get('/api/benim-kartlarim', userAuth, (req, res) => {
    const kartlar = readLinesJSON(kartlarFile);
    const userCards = kartlar.filter(k => k.userId === req.userId);
    res.json(userCards);
});

// Get Public Card
app.get('/api/kart/:id', (req, res) => {
    const { id } = req.params;
    const kartlar = readLinesJSON(kartlarFile);
    const kart = kartlar.find(k => k.id === id);

    if (!kart) return res.status(404).json({ error: 'Kart bulunamadı' });
    if (!kart.aktif) return res.status(403).json({ error: 'Bu kart devre dışı bırakılmış' });

    logAnalytics('tarama', kart.id, `${kart.ad} ${kart.soyad}`, req.ip);

    // Don't send userId to public
    const publicKart = { ...kart };
    delete publicKart.userId;

    res.json(publicKart);
});

// Generate vCard
app.get('/api/kart/:id/vcard', (req, res) => {
    const { id } = req.params;
    const kartlar = readLinesJSON(kartlarFile);
    const kart = kartlar.find(k => k.id === id);

    if (!kart || !kart.aktif) return res.status(404).send('Kart bulunamadı veya aktif değil');

    let vcard = `BEGIN:VCARD
VERSION:3.0
N:${kart.soyad || ''};${kart.ad || ''};;;
FN:${kart.ad || ''} ${kart.soyad || ''}
ORG:${kart.sirket || ''}
TITLE:${kart.unvan || ''}
TEL;TYPE=WORK,VOICE:${kart.tel || ''}
EMAIL;TYPE=PREF,INTERNET:${kart.email || ''}
URL:${kart.web || ''}
NOTE:${kart.bio ? kart.bio.replace(/\n/g, '\\n') : ''}
ADR;TYPE=WORK:;;;${kart.sehir || ''};;;
`;

    if (kart.ozelAlanlar && kart.ozelAlanlar.length > 0) {
        kart.ozelAlanlar.forEach(alan => {
            vcard += `X-CUSTOM;TYPE=${alan.label.replace(/[^a-zA-Z0-9]/g, '')}:${alan.value}\n`;
        });
    }

    vcard += `END:VCARD`;

    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${kart.ad}_${kart.soyad}.vcf"`);
    res.send(vcard);
});

// --- ADMIN API ---
app.get('/api/admin/kartlar', adminAuth, (req, res) => {
    const kartlar = readLinesJSON(kartlarFile);
    const kullanicilar = readLinesJSON(kullanicilarFile);
    
    // Attach username to cards for admin view
    const enrichedKartlar = kartlar.map(k => {
        const user = kullanicilar.find(u => u.id === k.userId);
        return { ...k, username: user ? user.username : 'Anonim/Silinmiş' };
    });
    
    res.json(enrichedKartlar);
});

app.get('/api/admin/kullanicilar', adminAuth, (req, res) => {
    const kullanicilar = readLinesJSON(kullanicilarFile);
    const kartlar = readLinesJSON(kartlarFile);
    
    const usersList = kullanicilar.map(u => {
        return {
            id: u.id,
            username: u.username,
            olusturulma: u.olusturulma,
            kartSayisi: kartlar.filter(k => k.userId === u.id).length
        };
    });
    
    res.json(usersList);
});

app.put('/api/admin/kart/:id', adminAuth, (req, res) => {
    const { id } = req.params;
    let kartlar = readLinesJSON(kartlarFile);
    const index = kartlar.findIndex(k => k.id === id);
    if (index === -1) return res.status(404).json({ error: 'Kart bulunamadı' });

    kartlar[index] = { ...kartlar[index], ...req.body, id, userId: kartlar[index].userId };
    updateFileJSON(kartlarFile, kartlar);
    res.json(kartlar[index]);
});

app.delete('/api/admin/kart/:id', adminAuth, (req, res) => {
    const { id } = req.params;
    let kartlar = readLinesJSON(kartlarFile);
    const initialLength = kartlar.length;
    kartlar = kartlar.filter(k => k.id !== id);

    if (kartlar.length === initialLength) return res.status(404).json({ error: 'Kart bulunamadı' });
    updateFileJSON(kartlarFile, kartlar);
    res.json({ success: true });
});

app.delete('/api/admin/kullanici/:id', adminAuth, (req, res) => {
    const { id } = req.params;
    let kullanicilar = readLinesJSON(kullanicilarFile);
    let kartlar = readLinesJSON(kartlarFile);

    kullanicilar = kullanicilar.filter(u => u.id !== id);
    // Kartlarını pasif yap veya sil, şimdilik silelim
    kartlar = kartlar.filter(k => k.userId !== id);
    
    updateFileJSON(kullanicilarFile, kullanicilar);
    updateFileJSON(kartlarFile, kartlar);
    res.json({ success: true });
});

app.patch('/api/admin/kart/:id/durum', adminAuth, (req, res) => {
    const { id } = req.params;
    let kartlar = readLinesJSON(kartlarFile);
    const index = kartlar.findIndex(k => k.id === id);
    if (index === -1) return res.status(404).json({ error: 'Kart bulunamadı' });

    kartlar[index].aktif = !kartlar[index].aktif;
    updateFileJSON(kartlarFile, kartlar);
    res.json({ aktif: kartlar[index].aktif });
});

app.get('/api/admin/analitik', adminAuth, (req, res) => {
    const events = readAnalytics();
    const kartlar = readLinesJSON(kartlarFile);
    const kullanicilar = readLinesJSON(kullanicilarFile);

    const totalCards = kartlar.length;
    const activeCards = kartlar.filter(k => k.aktif).length;
    const totalScans = events.filter(e => e.tip === 'tarama').length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayScans = events.filter(e => e.tip === 'tarama' && e.zaman.startsWith(todayStr)).length;

    const last7Days = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        last7Days[d.toISOString().split('T')[0]] = 0;
    }

    events.filter(e => e.tip === 'tarama').forEach(e => {
        const dateStr = e.zaman.split('T')[0];
        if (last7Days[dateStr] !== undefined) last7Days[dateStr]++;
    });

    const scanCounts = {};
    events.filter(e => e.tip === 'tarama').forEach(e => {
        scanCounts[e.kartId] = (scanCounts[e.kartId] || 0) + 1;
    });

    const topCards = Object.entries(scanCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => {
            const kart = kartlar.find(k => k.id === id);
            return { id, isim: kart ? `${kart.ad} ${kart.soyad}` : 'Silinmiş Kart', count };
        });

    res.json({ totalCards, activeCards, totalUsers: kullanicilar.length, totalScans, todayScans, last7Days, topCards });
});

app.get('/api/admin/analitik/ham', adminAuth, (req, res) => {
    const events = readAnalytics();
    res.json(events.reverse().slice(0, 100));
});

app.get('/kart/:id', (req, res) => {
    res.redirect(`/kart.html?id=${req.params.id}`);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

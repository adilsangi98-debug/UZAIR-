const express = require('express');
const router = express.Router();
const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');

router.get('/', async (req, res) => {
  const sessionDir = `./sessions/qr_${Date.now()}`;
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['Chrome', 'Windows', '10.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { qr } = update;
      if (qr) {
        const qrImage = await QRCode.toDataURL(qr);
        res.json({ qr: qrImage });
      }
    });

    // Timeout
    setTimeout(() => {
      try { sock.end(); } catch(e) {}
      if (!res.headersSent) res.json({ error: 'QR timeout' });
    }, 30000);

  } catch (err) {
    res.json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const zlib = require('zlib');

router.get('/', async (req, res) => {
  const number = req.query.number;
  if (!number) return res.json({ error: 'Number required' });

  const clean = number.replace(/[^0-9]/g, '');
  if (clean.length < 10) return res.json({ error: 'Invalid number' });

  const sessionDir = `./sessions/${clean}`;
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

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(clean);
      const formattedCode = code.match(/.{1,4}/g).join('-');

      // Wait for session
      await new Promise(resolve => setTimeout(resolve, 5000));

      let sessionStr = '';
      const credsPath = `${sessionDir}/creds.json`;
      if (fs.existsSync(credsPath)) {
        const creds = fs.readFileSync(credsPath);
        const compressed = zlib.gzipSync(creds);
        sessionStr = 'UZAIR-MD~' + compressed.toString('base64');
      }

      return res.json({ code: formattedCode, session: sessionStr });
    }

    res.json({ error: 'Already registered' });
  } catch (err) {
    res.json({ error: err.message });
  }
});

module.exports = router;

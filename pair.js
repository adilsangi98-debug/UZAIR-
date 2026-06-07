const express = require('express');
const router = express.Router();
const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

router.get('/', async (req, res) => {
  const number = req.query.number;
  if (!number) return res.json({ error: 'Number required' });

  const clean = number.replace(/[^0-9]/g, '');
  if (clean.length < 10) return res.json({ error: 'Invalid number' });

  const sessionDir = path.join('/tmp', `session_${clean}`);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  let sock;
  let responded = false;

  const respond = (data) => {
    if (!responded) {
      responded = true;
      try { sock?.end(); } catch(e) {}
      res.json(data);
    }
  };

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        // Connected — get session
        await new Promise(r => setTimeout(r, 2000));
        const credsPath = path.join(sessionDir, 'creds.json');
        let sessionStr = '';
        if (fs.existsSync(credsPath)) {
          const creds = fs.readFileSync(credsPath);
          const compressed = zlib.gzipSync(creds);
          sessionStr = 'UZAIR-MD~' + compressed.toString('base64');
        }
        respond({ session: sessionStr, message: 'Connected!' });
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (!shouldReconnect && !responded) {
          respond({ error: 'Connection closed — retry karo' });
        }
      }
    });

    // Request pair code
    if (!sock.authState.creds.registered) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const code = await sock.requestPairingCode(clean);
        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
        res.json({ code: formattedCode });
        responded = true;
      } catch(err) {
        respond({ error: err.message });
      }
    }

    // Timeout 60s
    setTimeout(() => {
      respond({ error: 'Timeout — dobara try karo' });
    }, 60000);

  } catch (err) {
    respond({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const app = express();
const path = require('path');
const pairRouter = require('./pair');
const qrRouter = require('./qr');

app.use(express.static(path.join(__dirname)));
app.use('/pair', pairRouter);
app.use('/qr', qrRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pair.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`UZAIR MD BOT Pair Site running on port ${PORT}`);
});

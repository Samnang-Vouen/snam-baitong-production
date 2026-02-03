const crypto = require('crypto');
const QRCode = require('qrcode');

function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

async function generateQrDataUrl(text) {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', scale: 6, margin: 1 });
}

module.exports = { generateToken, generateQrDataUrl };

const crypto = require('crypto');

function genOrderNo() {
  const t = new Date();
  const y = t.getFullYear().toString().slice(2);
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `TG${y}${m}${d}${rand}`;
}

function genVerifyCode() {
  return 'VC' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

module.exports = { genOrderNo, genVerifyCode };

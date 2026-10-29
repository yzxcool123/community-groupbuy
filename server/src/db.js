const fs = require('fs');
const path = require('path');
const config = require('./config');

const EMPTY = {
  users: [],
  roles: [
    { code: 'buyer', name: '买家' },
    { code: 'staff', name: '团长/店长' },
    { code: 'admin', name: '超级管理员' },
  ],
  userRoles: [],
  pickupPoints: [],
  categories: [],
  products: [],
  productSkus: [],
  activities: [],
  orders: [],
  orderItems: [],
  verifyCodes: [],
  banners: [],
  seq: 1,
};

let cache = null;

function ensureDir() {
  const dir = path.dirname(config.dataFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  if (cache) return cache;
  ensureDir();
  if (fs.existsSync(config.dataFile)) {
    try {
      cache = { ...EMPTY, ...JSON.parse(fs.readFileSync(config.dataFile, 'utf8')) };
    } catch {
      cache = structuredClone(EMPTY);
    }
  } else {
    cache = structuredClone(EMPTY);
    save();
  }
  return cache;
}

function save() {
  ensureDir();
  fs.writeFileSync(config.dataFile, JSON.stringify(cache, null, 2), 'utf8');
}

function nextId(prefix) {
  const db = load();
  const n = db.seq++;
  save();
  return `${prefix}_${n}_${Date.now().toString(36)}`;
}

module.exports = { load, save, nextId };

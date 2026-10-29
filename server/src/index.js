const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const seed = require('./seed');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const verifyRoutes = require('./routes/verify');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 启动时保证种子数据
try {
  seed();
} catch (e) {
  console.error('seed error', e);
}

// 已有库补齐常用分类（可重复执行）
try {
  const { load: loadDb, save: saveDb, nextId: nid } = require('./db');
  const db = loadDb();
  const defaults = [
    { name: '零食', icon: '🍪', sort: 5 },
    { name: '饮品', icon: '🧃', sort: 4 },
    { name: '日用百货', icon: '🧻', sort: 3 },
    { name: '水果', icon: '🍎', sort: 11 },
    { name: '蔬菜', icon: '🥬', sort: 10 },
  ];
  let changed = false;
  for (const d of defaults) {
    if (!db.categories.some((c) => c.name === d.name)) {
      db.categories.push({ id: nid('cat'), name: d.name, icon: d.icon, sort: d.sort, status: 'on' });
      changed = true;
    }
  }
  if (changed) saveDb();
} catch (e) {
  console.error('ensure categories error', e);
}

app.get('/api/health', (req, res) => {
  res.json({ code: 0, data: { ok: true, ts: Date.now() } });
});

// PC 管理后台静态托管（存在 admin 目录时启用）
// 兼容两种目录：项目内 ../admin（server 上级）与部署包内 ../admin
const adminCandidates = [
  path.join(__dirname, '..', 'admin'),
  path.join(__dirname, '..', '..', 'admin'),
];
const adminDir = adminCandidates.find((p) => fs.existsSync(p));
if (adminDir) {
  app.use('/admin', express.static(adminDir));
  console.log(`管理后台: http://127.0.0.1:${config.port}/admin/`);
}

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/admin', adminRoutes);

// 公开资源别名：/api/categories、/api/banners（与 /api/products/* 同义，便于客户端直连）
app.get('/api/categories', (req, res, next) => {
  req.url = '/categories';
  productRoutes(req, res, next);
});
app.get('/api/banners', (req, res, next) => {
  req.url = '/banners';
  productRoutes(req, res, next);
});

// 404
app.use((req, res) => {
  res.status(404).json({ code: 404, msg: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 500, msg: err.message || '服务器错误' });
});

app.listen(config.port, config.host, () => {
  console.log(`社区团购 API 已启动: http://127.0.0.1:${config.port} (host=${config.host})`);
  console.log(`健康检查: http://127.0.0.1:${config.port}/api/health`);
  console.log(`微信 AppId: ${config.wechat.appId}`);
  console.log('真机调试请用局域网 IP 访问，并在开发者工具勾选「不校验合法域名」');
});

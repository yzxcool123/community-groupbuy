const express = require('express');
const { load, save, nextId } = require('../db');
const { authRequired, requirePermission, permsOfRoles, userRolesFromDb } = require('../middleware/auth');

const router = express.Router();

// 看板
router.get('/stats', authRequired, requirePermission('stats:read'), (req, res) => {
  const db = load();
  const now = new Date().toISOString().slice(0, 10);
  const todayOrders = db.orders.filter((o) => (o.createdAt || '').startsWith(now));
  const paid = db.orders.filter((o) => ['paid', 'ready', 'verified'].includes(o.status));
  const pendingVerify = db.orders.filter((o) => o.status === 'ready' || o.status === 'paid');
  const verified = db.orders.filter((o) => o.status === 'verified');
  const gmv = paid.reduce((a, o) => a + (o.total || 0), 0);
  const productCount = db.products.filter((p) => !p.deleted && p.status === 'on').length;

  // 近 7 日 GMV
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const dayGmv = paid.filter((o) => (o.paidAt || o.createdAt || '').startsWith(key)).reduce((a, o) => a + (o.total || 0), 0);
    const dayCnt = todayOrdersFilter(db, key);
    days.push({ date: key.slice(5), gmv: Math.round(dayGmv * 100) / 100, orders: dayCnt });
  }

  // 热销 Top5
  const map = new Map();
  for (const it of db.orderItems) {
    const o = db.orders.find((x) => x.id === it.orderId);
    if (!o || o.status === 'cancelled') continue;
    const cur = map.get(it.title) || { title: it.title, qty: 0, amount: 0, cover: it.cover };
    cur.qty += it.qty;
    cur.amount += it.price * it.qty;
    map.set(it.title, cur);
  }
  const hot = [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  res.json({
    code: 0,
    data: {
      todayOrders: todayOrders.length,
      totalOrders: db.orders.length,
      gmv: Math.round(gmv * 100) / 100,
      pendingVerify: pendingVerify.length,
      verified: verified.length,
      productCount,
      userCount: db.users.length,
      days,
      hot,
    },
  });
});

function todayOrdersFilter(db, key) {
  return db.orders.filter((o) => (o.createdAt || '').startsWith(key)).length;
}

// 用户列表
router.get('/users', authRequired, requirePermission('user:admin'), (req, res) => {
  const db = load();
  const list = db.users.map((u) => ({
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    phone: u.phone,
    avatar: u.avatar,
    roles: userRolesFromDb(u.id),
    createdAt: u.createdAt,
  }));
  res.json({ code: 0, data: list });
});

// 设置用户角色
router.put('/users/:id/roles', authRequired, requirePermission('user:admin'), (req, res) => {
  const db = load();
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ code: 404, msg: '用户不存在' });
  const roles = Array.isArray(req.body.roles) ? req.body.roles.filter((r) => ['buyer', 'staff', 'admin'].includes(r)) : ['buyer'];
  if (!roles.length) roles.push('buyer');
  db.userRoles = db.userRoles.filter((x) => x.userId !== u.id);
  for (const r of roles) db.userRoles.push({ userId: u.id, role: r });
  save();
  res.json({ code: 0, data: { id: u.id, roles, permissions: permsOfRoles(roles) } });
});

// 自提点 CRUD
router.get('/pickup-points', authRequired, requirePermission('pickup:admin'), (req, res) => {
  const db = load();
  res.json({ code: 0, data: db.pickupPoints });
});

router.post('/pickup-points', authRequired, requirePermission('pickup:admin'), (req, res) => {
  const db = load();
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ code: 400, msg: '名称必填' });
  const p = {
    id: nextId('pp'),
    name: b.name,
    address: b.address || '',
    phone: b.phone || '',
    openTime: b.openTime || '09:00-21:00',
    staffIds: b.staffIds || [],
    status: b.status || 'on',
    createdAt: new Date().toISOString(),
  };
  db.pickupPoints.push(p);
  save();
  res.json({ code: 0, data: p });
});

router.put('/pickup-points/:id', authRequired, requirePermission('pickup:admin'), (req, res) => {
  const db = load();
  const p = db.pickupPoints.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ code: 404, msg: '自提点不存在' });
  Object.assign(p, req.body || {}, { id: p.id });
  save();
  res.json({ code: 0, data: p });
});

// 分类 CRUD（商品管理附带，product:write 即可，团长也能维护）
router.get('/categories', authRequired, requirePermission('product:write'), (req, res) => {
  const db = load();
  res.json({ code: 0, data: db.categories });
});

router.post('/categories', authRequired, requirePermission('product:write'), (req, res) => {
  const db = load();
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ code: 400, msg: '名称必填' });
  const exists = db.categories.find((c) => c.name === b.name.trim());
  if (exists) return res.status(400).json({ code: 400, msg: '分类已存在' });
  const c = {
    id: nextId('cat'),
    name: b.name.trim(),
    icon: b.icon || '',
    sort: b.sort != null ? Number(b.sort) : 0,
    status: b.status || 'on',
  };
  db.categories.push(c);
  save();
  res.json({ code: 0, data: c });
});

router.put('/categories/:id', authRequired, requirePermission('product:write'), (req, res) => {
  const db = load();
  const c = db.categories.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ code: 404, msg: '分类不存在' });
  const b = req.body || {};
  if (b.name != null) c.name = String(b.name).trim() || c.name;
  if (b.icon !== undefined) c.icon = b.icon;
  if (b.sort !== undefined) c.sort = Number(b.sort) || 0;
  if (b.status !== undefined) c.status = b.status;
  save();
  res.json({ code: 0, data: c });
});

// 软删分类：仅允许无商品引用时删除
router.delete('/categories/:id', authRequired, requirePermission('product:write'), (req, res) => {
  const db = load();
  const c = db.categories.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ code: 404, msg: '分类不存在' });
  const used = db.products.some((p) => !p.deleted && p.categoryId === c.id);
  if (used) return res.status(400).json({ code: 400, msg: '该分类下仍有商品，无法删除' });
  db.categories = db.categories.filter((x) => x.id !== c.id);
  save();
  res.json({ code: 0, data: { id: req.params.id } });
});

module.exports = router;

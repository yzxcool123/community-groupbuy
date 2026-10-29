const express = require('express');
const { load, save, nextId } = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { genOrderNo, genVerifyCode } = require('../utils/code');

const router = express.Router();

const STATUS = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  READY: 'ready',
  VERIFIED: 'verified',
  CANCELLED: 'cancelled',
};

function orderDetail(db, o) {
  const items = db.orderItems.filter((i) => i.orderId === o.id);
  const verify = db.verifyCodes.find((v) => v.orderId === o.id);
  const pickup = db.pickupPoints.find((p) => p.id === o.pickupPointId);
  const user = db.users.find((u) => u.id === o.userId);
  return {
    ...o,
    fulfillment: o.fulfillment || 'pickup',
    payMode: o.payMode || 'online', // online 在线支付 | cod 到店付款
    paid: !!o.paidAt,
    deliveryAddress: o.deliveryAddress || null,
    items,
    verifyCode: verify ? { code: verify.code, status: verify.status, verifiedAt: verify.verifiedAt, verifiedBy: verify.verifiedBy } : null,
    pickupPoint: pickup ? { id: pickup.id, name: pickup.name, address: pickup.address, phone: pickup.phone } : null,
    user: user ? { id: user.id, nickname: user.nickname, phone: user.phone } : null,
  };
}

// 提交订单
router.post('/', authRequired, (req, res) => {
  const db = load();
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return res.status(400).json({ code: 400, msg: '购物车为空' });

  const fulfillment = b.fulfillment === 'delivery' ? 'delivery' : 'pickup';

  // 付款方式：送货必须在线支付；自提可选在线/到店付
  let payMode = b.payMode === 'cod' ? 'cod' : 'online';
  if (fulfillment === 'delivery' && payMode === 'cod') {
    return res.status(400).json({ code: 400, msg: '送货上门需在线支付' });
  }

  let pickup = null;
  let deliveryAddress = null;
  if (fulfillment === 'pickup') {
    if (!b.pickupPointId) return res.status(400).json({ code: 400, msg: '请选择自提点' });
    pickup = db.pickupPoints.find((p) => p.id === b.pickupPointId && p.status !== 'disabled');
    if (!pickup) return res.status(400).json({ code: 400, msg: '自提点无效' });
  } else {
    const addr = b.deliveryAddress || {};
    const community = String(addr.community || '').trim();
    const building = String(addr.building || '').trim();
    const room = String(addr.room || '').trim();
    const contactName = String(addr.contactName || '').trim();
    const contactPhone = String(addr.contactPhone || '').trim();
    if (!community) return res.status(400).json({ code: 400, msg: '请填写小区名称' });
    if (!building) return res.status(400).json({ code: 400, msg: '请填写楼号' });
    if (!room) return res.status(400).json({ code: 400, msg: '请填写门牌号' });
    if (!contactName) return res.status(400).json({ code: 400, msg: '请填写收货人' });
    if (!/^1\d{10}$/.test(contactPhone)) return res.status(400).json({ code: 400, msg: '请填写正确的手机号' });
    deliveryAddress = {
      community,
      building,
      room,
      contactName,
      contactPhone,
      text: `${community} ${building} ${room}`,
    };
  }

  const orderItems = [];
  let total = 0;
  for (const it of items) {
    const sku = db.productSkus.find((s) => s.id === it.skuId && !s.deleted);
    if (!sku) return res.status(400).json({ code: 400, msg: 'SKU 不存在' });
    const product = db.products.find((p) => p.id === sku.productId && !p.deleted);
    if (!product || product.status !== 'on') return res.status(400).json({ code: 400, msg: `商品 ${product ? product.title : ''} 已下架` });
    const qty = Math.max(1, Number(it.qty) || 1);
    if (sku.stock < qty) return res.status(400).json({ code: 400, msg: `「${product.title}」库存不足` });
    const price = product.activityPrice != null ? Number(product.activityPrice) : sku.price;
    orderItems.push({
      id: nextId('oi'),
      productId: product.id,
      skuId: sku.id,
      title: product.title,
      skuName: sku.name,
      skuSpec: sku.spec || '',
      price,
      qty,
      cover: product.cover,
    });
    total += price * qty;
    sku.stock -= qty;
  }

  // 在线支付：待支付；到店付款：直接进入待提货（核销时收款）
  const initialStatus = payMode === 'cod' ? STATUS.READY : STATUS.UNPAID;

  const order = {
    id: nextId('o'),
    orderNo: genOrderNo(),
    userId: req.user.userId,
    status: initialStatus,
    total: Math.round(total * 100) / 100,
    fulfillment,
    payMode,
    pickupPointId: pickup ? pickup.id : null,
    deliveryAddress,
    expectDate: b.expectDate || null,
    remark: b.remark || '',
    createdAt: new Date().toISOString(),
    paidAt: null,
    verifiedAt: null,
    cancelledAt: null,
  };
  db.orders.push(order);
  for (const it of orderItems) db.orderItems.push({ ...it, orderId: order.id });
  const verify = {
    id: nextId('vc'),
    orderId: order.id,
    code: genVerifyCode(),
    status: 'active',
    verifiedBy: null,
    verifiedAt: null,
  };
  db.verifyCodes.push(verify);
  save();
  res.json({ code: 0, data: orderDetail(db, order) });
});

// 我的订单
router.get('/mine', authRequired, (req, res) => {
  const db = load();
  const { status, page = 1, pageSize = 20 } = req.query;
  let list = db.orders.filter((o) => o.userId === req.user.userId);
  if (status) list = list.filter((o) => o.status === status);
  list = list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const total = list.length;
  const start = (Number(page) - 1) * Number(pageSize);
  const pageList = list.slice(start, start + Number(pageSize)).map((o) => orderDetail(db, o));
  res.json({ code: 0, data: { list: pageList, total, page: Number(page), pageSize: Number(pageSize) } });
});

// 新订单提醒（供管理后台轮询）
router.get('/notify/recent', authRequired, requirePermission('order:read'), (req, res) => {
  const db = load();
  const since = req.query.since ? String(req.query.since) : '';
  const limit = Math.min(20, Number(req.query.limit) || 5);
  let list = [...db.orders];
  if (since) {
    const t = new Date(since).getTime();
    if (!Number.isNaN(t)) {
      list = list.filter((o) => new Date(o.createdAt).getTime() > t);
    }
  }
  list = list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, limit);
  res.json({
    code: 0,
    data: {
      now: new Date().toISOString(),
      list: list.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        total: o.total,
        status: o.status,
        fulfillment: o.fulfillment || 'pickup',
        payMode: o.payMode || 'online',
        paid: !!o.paidAt,
        createdAt: o.createdAt,
        user: (db.users.find((u) => u.id === o.userId) || {}).nickname || '用户',
      })),
    },
  });
});

// 全部订单（管理）
router.get('/', authRequired, requirePermission('order:read'), (req, res) => {
  const db = load();
  const { status, keyword, page = 1, pageSize = 20, pickupPointId } = req.query;
  let list = [...db.orders];
  if (status) list = list.filter((o) => o.status === status);
  if (pickupPointId) list = list.filter((o) => o.pickupPointId === pickupPointId);
  if (keyword) {
    const k = String(keyword).toLowerCase();
    list = list.filter(
      (o) =>
        o.orderNo.toLowerCase().includes(k) ||
        (o.userId && o.userId.toLowerCase().includes(k)) ||
        (db.users.find((u) => u.id === o.userId)?.nickname || '').toLowerCase().includes(k)
    );
  }
  list = list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const total = list.length;
  const start = (Number(page) - 1) * Number(pageSize);
  const pageList = list.slice(start, start + Number(pageSize)).map((o) => orderDetail(db, o));
  res.json({ code: 0, data: { list: pageList, total, page: Number(page), pageSize: Number(pageSize) } });
});

// 订单详情
router.get('/:id', authRequired, (req, res) => {
  const db = load();
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ code: 404, msg: '订单不存在' });
  const isSelf = o.userId === req.user.userId;
  const isStaff = (req.user.roles || []).some((r) => r === 'staff' || r === 'admin');
  if (!isSelf && !isStaff) return res.status(403).json({ code: 403, msg: '无权查看' });
  res.json({ code: 0, data: orderDetail(db, o) });
});

// 模拟支付（仅在线支付订单）
router.post('/:id/mock-pay', authRequired, (req, res) => {
  const db = load();
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ code: 404, msg: '订单不存在' });
  if (o.userId !== req.user.userId && !(req.user.roles || []).includes('admin')) {
    return res.status(403).json({ code: 403, msg: '无权操作' });
  }
  if (o.payMode === 'cod') {
    return res.status(400).json({ code: 400, msg: '到店付款订单无需在线支付' });
  }
  if (o.status !== STATUS.UNPAID) return res.status(400).json({ code: 400, msg: '订单状态不允许支付' });
  o.paidAt = new Date().toISOString();
  o.status = STATUS.READY;
  save();
  res.json({ code: 0, data: orderDetail(db, o) });
});

// 取消订单
router.post('/:id/cancel', authRequired, (req, res) => {
  const db = load();
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ code: 404, msg: '订单不存在' });
  const isAdmin = (req.user.roles || []).includes('admin');
  if (o.userId !== req.user.userId && !isAdmin) return res.status(403).json({ code: 403, msg: '无权操作' });
  if (![STATUS.UNPAID, STATUS.PAID, STATUS.READY].includes(o.status)) {
    return res.status(400).json({ code: 400, msg: '当前状态不可取消' });
  }
  // 回滚库存
  for (const it of db.orderItems.filter((i) => i.orderId === o.id)) {
    const sku = db.productSkus.find((s) => s.id === it.skuId);
    if (sku) sku.stock += it.qty;
  }
  o.status = STATUS.CANCELLED;
  o.cancelledAt = new Date().toISOString();
  const v = db.verifyCodes.find((x) => x.orderId === o.id);
  if (v) v.status = 'invalid';
  save();
  res.json({ code: 0, data: orderDetail(db, o) });
});

// 核销码
router.get('/:id/verify-code', authRequired, (req, res) => {
  const db = load();
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ code: 404, msg: '订单不存在' });
  if (o.userId !== req.user.userId && !(req.user.roles || []).some((r) => r === 'staff' || r === 'admin')) {
    return res.status(403).json({ code: 403, msg: '无权查看' });
  }
  const v = db.verifyCodes.find((x) => x.orderId === o.id);
  if (!v) return res.status(404).json({ code: 404, msg: '核销码不存在' });
  res.json({
    code: 0,
    data: { code: v.code, status: v.status, orderId: o.id, orderNo: o.orderNo, orderStatus: o.status },
  });
});

module.exports = router;
module.exports.orderDetail = orderDetail;
module.exports.STATUS = STATUS;

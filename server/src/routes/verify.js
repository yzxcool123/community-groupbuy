const express = require('express');
const { load, save } = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { orderDetail, STATUS } = require('./orders');

const router = express.Router();

// 核销：输入或扫描核销码
router.post('/', authRequired, requirePermission('order:verify'), (req, res) => {
  const db = load();
  const { code, orderId, pickupPointId } = req.body || {};
  let v = null;
  if (code) {
    v = db.verifyCodes.find((x) => x.code === String(code).trim().toUpperCase());
  } else if (orderId) {
    v = db.verifyCodes.find((x) => x.orderId === orderId);
  }
  if (!v) return res.status(404).json({ code: 404, msg: '核销码无效' });
  if (v.status === 'verified') return res.status(400).json({ code: 400, msg: '该码已核销' });
  if (v.status !== 'active') return res.status(400).json({ code: 400, msg: '该码已失效' });

  const o = db.orders.find((x) => x.id === v.orderId);
  if (!o) return res.status(404).json({ code: 404, msg: '订单不存在' });
  if (![STATUS.PAID, STATUS.READY].includes(o.status)) {
    return res.status(400).json({ code: 400, msg: `订单状态（${o.status}）不可核销` });
  }
  // 若指定自提点则校验（staff 仅核销本店，可扩展）
  if (pickupPointId && o.pickupPointId !== pickupPointId) {
    return res.status(400).json({ code: 400, msg: '自提点不匹配，无法核销' });
  }

  v.status = 'verified';
  v.verifiedBy = req.user.userId;
  v.verifiedAt = new Date().toISOString();
  o.status = STATUS.VERIFIED;
  o.verifiedAt = v.verifiedAt;
  const wasCod = o.payMode === 'cod' && !o.paidAt;
  // 到店付款：核销时视为已收款
  if (wasCod) {
    o.paidAt = v.verifiedAt;
    o.paidBy = 'cod';
  }
  save();
  res.json({
    code: 0,
    data: orderDetail(db, o),
    msg: wasCod ? '核销成功，已收货款' : '核销成功',
  });
});

// 校验核销码（不核销，只查询）
router.post('/query', authRequired, requirePermission('order:verify'), (req, res) => {
  const db = load();
  const { code, orderId } = req.body || {};
  let v = null;
  if (code) v = db.verifyCodes.find((x) => x.code === String(code).trim().toUpperCase());
  else if (orderId) v = db.verifyCodes.find((x) => x.orderId === orderId);
  if (!v) return res.status(404).json({ code: 404, msg: '核销码无效' });
  const o = db.orders.find((x) => x.id === v.orderId);
  res.json({ code: 0, data: orderDetail(db, o) });
});

module.exports = router;

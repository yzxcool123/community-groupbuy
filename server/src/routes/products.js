const express = require('express');
const { load, save, nextId } = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');

const router = express.Router();

function serializeProduct(db, p, { withStock = false } = {}) {
  const skus = db.productSkus.filter((s) => s.productId === p.id && !s.deleted);
  const category = db.categories.find((c) => c.id === p.categoryId);
  const minPrice = skus.length ? Math.min(...skus.map((s) => s.price)) : 0;
  const totalStock = skus.reduce((a, s) => a + (s.stock || 0), 0);
  const base = {
    id: p.id,
    title: p.title,
    cover: p.cover,
    images: p.images || [],
    detail: p.detail || '',
    categoryId: p.categoryId,
    categoryName: category ? category.name : '',
    status: p.status,
    saleType: p.saleType,
    pickupOnly: !!p.pickupOnly,
    isHot: !!p.isHot,
    sort: p.sort || 0,
    minPrice,
    priceText: minPrice ? (skus.length > 1 ? `¥${minPrice.toFixed(2)}起` : `¥${minPrice.toFixed(2)}`) : '—',
    stock: totalStock,
    activityPrice: p.activityPrice != null ? p.activityPrice : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
  if (withStock) {
    base.skus = skus.map((s) => ({
      id: s.id,
      productId: s.productId,
      name: s.name,
      spec: s.spec || '',
      price: s.price,
      linePrice: s.linePrice || null,
      stock: s.stock,
      image: s.image || p.cover,
    }));
  }
  return base;
}

// 公开：分类（隐藏无在售商品的分类，管理端请走 /api/admin/categories）
router.get('/categories', (req, res) => {
  const db = load();
  const hasStockProduct = new Set(
    db.products.filter((p) => !p.deleted && p.status === 'on' && p.categoryId).map((p) => p.categoryId)
  );
  const list = db.categories
    .filter((c) => c.status !== 'disabled' && hasStockProduct.has(c.id))
    .sort((a, b) => (b.sort || 0) - (a.sort || 0) || (a.name || '').localeCompare(b.name || ''));
  res.json({ code: 0, data: list });
});

// 公开：轮播
router.get('/banners', (req, res) => {
  const db = load();
  res.json({ code: 0, data: db.banners.filter((b) => b.status !== 'disabled') });
});

// 公开：自提点
router.get('/pickup-points', (req, res) => {
  const db = load();
  const list = db.pickupPoints
    .filter((p) => p.status !== 'disabled')
    .map((p) => ({ id: p.id, name: p.name, address: p.address, phone: p.phone, openTime: p.openTime }));
  res.json({ code: 0, data: list });
});

// 公开：今日热销
// 当天销量 Top5；若当日无成交，则从上架商品中随机 3 个
router.get('/hot-today', (req, res) => {
  const db = load();
  const today = new Date().toISOString().slice(0, 10);
  const soldMap = new Map(); // productId -> qty

  const todayOrders = db.orders.filter(
    (o) => o.status !== 'cancelled' && (o.createdAt || '').startsWith(today)
  );
  const todayOrderIds = new Set(todayOrders.map((o) => o.id));
  for (const it of db.orderItems) {
    if (!todayOrderIds.has(it.orderId)) continue;
    const prev = soldMap.get(it.productId) || 0;
    soldMap.set(it.productId, prev + (it.qty || 0));
  }

  const onSale = db.products.filter((p) => !p.deleted && p.status === 'on');
  let picked = onSale
    .filter((p) => soldMap.has(p.id))
    .sort((a, b) => (soldMap.get(b.id) || 0) - (soldMap.get(a.id) || 0))
    .slice(0, 5);

  let mode = 'sales';
  if (!picked.length) {
    mode = 'random';
    const shuffled = [...onSale].sort(() => Math.random() - 0.5);
    picked = shuffled.slice(0, 3);
  }

  res.json({
    code: 0,
    data: {
      mode,
      list: picked.map((p) => {
        const item = serializeProduct(db, p);
        item.todaySales = soldMap.get(p.id) || 0;
        return item;
      }),
    },
  });
});

// 公开：商品列表
router.get('/', (req, res) => {
  const db = load();
  const { categoryId, keyword, status, page = 1, pageSize = 20, hot } = req.query;
  let list = db.products.filter((p) => !p.deleted);
  if (status === 'all') {
    // 管理端：不过滤状态
  } else if (status) {
    list = list.filter((p) => p.status === status);
  } else {
    list = list.filter((p) => p.status === 'on');
  }
  if (categoryId) list = list.filter((p) => p.categoryId === categoryId);
  if (hot === '1') list = list.filter((p) => p.isHot);
  if (keyword) {
    const k = String(keyword).toLowerCase();
    list = list.filter((p) => (p.title || '').toLowerCase().includes(k));
  }
  list = list.sort((a, b) => (b.sort || 0) - (a.sort || 0) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const total = list.length;
  const start = (Number(page) - 1) * Number(pageSize);
  const pageList = list.slice(start, start + Number(pageSize)).map((p) => serializeProduct(db, p));
  res.json({ code: 0, data: { list: pageList, total, page: Number(page), pageSize: Number(pageSize) } });
});

// 公开：商品详情
router.get('/:id', (req, res) => {
  const db = load();
  const p = db.products.find((x) => x.id === req.params.id && !x.deleted);
  if (!p) return res.status(404).json({ code: 404, msg: '商品不存在' });
  res.json({ code: 0, data: serializeProduct(db, p, { withStock: true }) });
});

// 管理：创建商品
router.post('/', authRequired, requirePermission('product:write'), (req, res) => {
  const db = load();
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ code: 400, msg: '商品标题必填' });
  const product = {
    id: nextId('p'),
    title: b.title,
    cover: b.cover || '',
    images: b.images || [],
    detail: b.detail || '',
    categoryId: b.categoryId || null,
    status: b.status || 'on',
    saleType: b.saleType || 'spot',
    pickupOnly: b.pickupOnly !== false,
    isHot: !!b.isHot,
    sort: b.sort || 0,
    activityPrice: b.activityPrice ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.products.push(product);
  const skus = Array.isArray(b.skus) && b.skus.length ? b.skus : [{ name: '默认', price: 0, stock: 0 }];
  for (const s of skus) {
    db.productSkus.push({
      id: nextId('sk'),
      productId: product.id,
      name: s.name || '默认',
      spec: s.spec || '',
      price: Number(s.price) || 0,
      linePrice: s.linePrice != null ? Number(s.linePrice) : null,
      stock: Number(s.stock) || 0,
      image: s.image || product.cover,
      deleted: false,
    });
  }
  save();
  res.json({ code: 0, data: serializeProduct(db, product, { withStock: true }) });
});

// 管理：更新商品
router.put('/:id', authRequired, requirePermission('product:write'), (req, res) => {
  const db = load();
  const p = db.products.find((x) => x.id === req.params.id && !x.deleted);
  if (!p) return res.status(404).json({ code: 404, msg: '商品不存在' });
  const b = req.body || {};
  const fields = ['title', 'cover', 'images', 'detail', 'categoryId', 'status', 'saleType', 'pickupOnly', 'isHot', 'sort', 'activityPrice'];
  for (const f of fields) if (b[f] !== undefined) p[f] = b[f];
  p.updatedAt = new Date().toISOString();
  if (Array.isArray(b.skus)) {
    // 简化：整表替换 SKU
    for (const old of db.productSkus.filter((s) => s.productId === p.id)) old.deleted = true;
    for (const s of b.skus) {
      db.productSkus.push({
        id: s.id && db.productSkus.find((x) => x.id === s.id && !x.deleted) ? s.id : nextId('sk'),
        productId: p.id,
        name: s.name || '默认',
        spec: s.spec || '',
        price: Number(s.price) || 0,
        linePrice: s.linePrice != null ? Number(s.linePrice) : null,
        stock: Number(s.stock) || 0,
        image: s.image || p.cover,
        deleted: false,
      });
    }
  }
  save();
  res.json({ code: 0, data: serializeProduct(db, p, { withStock: true }) });
});

// 管理：上下架（PATCH 与 POST 双入口，兼容小程序对 PATCH 支持不稳）
function toggleStatusHandler(req, res) {
  const db = load();
  const p = db.products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ code: 404, msg: '商品不存在' });
  p.status = req.body.status === 'off' ? 'off' : 'on';
  p.updatedAt = new Date().toISOString();
  save();
  res.json({ code: 0, data: { id: p.id, status: p.status } });
}
router.post('/:id/status', authRequired, requirePermission('product:write'), toggleStatusHandler);
router.patch('/:id/status', authRequired, requirePermission('product:write'), toggleStatusHandler);

// 管理：删除（软删）
router.delete('/:id', authRequired, requirePermission('product:admin'), (req, res) => {
  const db = load();
  const p = db.products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ code: 404, msg: '商品不存在' });
  p.deleted = true;
  p.updatedAt = new Date().toISOString();
  save();
  res.json({ code: 0, data: { id: p.id } });
});

module.exports = router;
module.exports.serializeProduct = serializeProduct;

/**
 * 购物车本地存储
 */
const CART_KEY = 'cart';
const BUY_NOW_KEY = 'buyNowItem';

const countListeners = [];

function onCountChange(fn) {
  if (typeof fn !== 'function') return () => {};
  countListeners.push(fn);
  return function off() {
    const i = countListeners.indexOf(fn);
    if (i >= 0) countListeners.splice(i, 1);
  };
}

function emitCountChange() {
  const count = getCount();
  for (const fn of countListeners) {
    try {
      fn(count);
    } catch (e) {}
  }
  updateTabBadge(count);
}

/** 同步 tabBar「购物车」角标 */
function updateTabBadge(count) {
  try {
    const n = count == null ? getCount() : count;
    if (n > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: n > 99 ? '99+' : String(n),
        fail: () => {},
      });
    } else {
      wx.removeTabBarBadge({
        index: 2,
        fail: () => {},
      });
    }
  } catch (e) {}
}

function getAll() {
  try {
    return wx.getStorageSync(CART_KEY) || [];
  } catch (e) {
    return [];
  }
}

function saveAll(list) {
  wx.setStorageSync(CART_KEY, list || []);
  emitCountChange();
}

function getCount() {
  return getAll().reduce((a, i) => a + (i.qty || 0), 0);
}

/** 同 sku 累加数量 */
function add(item) {
  const list = getAll();
  const idx = list.findIndex((i) => i.skuId === item.skuId);
  if (idx >= 0) {
    list[idx].qty += item.qty || 1;
    list[idx].checked = true;
  } else {
    list.push(Object.assign({ checked: true }, item));
  }
  saveAll(list);
  return list;
}

function updateQty(skuId, qty) {
  const list = getAll();
  const idx = list.findIndex((i) => i.skuId === skuId);
  if (idx < 0) return list;
  list[idx].qty = Math.max(1, qty);
  saveAll(list);
  return list;
}

function toggleCheck(skuId, checked) {
  const list = getAll();
  const idx = list.findIndex((i) => i.skuId === skuId);
  if (idx >= 0) list[idx].checked = !!checked;
  saveAll(list);
  return list;
}

function toggleAll(checked) {
  const list = getAll().map((i) => Object.assign({}, i, { checked: !!checked }));
  saveAll(list);
  return list;
}

function remove(skuIds) {
  const ids = Array.isArray(skuIds) ? skuIds : [skuIds];
  const list = getAll().filter((i) => ids.indexOf(i.skuId) < 0);
  saveAll(list);
  return list;
}

function getChecked() {
  return getAll().filter((i) => i.checked);
}

function clearChecked() {
  saveAll(getAll().filter((i) => !i.checked));
}

/** 立即购买临时件 */
function setBuyNow(item) {
  wx.setStorageSync(BUY_NOW_KEY, item);
}

function takeBuyNow() {
  try {
    const item = wx.getStorageSync(BUY_NOW_KEY) || null;
    return item;
  } catch (e) {
    return null;
  }
}

function clearBuyNow() {
  try {
    wx.removeStorageSync(BUY_NOW_KEY);
  } catch (e) {}
}

module.exports = {
  getAll,
  saveAll,
  getCount,
  add,
  updateQty,
  toggleCheck,
  toggleAll,
  remove,
  getChecked,
  clearChecked,
  setBuyNow,
  takeBuyNow,
  clearBuyNow,
  onCountChange,
  updateTabBadge,
};

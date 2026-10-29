/**
 * 收货地址本地管理
 * 字段：community 小区 / building 楼号 / room 门牌 / contactName / contactPhone / isDefault
 */
const KEY = 'addressBook';

function getAll() {
  try {
    return wx.getStorageSync(KEY) || [];
  } catch (e) {
    return [];
  }
}

function saveAll(list) {
  wx.setStorageSync(KEY, list || []);
  return list || [];
}

function getById(id) {
  return getAll().find((a) => a.id === id) || null;
}

function getDefault() {
  const list = getAll();
  return list.find((a) => a.isDefault) || list[0] || null;
}

function add(addr) {
  const list = getAll();
  const item = Object.assign(
    {
      id: 'addr_' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      isDefault: list.length === 0,
    },
    addr
  );
  if (item.isDefault) {
    list.forEach((a) => (a.isDefault = false));
  }
  list.unshift(item);
  saveAll(list);
  return item;
}

function update(id, patch) {
  const list = getAll();
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  if (list[idx].isDefault) {
    list.forEach((a, i) => {
      if (i !== idx) a.isDefault = false;
    });
  }
  saveAll(list);
  return list[idx];
}

function remove(id) {
  const list = getAll().filter((a) => a.id !== id);
  if (list.length && !list.some((a) => a.isDefault)) {
    list[0].isDefault = true;
  }
  saveAll(list);
  return list;
}

function setDefault(id) {
  return update(id, { isDefault: true });
}

function formatText(addr) {
  if (!addr) return '';
  return `${addr.community} ${addr.building} ${addr.room}`;
}

module.exports = {
  getAll,
  getById,
  getDefault,
  add,
  update,
  remove,
  setDefault,
  formatText,
};

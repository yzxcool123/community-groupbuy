/**
 * 权限判断：以 globalData.permissions 为准，回退本地缓存
 */
const auth = require('./auth');

function getAppSafe() {
  try {
    return getApp();
  } catch (e) {
    return null;
  }
}

function currentPermissions() {
  const app = getAppSafe();
  if (app && app.globalData && Array.isArray(app.globalData.permissions) && app.globalData.permissions.length) {
    return app.globalData.permissions;
  }
  const user = auth.getUserInfo();
  return (user && user.permissions) || [];
}

function currentRoles() {
  const app = getAppSafe();
  if (app && app.globalData && Array.isArray(app.globalData.roles) && app.globalData.roles.length) {
    return app.globalData.roles;
  }
  const user = auth.getUserInfo();
  return (user && user.roles) || [];
}

/** 是否拥有某权限 */
function hasPermission(perm) {
  if (!perm) return false;
  const perms = currentPermissions();
  return perms.indexOf(perm) >= 0;
}

/** 是否拥有任一权限 */
function hasAnyPermission(list) {
  if (!Array.isArray(list)) return false;
  return list.some((p) => hasPermission(p));
}

/** 是否 staff/admin */
function isStaffOrAdmin() {
  const roles = currentRoles();
  return roles.indexOf('staff') >= 0 || roles.indexOf('admin') >= 0;
}

/** 是否可以进入管理端（看板/上货/核销） */
function canEnterAdmin() {
  return hasAnyPermission(['stats:read', 'product:write', 'order:verify', 'order:read']);
}

/**
 * 管理页 onShow 门控：无权限 reLaunch 回首页
 * @returns {boolean} true=通过
 */
function guardAdmin(perm) {
  const ok = perm ? hasPermission(perm) || hasPermission('product:admin') : canEnterAdmin();
  if (ok) return true;
  wx.showToast({ title: '暂无权限访问', icon: 'none' });
  setTimeout(() => {
    wx.reLaunch({ url: '/pages/index/index' });
  }, 400);
  return false;
}

module.exports = {
  currentPermissions,
  currentRoles,
  hasPermission,
  hasAnyPermission,
  isStaffOrAdmin,
  canEnterAdmin,
  guardAdmin,
};

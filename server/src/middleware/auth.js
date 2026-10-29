const { verify } = require('../utils/jwt');
const { load } = require('../db');

const PERMISSIONS = {
  buyer: ['product:read', 'order:self'],
  staff: [
    'product:read',
    'product:write',
    'order:self',
    'order:verify',
    'order:read',
    'stats:read',
    'verify:do',
  ],
  admin: [
    'product:read',
    'product:write',
    'product:admin',
    'order:self',
    'order:read',
    'order:verify',
    'order:admin',
    'user:admin',
    'pickup:admin',
    'stats:read',
    'verify:do',
    'activity:admin',
  ],
};

function permsOfRoles(roles) {
  const set = new Set();
  for (const r of roles) {
    for (const p of PERMISSIONS[r] || []) set.add(p);
  }
  return [...set];
}

function resolveUser(roles) {
  // roles: string[]
  return permsOfRoles(roles);
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ code: 401, msg: '未登录' });
  try {
    const payload = verify(token);
    req.user = payload;
    req.permissions = payload.permissions || permsOfRoles(payload.roles || ['buyer']);
    next();
  } catch {
    return res.status(401).json({ code: 401, msg: '登录已过期' });
  }
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 401, msg: '未登录' });
    if ((req.permissions || []).includes(perm) || (req.permissions || []).includes('product:admin') && perm.startsWith('product:')) {
      return next();
    }
    // admin 超级权限兜底
    if ((req.user.roles || []).includes('admin')) return next();
    return res.status(403).json({ code: 403, msg: '无权限执行此操作' });
  };
}

function userRolesFromDb(userId) {
  const db = load();
  const rows = db.userRoles.filter((x) => x.userId === userId);
  return rows.map((x) => x.role);
}

function userPerms(userId) {
  return permsOfRoles(userRolesFromDb(userId));
}

module.exports = {
  authRequired,
  requirePermission,
  permsOfRoles,
  userPerms,
  userRolesFromDb,
  PERMISSIONS,
};

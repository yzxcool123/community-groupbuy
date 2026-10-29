const express = require('express');
const { load, save, nextId } = require('../db');
const { sign } = require('../utils/jwt');
const { authRequired, userRolesFromDb, userPerms, permsOfRoles } = require('../middleware/auth');
const { code2session } = require('../utils/wechat');

const router = express.Router();

function findOrCreateUser(db, { openid, nickname, avatar }) {
  let user = db.users.find((u) => u.openid === openid);
  if (!user) {
    user = {
      id: nextId('u'),
      openid,
      username: null,
      password: null,
      nickname: nickname || '微信用户' + String(db.users.length + 1).padStart(4, '0'),
      avatar: avatar || '',
      phone: '',
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    db.userRoles.push({ userId: user.id, role: 'buyer' });
    save();
  }
  return user;
}

function issueLoginRes(user) {
  const roles = userRolesFromDb(user.id);
  const permissions = permsOfRoles(roles);
  const token = sign({ userId: user.id, roles, permissions, nickname: user.nickname });
  return {
    code: 0,
    data: {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        phone: user.phone,
        roles,
        permissions,
      },
    },
  };
}

// 小程序登录：真机/开发者工具走微信 code2session；失败时降级为本地 openid（便于离线调试）
// 演示：code 含 staff/admin 字样时自动提权，便于在工具里调管理端
router.post('/wx-login', async (req, res) => {
  const { code, nickname, avatar } = req.body || {};
  if (!code) return res.status(400).json({ code: 400, msg: '缺少 code' });
  const db = load();
  const raw = String(code);

  let openid = null;
  let fromWechat = false;
  try {
    const session = await code2session(raw);
    openid = session.openid;
    fromWechat = true;
  } catch (e) {
    // 开发降级：无法访问微信 API 时，用伪 openid，保证模拟器可联调
    console.warn('[wx-login] code2session failed, fallback mock openid:', e.message);
    openid = 'wx_' + raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'wx_' + Date.now();
  }

  const user = findOrCreateUser(db, { openid, nickname, avatar });

  // 仅在未走真实微信、或调试 code 含关键字时提权（真机正常 code 不会误伤）
  if (!fromWechat || /admin/i.test(raw) || /staff/i.test(raw)) {
    const want = [];
    if (/admin/i.test(raw)) want.push('admin');
    if (/staff/i.test(raw)) want.push('staff');
    if (want.length) {
      const have = new Set(db.userRoles.filter((x) => x.userId === user.id).map((x) => x.role));
      have.add('buyer');
      for (const r of want) {
        if (!have.has(r)) {
          db.userRoles.push({ userId: user.id, role: r });
          have.add(r);
        }
      }
      save();
    }
  }

  res.json(issueLoginRes(user));
});

// PC 账号密码登录
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const db = load();
  const user = db.users.find((u) => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ code: 401, msg: '账号或密码错误' });
  const roles = userRolesFromDb(user.id);
  const permissions = permsOfRoles(roles);
  const token = sign({ userId: user.id, roles, permissions, nickname: user.nickname });
  res.json({
    code: 0,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        phone: user.phone,
        roles,
        permissions,
      },
    },
  });
});

// 当前用户信息（刷新权限用）
router.get('/me', authRequired, (req, res) => {
  const db = load();
  const user = db.users.find((u) => u.id === req.user.userId);
  if (!user) return res.status(404).json({ code: 404, msg: '用户不存在' });
  const roles = userRolesFromDb(user.id);
  const permissions = permsOfRoles(roles);
  res.json({
    code: 0,
    data: {
      id: user.id,
      username: user.username || null,
      nickname: user.nickname,
      avatar: user.avatar,
      phone: user.phone,
      roles,
      permissions,
    },
  });
});

// 更新资料
router.patch('/profile', authRequired, (req, res) => {
  const db = load();
  const user = db.users.find((u) => u.id === req.user.userId);
  if (!user) return res.status(404).json({ code: 404, msg: '用户不存在' });
  const { nickname, avatar, phone } = req.body || {};
  if (nickname != null) user.nickname = nickname;
  if (avatar != null) user.avatar = avatar;
  if (phone != null) user.phone = phone;
  save();
  res.json({ code: 0, data: { id: user.id, nickname: user.nickname, phone: user.phone } });
});

module.exports = router;

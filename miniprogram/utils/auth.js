/**
 * 登录与会话
 */
const { post, get, getToken } = require('./request');

const TOKEN_KEY = 'token';
const USER_KEY = 'userInfo';

function setToken(token) {
  if (token) wx.setStorageSync(TOKEN_KEY, token);
  else wx.removeStorageSync(TOKEN_KEY);
}

function clearSession() {
  try {
    wx.removeStorageSync(TOKEN_KEY);
    wx.removeStorageSync(USER_KEY);
  } catch (e) {}
}

function getUserInfo() {
  try {
    return wx.getStorageSync(USER_KEY) || null;
  } catch (e) {
    return null;
  }
}

function setUserInfo(user) {
  if (user) wx.setStorageSync(USER_KEY, user);
}

/** wx.login 换 code */
function getWxCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) resolve(res.code);
        else reject(new Error('获取登录 code 失败'));
      },
      fail: reject,
    });
  });
}

/**
 * 静默登录：wx.login → /api/auth/wx-login
 */
function silentLogin(profile) {
  return getWxCode().then((code) =>
    post(
      '/api/auth/wx-login',
      {
        code,
        nickname: (profile && profile.nickname) || undefined,
        avatar: (profile && profile.avatar) || undefined,
      },
      { silent: true }
    ).then((data) => {
      setToken(data.token);
      setUserInfo(data.user);
      return data.user;
    })
  );
}

/** 拉取当前用户信息（含权限） */
function fetchMe() {
  return get('/api/auth/me', null, { silent: true }).then((user) => {
    setUserInfo(user);
    return user;
  });
}

/**
 * 保证已登录：
 * 1) 有 token → 尝试 /api/auth/me 刷新权限
 * 2) 无 token / me 失败 → 静默 wx-login
 */
function ensureLogin() {
  const token = getToken();
  if (token) {
    return fetchMe().catch(() => silentLogin());
  }
  return silentLogin();
}

module.exports = {
  TOKEN_KEY,
  USER_KEY,
  setToken,
  getToken,
  clearSession,
  getUserInfo,
  setUserInfo,
  getWxCode,
  silentLogin,
  fetchMe,
  ensureLogin,
};

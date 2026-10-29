/**
 * 统一请求封装：自动带 token、统一错误 toast、401 静默重登
 */
const appConfig = require('../config');

const BASE_URL = appConfig.BASE_URL;

let relogging = false;
const pending = [];

function getToken() {
  return wx.getStorageSync('token') || '';
}

function buildHeader(header) {
  const h = Object.assign({ 'Content-Type': 'application/json' }, header || {});
  const token = getToken();
  if (token) h.Authorization = 'Bearer ' + token;
  return h;
}

function toastError(msg) {
  if (!msg) return;
  wx.showToast({ title: String(msg).slice(0, 28), icon: 'none', duration: 2200 });
}

/** 401 时静默重新 wx-login */
function silentRelogin() {
  if (relogging) {
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  }
  relogging = true;
  const auth = require('./auth');
  return auth
    .silentLogin()
    .then((user) => {
      relogging = false;
      pending.forEach((p) => p.resolve(user));
      pending.length = 0;
      return user;
    })
    .catch((err) => {
      relogging = false;
      pending.forEach((p) => p.reject(err));
      pending.length = 0;
      throw err;
    });
}

/**
 * @param {object} options { url, method, data, header, loading, silent }
 * @returns {Promise<any>} 解析为后端 data 字段
 */
function request(options) {
  const opts = options || {};
  const showLoading = !!opts.loading;
  const silent = !!opts.silent;
  if (showLoading) {
    wx.showLoading({ title: opts.loadingText || '加载中', mask: true });
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + opts.url,
      method: (opts.method || 'GET').toUpperCase(),
      data: opts.data,
      header: buildHeader(opts.header),
      success(res) {
        if (showLoading) wx.hideLoading();
        const body = res.data;
        const code = body && body.code;
        // 成功
        if (res.statusCode >= 200 && res.statusCode < 300 && (code === 0 || code === undefined)) {
          resolve(body ? body.data : null);
          return;
        }
        // 401：静默重登后重试一次
        if (res.statusCode === 401 || code === 401) {
          if (!opts._retried) {
            silentRelogin()
              .then(() => {
                return request(Object.assign({}, opts, { _retried: true }));
              })
              .then(resolve)
              .catch((err) => {
                if (!silent) toastError((err && err.msg) || '登录已过期');
                try {
                  wx.reLaunch({ url: '/pages/index/index' });
                } catch (e) {}
                reject(err || { code: 401, msg: '登录已过期' });
              });
            return;
          }
          try {
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
          } catch (e) {}
          if (!silent) toastError((body && body.msg) || '登录已过期');
          reject(body || { code: 401, msg: '登录已过期' });
          return;
        }
        // 403 等业务错误
        const msg = (body && body.msg) || '请求失败';
        if (!silent) toastError(msg);
        reject(body || { code: res.statusCode, msg });
      },
      fail(err) {
        if (showLoading) wx.hideLoading();
        const msg = '网络异常，请检查后端服务';
        if (!silent) toastError(msg);
        reject({ code: -1, msg, raw: err });
      },
    });
  });
}

function get(url, data, options) {
  return request(Object.assign({ url, method: 'GET', data }, options));
}

function post(url, data, options) {
  return request(Object.assign({ url, method: 'POST', data }, options));
}

function put(url, data, options) {
  return request(Object.assign({ url, method: 'PUT', data }, options));
}

function patch(url, data, options) {
  return request(Object.assign({ url, method: 'PATCH', data }, options));
}

function del(url, data, options) {
  return request(Object.assign({ url, method: 'DELETE', data }, options));
}

module.exports = {
  BASE_URL,
  request,
  get,
  post,
  put,
  patch,
  del,
  getToken,
  silentRelogin,
};

const https = require('https');
const config = require('../config');

/**
 * 微信 code2session
 * 文档: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html
 */
function code2session(code) {
  const { appId, appSecret } = config.wechat;
  const url =
    'https://api.weixin.qq.com/sns/jscode2session' +
    `?appid=${encodeURIComponent(appId)}` +
    `&secret=${encodeURIComponent(appSecret)}` +
    `&js_code=${encodeURIComponent(code)}` +
    '&grant_type=authorization_code';

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (data.openid) {
            resolve({ openid: data.openid, sessionKey: data.session_key, unionid: data.unionid || null });
          } else {
            reject(new Error(data.errmsg || `code2session 失败 (${data.errcode})`));
          }
        } catch (e) {
          reject(new Error('code2session 响应解析失败'));
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('code2session 超时'));
    });
    req.on('error', reject);
  });
}

module.exports = { code2session };

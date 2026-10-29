const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'community-groupbuy-dev-secret-2026',
  jwtExpiresIn: '7d',
  dataFile: path.join(__dirname, 'data', 'db.json'),
  orderPayTimeoutMin: 30,

  // 微信小程序（AppSecret 只放服务端，建议用环境变量覆盖）
  wechat: {
    appId: process.env.WECHAT_APPID || 'wxa961eae1c6580e6a',
    appSecret: process.env.WECHAT_SECRET || '30564a9c33d436958c5ffcde522a8536',
  },
};

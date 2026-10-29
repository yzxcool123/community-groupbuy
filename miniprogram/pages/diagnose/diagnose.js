const appConfig = require('../../config');

Page({
  data: {
    env: appConfig.ENV,
    baseUrl: appConfig.BASE_URL,
    host: appConfig.current.host,
    networkType: '',
    testing: false,
    result: null,
    error: '',
    logs: [],
  },

  onLoad() {
    wx.getNetworkType({
      success: (res) => this.setData({ networkType: res.networkType }),
    });
  },

  addLog(text) {
    const time = new Date().toLocaleTimeString();
    this.setData({ logs: [`${time} ${text}`, ...this.data.logs].slice(0, 20) });
  },

  onTest() {
    if (this.data.testing) return;
    this.setData({ testing: true, result: null, error: '' });
    this.addLog('开始请求 ' + this.data.baseUrl + '/api/health');
    wx.request({
      url: this.data.baseUrl + '/api/health',
      method: 'GET',
      timeout: 8000,
      success: (res) => {
        this.addLog('HTTP ' + res.statusCode);
        this.setData({ result: res.data, testing: false });
      },
      fail: (err) => {
        this.addLog('失败: ' + (err.errMsg || 'unknown'));
        this.setData({ error: err.errMsg || '请求失败', testing: false });
      },
    });
  },

  onCopy() {
    wx.setClipboardData({
      data: `ENV=${this.data.env} BASE_URL=${this.data.baseUrl} network=${this.data.networkType}`,
    });
  },
});

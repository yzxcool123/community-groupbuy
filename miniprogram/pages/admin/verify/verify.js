const { post } = require('../../../utils/request');
const permission = require('../../../utils/permission');

const STATUS_TEXT = {
  unpaid: '待支付',
  paid: '待提货',
  ready: '待提货',
  verified: '已完成',
  cancelled: '已取消',
};

Page({
  data: {
    code: '',
    order: null,
    queryResult: null,
    verifying: false,
    result: null, // {ok, msg}
  },

  onShow() {
    permission.guardAdmin('order:verify');
  },

  onInput(e) {
    this.setData({ code: e.detail.value, result: null });
  },

  onClear() {
    this.setData({ code: '', queryResult: null, result: null });
  },

  scan() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const raw = res.result || res.path || '';
        const code = this.extractCode(raw);
        if (!code) {
          this.setData({ result: { ok: false, msg: '无法识别的二维码：' + raw } });
          return;
        }
        this.setData({ code });
        this.query();
      },
      fail: () => {
        this.setData({ result: { ok: false, msg: '扫码取消或失败' } });
      },
    });
  },

  /** 从扫码结果中提取核销码：支持纯码、path、URL query */
  extractCode(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    // 纯 VCxxx
    if (/^VC[A-Z0-9]+$/i.test(s)) return s.toUpperCase();
    // path 或 URL 中的 code=VCxxx
    const m =
      s.match(/code=([A-Za-z0-9]+)/i) ||
      s.match(/verifyCode=([A-Za-z0-9]+)/i) ||
      s.match(/(VC[A-Z0-9]{3,})/i);
    if (m) return m[1].toUpperCase();
    // 尾段
    const parts = s.split(/[/=?&#]/).filter(Boolean);
    const hit = parts.find((p) => /^VC[A-Z0-9]+$/i.test(p));
    return hit ? hit.toUpperCase() : '';
  },

  query() {
    const code = (this.data.code || '').trim().toUpperCase();
    if (!code) {
      this.setData({ result: { ok: false, msg: '请输入或扫描核销码' } });
      return;
    }
    this.setData({ verifying: true, result: null });
    post('/api/verify/query', { code }, { loading: true })
      .then((order) => {
        this.setData({
          verifying: false,
          queryResult: Object.assign({}, order, {
            statusText: STATUS_TEXT[order.status] || order.status,
          }),
          result: { ok: true, msg: '核销码有效，请确认核销' },
        });
      })
      .catch((err) => {
        this.setData({
          verifying: false,
          queryResult: null,
          result: { ok: false, msg: (err && err.msg) || '核销码无效' },
        });
      });
  },

  confirmVerify() {
    const { code, queryResult } = this.data;
    if (!queryResult) {
      wx.showToast({ title: '请先查询核销码', icon: 'none' });
      return;
    }
    if (queryResult.status === 'verified') {
      this.setData({ result: { ok: false, msg: '该订单已核销' } });
      return;
    }
    wx.showModal({
      title: '确认核销',
      content: '确认为订单 ' + queryResult.orderNo + ' 核销提货吗？',
      success: (res) => {
        if (!res.confirm) return;
        post('/api/verify', { code: code.trim().toUpperCase() }, { loading: true })
          .then((order) => {
            this.setData({
              queryResult: Object.assign({}, order, {
                statusText: STATUS_TEXT[order.status] || order.status,
              }),
              result: { ok: true, msg: '核销成功！' },
            });
            wx.showToast({ title: '核销成功', icon: 'success' });
          })
          .catch((err) => {
            this.setData({
              result: { ok: false, msg: (err && err.msg) || '核销失败' },
            });
          });
      },
    });
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/order/order' });
  },
});

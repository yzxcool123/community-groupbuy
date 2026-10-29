const { get, post } = require('../../utils/request');
const { attachBarReady } = require('../../utils/bar');

const STATUS_TEXT = {
  unpaid: '待支付',
  paid: '待提货',
  ready: '待提货',
  verified: '已完成',
  cancelled: '已取消',
};

const STATUS_CLS = {
  unpaid: 'badge-warning',
  paid: 'badge-primary',
  ready: 'badge-primary',
  verified: 'badge-muted',
  cancelled: 'badge-muted',
};

Page(attachBarReady({
  data: {
    id: '',
    order: null,
    loading: true,
    verifyInfo: null,
    showCode: false,
    statusText: '',
    statusCls: '',
  },

  onLoad(options) {
    this.setData({
      id: options.id || '',
      showCode: options.showCode === '1',
    });
    this.fetch();
  },

  fetch() {
    const id = this.data.id;
    if (!id) {
      this.setData({ loading: false });
      return;
    }
    get('/api/orders/' + id)
      .then((o) => {
        this.setData({
          order: o,
          loading: false,
          statusText: STATUS_TEXT[o.status] || o.status,
          statusCls: STATUS_CLS[o.status] || 'badge-muted',
        });
        this.loadVerifyCode();
      })
      .catch(() => this.setData({ loading: false }));
  },

  loadVerifyCode() {
    const id = this.data.id;
    get('/api/orders/' + id + '/verify-code', null, { silent: true })
      .then((info) => {
        this.setData({ verifyInfo: info });
      })
      .catch(() => {});
  },

  copyCode() {
    const info = this.data.verifyInfo;
    if (!info || !info.code) return;
    wx.setClipboardData({
      data: info.code,
      success: () => wx.showToast({ title: '核销码已复制', icon: 'success' }),
    });
  },

  copyOrderNo() {
    const o = this.data.order;
    if (!o) return;
    wx.setClipboardData({
      data: o.orderNo,
      success: () => wx.showToast({ title: '订单号已复制', icon: 'success' }),
    });
  },

  onPay() {
    post('/api/orders/' + this.data.id + '/mock-pay', {}, { loading: true })
      .then(() => {
        wx.showToast({ title: '支付成功', icon: 'success' });
        this.fetch();
      })
      .catch(() => {});
  },

  onCancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          post('/api/orders/' + this.data.id + '/cancel', {}, { loading: true })
            .then(() => {
              wx.showToast({ title: '已取消', icon: 'success' });
              this.fetch();
            })
            .catch(() => {});
        }
      },
    });
  },

  goOrders() {
    wx.redirectTo({ url: '/pages/order/order' });
  },
}));

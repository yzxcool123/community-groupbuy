const { post, get } = require('../../utils/request');

Page({
  data: {
    orderId: '',
    orderNo: '',
    status: 'paying', // paying | success | fail
    payMsg: '',
    orderStatus: '',
    payMode: 'online',
    fulfillment: 'pickup',
  },

  onLoad(options) {
    const orderId = options.orderId || '';
    const orderNo = options.orderNo ? decodeURIComponent(options.orderNo) : '';
    const payMode = options.payMode === 'cod' ? 'cod' : 'online';
    this.setData({ orderId, orderNo, payMode });

    if (!orderId) {
      this.setData({ status: 'fail', payMsg: '订单不存在' });
      return;
    }

    if (payMode === 'cod') {
      // 到店付款：无需在线支付
      this.setData({
        status: 'success',
        orderStatus: 'ready',
        payMsg: '下单成功，请到店取货时付款',
      });
      return;
    }

    this.mockPay();
  },

  mockPay() {
    this.setData({ status: 'paying' });
    post('/api/orders/' + this.data.orderId + '/mock-pay', {})
      .then((order) => {
        this.setData({
          status: 'success',
          orderStatus: order.status || 'ready',
          fulfillment: order.fulfillment || 'pickup',
          payMsg:
            order.fulfillment === 'delivery'
              ? '支付成功，备货后送货上门'
              : '支付成功，可凭核销码到自提点取货',
        });
      })
      .catch((err) => {
        this.setData({
          status: 'fail',
          payMsg: (err && err.msg) || '支付失败，请稍后重试',
        });
      });
  },

  goOrderDetail() {
    wx.redirectTo({ url: '/pages/order-detail/order-detail?id=' + this.data.orderId });
  },

  goVerifyCode() {
    wx.redirectTo({ url: '/pages/order-detail/order-detail?id=' + this.data.orderId + '&showCode=1' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  goOrders() {
    wx.redirectTo({ url: '/pages/order/order' });
  },

  retry() {
    this.mockPay();
  },
});

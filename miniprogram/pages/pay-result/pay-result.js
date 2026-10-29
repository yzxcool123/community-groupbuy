const { post } = require('../../utils/request');

function buildSuccessUi(payMode, fulfillment, orderStatus) {
  const isDelivery = fulfillment === 'delivery';
  const isCod = payMode === 'cod';
  let statusBadgeText = '待提货';
  if (isDelivery) statusBadgeText = '待配送';
  else if (isCod) statusBadgeText = '待取货';
  else if (orderStatus === 'paid') statusBadgeText = '待提货';

  const fulfillmentText = isDelivery ? '送货上门' : '到店自提';
  let cardTip = isDelivery
    ? '备货后将按收货地址配送，请保持手机畅通'
    : isCod
      ? '到店取货时付款，凭核销码核销提货'
      : '凭订单核销码到所选自提点取货';

  let payMsg = isCod
    ? isDelivery
      ? '下单成功，备货后送货上门'
      : '下单成功，请到店取货时付款'
    : isDelivery
      ? '支付成功，备货后送货上门'
      : '支付成功，可凭核销码到自提点取货';

  return {
    resultTitle: isCod ? '下单成功' : '支付成功',
    statusBadgeText,
    fulfillmentText,
    cardTip,
    payMsg,
    showVerifyCodeBtn: !isDelivery,
  };
}

Page({
  data: {
    orderId: '',
    orderNo: '',
    status: 'paying', // paying | success | fail
    payMsg: '',
    orderStatus: '',
    payMode: 'online',
    fulfillment: 'pickup',
    resultTitle: '支付成功',
    statusBadgeText: '待提货',
    fulfillmentText: '到店自提',
    cardTip: '',
    showVerifyCodeBtn: true,
  },

  onLoad(options) {
    const orderId = options.orderId || '';
    const orderNo = options.orderNo ? decodeURIComponent(options.orderNo) : '';
    const payMode = options.payMode === 'cod' ? 'cod' : 'online';
    const fulfillment = options.fulfillment === 'delivery' ? 'delivery' : 'pickup';
    this.setData({ orderId, orderNo, payMode, fulfillment });

    if (!orderId) {
      this.setData({ status: 'fail', payMsg: '订单不存在' });
      return;
    }

    if (payMode === 'cod') {
      const ui = buildSuccessUi('cod', fulfillment, 'ready');
      this.setData(
        Object.assign(
          {
            status: 'success',
            orderStatus: 'ready',
          },
          ui
        )
      );
      return;
    }

    this.mockPay();
  },

  mockPay() {
    this.setData({ status: 'paying' });
    post('/api/orders/' + this.data.orderId + '/mock-pay', {})
      .then((order) => {
        const fulfillment = order.fulfillment || this.data.fulfillment || 'pickup';
        const orderStatus = order.status || 'ready';
        const ui = buildSuccessUi('online', fulfillment, orderStatus);
        this.setData(
          Object.assign(
            {
              status: 'success',
              orderStatus,
              fulfillment,
            },
            ui
          )
        );
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

const { get, post } = require('../../utils/request');
const cart = require('../../utils/cart');
const addressBook = require('../../utils/address');
const { attachBarReady } = require('../../utils/bar');

Page(attachBarReady({
  data: {
    mode: 'cart', // cart | buy
    items: [],
    fulfillment: 'pickup', // pickup | delivery
    payMode: 'online', // online | cod
    pickupPoints: [],
    pickupIndex: -1,
    pickupPointId: '',
    selectedAddress: null,
    addressList: [],
    remark: '',
    totalAmount: '0.00',
    totalCount: 0,
    submitting: false,
    canSubmit: false,
  },

  onLoad(options) {
    this.setData({ mode: options.mode === 'buy' ? 'buy' : 'cart' });
    this.loadItems();
    this.loadPickup();
    this.loadAddresses();
  },

  onShow() {
    // 从地址管理返回时刷新
    this.loadAddresses();
  },

  loadAddresses() {
    const list = addressBook.getAll();
    const prev = this.data.selectedAddress;
    let selected = list.find((a) => a.id === (prev && prev.id)) || addressBook.getDefault();
    this.setData({ addressList: list, selectedAddress: selected });
    this.checkCanSubmit();
  },

  loadItems() {
    const { mode } = this.data;
    let items = [];
    if (mode === 'buy') {
      const one = cart.takeBuyNow();
      if (one) items = [one];
    } else {
      items = cart.getChecked();
    }
    const total = items.reduce((a, i) => a + Number(i.price) * i.qty, 0);
    const count = items.reduce((a, i) => a + i.qty, 0);
    this.setData({
      items,
      totalAmount: total.toFixed(2),
      totalCount: count,
    });
    this.checkCanSubmit();
    if (!items.length) {
      wx.showToast({ title: '没有待结算商品', icon: 'none' });
    }
  },

  loadPickup() {
    get('/api/products/pickup-points')
      .then((list) => {
        const points = list || [];
        let pickupIndex = this.data.pickupIndex;
        if (pickupIndex < 0 && points.length) pickupIndex = 0;
        this.setData({
          pickupPoints: points,
          pickupIndex,
          pickupPointId: points[pickupIndex] ? points[pickupIndex].id : '',
        });
        this.checkCanSubmit();
      })
      .catch(() => {});
  },

  onFulfillChange(e) {
    const type = e.currentTarget.dataset.type || 'pickup';
    // 送货上门强制在线支付；自提可切换付款方式
    this.setData({
      fulfillment: type,
      payMode: type === 'delivery' ? 'online' : this.data.payMode === 'cod' ? 'cod' : 'online',
    });
    this.checkCanSubmit();
  },

  onPayModeChange(e) {
    const type = e.currentTarget.dataset.type || 'online';
    // 送货不能到店付
    if (this.data.fulfillment === 'delivery' && type === 'cod') {
      wx.showToast({ title: '送货上门需在线支付', icon: 'none' });
      return;
    }
    this.setData({ payMode: type });
    this.checkCanSubmit();
  },

  onChangeAddress() {
    const list = this.data.addressList || [];
    if (!list.length) {
      this.goAddressManage();
      return;
    }
    wx.showActionSheet({
      itemList: list.map((a) => `${a.community} ${a.building} ${a.room}`.slice(0, 22)),
      success: (res) => {
        const a = list[res.tapIndex];
        if (a) {
          this.setData({ selectedAddress: a });
          this.checkCanSubmit();
        }
      },
    });
  },

  goAddressManage() {
    wx.navigateTo({ url: '/pages/address/address' });
  },

  checkCanSubmit() {
    const { items, fulfillment, pickupPointId, selectedAddress, submitting } = this.data;
    let ok = items.length > 0 && !submitting;
    if (fulfillment === 'pickup') {
      ok = ok && !!pickupPointId;
    } else {
      ok = ok && !!selectedAddress;
    }
    this.setData({ canSubmit: ok });
  },

  onPickupChange(e) {
    const idx = Number(e.detail.value);
    const p = this.data.pickupPoints[idx];
    this.setData({
      pickupIndex: idx,
      pickupPointId: p ? p.id : '',
    });
    this.checkCanSubmit();
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  submit() {
    const { items, fulfillment, pickupPointId, selectedAddress, remark, submitting, mode } = this.data;
    if (submitting) return;
    if (!items.length) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }

    const payload = {
      items: items.map((i) => ({ skuId: i.skuId, qty: i.qty })),
      fulfillment,
      payMode: fulfillment === 'delivery' ? 'online' : this.data.payMode,
      remark: remark || '',
    };

    if (fulfillment === 'pickup') {
      if (!pickupPointId) {
        wx.showToast({ title: '请选择自提点', icon: 'none' });
        return;
      }
      payload.pickupPointId = pickupPointId;
    } else {
      if (!selectedAddress) {
        wx.showToast({ title: '请选择收货地址', icon: 'none' });
        return;
      }
      payload.deliveryAddress = {
        community: selectedAddress.community,
        building: selectedAddress.building,
        room: selectedAddress.room,
        contactName: selectedAddress.contactName,
        contactPhone: selectedAddress.contactPhone,
      };
    }

    this.setData({ submitting: true });
    post('/api/orders', payload)
      .then((order) => {
        if (mode === 'cart') cart.clearChecked();
        else cart.clearBuyNow();
        wx.redirectTo({
          url:
            '/pages/pay-result/pay-result?orderId=' +
            order.id +
            '&orderNo=' +
            encodeURIComponent(order.orderNo || '') +
            '&payMode=' +
            (order.payMode || payload.payMode),
        });
      })
      .catch(() => {
        this.setData({ submitting: false });
        this.checkCanSubmit();
      });
  },
}));

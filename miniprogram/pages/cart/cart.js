const cart = require('../../utils/cart');

Page({
  data: {
    list: [],
    allChecked: true,
    totalAmount: '0.00',
    checkedCount: 0,
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const list = cart.getAll();
    this.setData({ list });
    this.calc();
  },

  calc() {
    const { list } = this.data;
    const checked = list.filter((i) => i.checked);
    const total = checked.reduce((a, i) => a + Number(i.price) * i.qty, 0);
    this.setData({
      totalAmount: total.toFixed(2),
      checkedCount: checked.reduce((a, i) => a + i.qty, 0),
      allChecked: list.length > 0 && checked.length === list.length,
    });
  },

  onToggle(e) {
    const { skuid } = e.currentTarget.dataset;
    const item = this.data.list.find((i) => i.skuId === skuid);
    if (!item) return;
    this.setData({ list: cart.toggleCheck(skuid, !item.checked) });
    this.calc();
  },

  onToggleAll() {
    this.setData({ list: cart.toggleAll(!this.data.allChecked) });
    this.calc();
  },

  onMinus(e) {
    const { skuid, qty } = e.currentTarget.dataset;
    if (qty <= 1) return;
    this.setData({ list: cart.updateQty(skuid, qty - 1) });
    this.calc();
  },

  onPlus(e) {
    const { skuid, qty } = e.currentTarget.dataset;
    this.setData({ list: cart.updateQty(skuid, qty + 1) });
    this.calc();
  },

  onRemove(e) {
    const { skuid } = e.currentTarget.dataset;
    wx.showModal({
      title: '提示',
      content: '确定移除该商品吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ list: cart.remove(skuid) });
          this.calc();
        }
      },
    });
  },

  goShopping() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onProductTap(e) {
    const { pid } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/product/product?id=' + pid });
  },

  checkout() {
    const checked = cart.getChecked();
    if (!checked.length) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/checkout/checkout?mode=cart' });
  },
});

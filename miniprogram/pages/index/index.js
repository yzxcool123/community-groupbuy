const { get } = require('../../utils/request');

Page({
  data: {
    hotList: [],
    allList: [],
    loading: true,
  },

  onLoad() {
    this.fetchAll();
  },

  onPullDownRefresh() {
    this.fetchAll().finally(() => wx.stopPullDownRefresh());
  },

  fetchAll() {
    this.setData({ loading: true });
    return Promise.all([
      get('/api/products/hot-today', null, { silent: true }).catch(() => ({ list: [] })),
      get('/api/products', { pageSize: 20, page: 1 }, { silent: true }).catch(() => ({ list: [] })),
    ]).then(([hot, all]) => {
      this.setData({
        hotList: (hot && hot.list) || [],
        allList: (all && all.list) || [],
        loading: false,
      });
    });
  },

  onProductTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/product/product?id=' + id });
  },

  goCategory() {
    wx.switchTab({ url: '/pages/category/category' });
  },
});

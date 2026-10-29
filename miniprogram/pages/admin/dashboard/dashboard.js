const { get } = require('../../../utils/request');
const permission = require('../../../utils/permission');

Page({
  data: {
    stats: null,
    loading: true,
    quickLinks: [
      { icon: '📦', label: '商品管理', url: '/pages/admin/products/products', perm: 'product:write' },
      { icon: '✅', label: '核销提货', url: '/pages/admin/verify/verify', perm: 'order:verify' },
      { icon: '🛒', label: '团购首页', url: '/pages/index/index', perm: '' },
      { icon: '📋', label: '我的订单', url: '/pages/order/order', perm: '' },
    ],
  },

  onShow() {
    // 无任何管理权限则拦截并回首页
    if (!permission.guardAdmin()) return;
    this.load();
  },

  load() {
    this.setData({ loading: true });
    get('/api/admin/stats', null, { silent: true })
      .then((stats) => {
        const days = (stats && stats.days) || [];
        const maxGmv = Math.max(1, ...days.map((d) => d.gmv || 0));
        const bars = days.map((d) =>
          Object.assign({}, d, {
            height: Math.max(8, Math.round(((d.gmv || 0) / maxGmv) * 120)),
            gmvText: (d.gmv || 0).toFixed(1),
          })
        );
        this.setData({
          stats: Object.assign({}, stats, { bars }),
          loading: false,
        });
      })
      .catch((err) => {
        this.setData({ loading: false });
        if (err && err.code === 403) {
          wx.showToast({ title: '暂无看板权限', icon: 'none' });
        }
      });
  },

  onQuickTap(e) {
    const { url, perm } = e.currentTarget.dataset;
    if (perm && !permission.hasPermission(perm) && !permission.hasPermission('product:admin')) {
      wx.showToast({ title: '暂无权限', icon: 'none' });
      return;
    }
    if (url.indexOf('/pages/index/') === 0 || url.indexOf('/pages/cart/') === 0 || url.indexOf('/pages/mine/') === 0 || url.indexOf('/pages/category/') === 0) {
      wx.switchTab({ url });
    } else {
      wx.navigateTo({ url });
    }
  },

  goProducts() {
    wx.navigateTo({ url: '/pages/admin/products/products' });
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/admin/verify/verify' });
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },
});

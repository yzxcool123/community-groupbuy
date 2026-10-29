const auth = require('../../utils/auth');
const permission = require('../../utils/permission');
const appConfig = require('../../config');

const app = getApp();

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    canAdmin: false,
    isStaff: false,
    orderStats: [
      { key: 'unpaid', label: '待支付', icon: '💰' },
      { key: 'ready', label: '待提货', icon: '📦' },
      { key: 'verified', label: '已完成', icon: '✅' },
      { key: '', label: '全部订单', icon: '📋' },
    ],
  },

  onShow() {
    this.syncUser();
    this.refreshUser();
  },

  syncUser() {
    const user = app.globalData.userInfo || auth.getUserInfo();
    this.setData({
      userInfo: user,
      isLoggedIn: !!user,
      canAdmin: permission.canEnterAdmin(),
      isStaff: permission.isStaffOrAdmin(),
    });
  },

  refreshUser() {
    if (!auth.getToken()) return;
    app
      .refreshMe()
      .then(() => this.syncUser())
      .catch(() => {});
  },

  onLoginTap() {
    auth
      .silentLogin()
      .then((user) => {
        app.setSession(user);
        this.syncUser();
        wx.showToast({ title: '登录成功', icon: 'success' });
      })
      .catch(() => {});
  },

  goOrders(e) {
    const status = e.currentTarget.dataset.status;
    wx.navigateTo({ url: '/pages/order/order?status=' + (status || '') });
  },

  goAdmin() {
    if (!permission.canEnterAdmin()) {
      wx.showToast({ title: '暂无管理权限', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/admin/dashboard/dashboard' });
  },

  goAdminProducts() {
    if (!permission.hasPermission('product:write')) {
      wx.showToast({ title: '暂无上货权限', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/admin/products/products' });
  },

  goAdminVerify() {
    if (!permission.hasPermission('order:verify')) {
      wx.showToast({ title: '暂无核销权限', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/admin/verify/verify' });
  },

  goAddress() {
    wx.navigateTo({ url: '/pages/address/address' });
  },

  goDiagnose() {
    wx.navigateTo({ url: '/pages/diagnose/diagnose' });
  },

  goService() {
    wx.showToast({ title: '客服开发中', icon: 'none' });
  },

  goAbout() {
    wx.showModal({
      title: '社区团购',
      content: '预售 + 自提 社区团购 MVP\n后端 API: ' + appConfig.BASE_URL,
      showCancel: false,
    });
  },
});

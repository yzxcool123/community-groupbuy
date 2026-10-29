const auth = require('./utils/auth');
const cart = require('./utils/cart');
const appConfig = require('./config');

App({
  globalData: {
    userInfo: null,
    permissions: [],
    roles: [],
    statusBarHeight: 20,
  },

  onLaunch() {
    console.log(`[ENV] ${appConfig.ENV} → ${appConfig.BASE_URL}`);
    try {
      const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.globalData.statusBarHeight = sys.statusBarHeight || 20;
    } catch (e) {
      // ignore
    }
    // 启动同步一次购物车角标
    cart.updateTabBadge();
    this.bootstrap();
  },

  onShow() {
    cart.updateTabBadge();
  },

  /** 启动：静默登录并刷新权限 */
  bootstrap() {
    auth
      .ensureLogin()
      .then((user) => {
        this.setSession(user);
      })
      .catch(() => {
        // 网络失败不阻塞页面
      });
  },

  /** 写入全局会话 */
  setSession(user) {
    if (!user) return;
    this.globalData.userInfo = user;
    this.globalData.permissions = user.permissions || [];
    this.globalData.roles = user.roles || [];
    auth.setUserInfo(user);
  },

  /** 重新拉取 /api/auth/me 刷新权限 */
  refreshMe() {
    return auth.fetchMe().then((user) => {
      this.setSession(user);
      return user;
    });
  },
});

/**
 * 底栏入场：页面转场结束后再显示 footer-bar，避免与原生 tabBar 抢帧。
 * 用法：在 Page({ ...}) 后调用 attachBarReady(pageOptions) 或在 methods 中混合。
 */
function attachBarReady(options) {
  const prevReady = options.onReady;
  const prevUnload = options.onUnload;
  options.data = Object.assign({ barReady: false }, options.data || {});
  options.onReady = function (...args) {
    clearTimeout(this._barTimer);
    this._barTimer = setTimeout(() => {
      this.setData({ barReady: true });
    }, 280);
    if (prevReady) prevReady.apply(this, args);
  };
  options.onUnload = function (...args) {
    clearTimeout(this._barTimer);
    if (prevUnload) prevUnload.apply(this, args);
  };
  return options;
}

module.exports = { attachBarReady };

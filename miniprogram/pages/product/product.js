const { get } = require('../../utils/request');
const cart = require('../../utils/cart');

Page({
  data: {
    id: '',
    product: null,
    images: [],
    loading: true,
    showSku: false,
    actionType: 'cart', // cart | buy
    selectedSkuIndex: 0,
    buyQty: 1,
    cartCount: 0,
    displayPrice: '',
    displayLinePrice: '',
    barReady: false,
  },

  onLoad(options) {
    this.setData({ id: options.id || '' });
    this.fetch();
  },

  onReady() {
    // 等页面转场结束后再浮出底栏，避免与原生 tabBar 抢帧
    clearTimeout(this._barTimer);
    this._barTimer = setTimeout(() => {
      this.setData({ barReady: true });
    }, 280);
  },

  onUnload() {
    clearTimeout(this._barTimer);
  },

  onShow() {
    this.setData({ cartCount: cart.getCount() });
  },

  fetch() {
    const id = this.data.id;
    if (!id) {
      this.setData({ loading: false });
      return;
    }
    get('/api/products/' + id)
      .then((p) => {
        const skus = p.skus || [];
        this.setData({
          product: p,
          images: (p.images && p.images.length ? p.images : [p.cover]).filter(Boolean),
          loading: false,
          selectedSkuIndex: 0,
          buyQty: 1,
        });
        this.refreshPrice();
        wx.setNavigationBarTitle({ title: p.title || '商品详情' });
      })
      .catch(() => this.setData({ loading: false }));
  },

  refreshPrice() {
    const { product, selectedSkuIndex } = this.data;
    if (!product) return;
    const skus = product.skus || [];
    const sku = skus[selectedSkuIndex];
    const base = product.activityPrice != null ? product.activityPrice : sku ? sku.price : product.minPrice;
    const line = sku && sku.linePrice != null ? sku.linePrice : sku ? sku.price : null;
    this.setData({
      displayPrice: base != null ? Number(base).toFixed(2) : '—',
      displayLinePrice: line != null && Number(line) > Number(base) ? Number(line).toFixed(2) : '',
    });
  },

  openSku(e) {
    const type = e.currentTarget.dataset.type || 'cart';
    this.setData({ showSku: true, actionType: type });
  },

  closeSku() {
    this.setData({ showSku: false });
  },

  noop() {},

  onSkuSelect(e) {
    this.setData({ selectedSkuIndex: Number(e.currentTarget.dataset.index) || 0 });
    this.refreshPrice();
  },

  onQtyMinus() {
    if (this.data.buyQty <= 1) return;
    this.setData({ buyQty: this.data.buyQty - 1 });
  },

  onQtyPlus() {
    const { product, selectedSkuIndex, buyQty } = this.data;
    const sku = (product && product.skus && product.skus[selectedSkuIndex]) || null;
    const stock = sku ? sku.stock : 99;
    if (buyQty >= stock) {
      wx.showToast({ title: '已达库存上限', icon: 'none' });
      return;
    }
    this.setData({ buyQty: buyQty + 1 });
  },

  confirmSku() {
    const { product, selectedSkuIndex, buyQty, actionType } = this.data;
    const skus = (product && product.skus) || [];
    const sku = skus[selectedSkuIndex];
    if (!sku) {
      wx.showToast({ title: '请选择规格', icon: 'none' });
      return;
    }
    if (sku.stock <= 0) {
      wx.showToast({ title: '该规格已售罄', icon: 'none' });
      return;
    }
    const item = {
      skuId: sku.id,
      productId: product.id,
      title: product.title,
      cover: sku.image || product.cover,
      skuName: sku.name,
      skuSpec: sku.spec || '',
      price: product.activityPrice != null ? Number(product.activityPrice) : Number(sku.price),
      linePrice: sku.linePrice != null ? Number(sku.linePrice) : null,
      qty: buyQty,
      checked: true,
    };

    if (actionType === 'cart') {
      cart.add(item);
      this.setData({ showSku: false, cartCount: cart.getCount() });
      wx.showToast({ title: '已加入购物车', icon: 'success' });
    } else {
      // 立即购买：临时单件写入结算通道
      cart.setBuyNow(item);
      this.setData({ showSku: false });
      wx.navigateTo({ url: '/pages/checkout/checkout?mode=buy' });
    }
  },

  goCart() {
    wx.switchTab({ url: '/pages/cart/cart' });
  },
});

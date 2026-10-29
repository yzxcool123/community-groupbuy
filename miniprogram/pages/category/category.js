const { get } = require('../../utils/request');

Page({
  data: {
    categories: [],
    products: [],
    activeId: '',
    keyword: '',
    loading: true,
    focus: false,
  },

  onLoad(options) {
    if (options.categoryId) this._pendingId = options.categoryId;
    if (options.focus) this.setData({ focus: true });
    this.init();
  },

  onShow() {
    if (this._inited) this.loadProducts();
  },

  init() {
    this._inited = true;
    get('/api/categories')
      .then((list) => {
        const categories = list || [];
        let activeId = this._pendingId || (categories[0] && categories[0].id) || '';
        if (this._pendingId) {
          const found = categories.find((c) => c.id === this._pendingId);
          if (!found) activeId = (categories[0] && categories[0].id) || '';
        }
        this.setData({ categories, activeId });
        this.loadProducts();
      })
      .catch(() => {
        this.setData({ loading: false });
      });
  },

  loadProducts() {
    const { activeId, keyword } = this.data;
    this.setData({ loading: true });
    const params = { pageSize: 50, page: 1 };
    if (activeId) params.categoryId = activeId;
    if (keyword) params.keyword = keyword;
    return get('/api/products', params)
      .then((res) => {
        this.setData({
          products: (res && res.list) || [],
          loading: false,
        });
      })
      .catch(() => this.setData({ loading: false, products: [] }));
  },

  onCatTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.activeId) return;
    this.setData({ activeId: id });
    this.loadProducts();
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearchConfirm() {
    this.loadProducts();
  },

  onSearchClear() {
    // 受控 input 偶发不刷新：先失焦再清空，必要时二次 setData
    this.setData({ keyword: '', focus: false });
    setTimeout(() => {
      this.setData({ keyword: '' });
      this.loadProducts();
    }, 10);
  },

  onProductTap(e) {
    wx.navigateTo({ url: '/pages/product/product?id=' + e.currentTarget.dataset.id });
  },
});

const { get, post, put, del } = require('../../../utils/request');
const permission = require('../../../utils/permission');
const { attachBarReady } = require('../../../utils/bar');

const STATUS_TABS = [
  { key: 'on', label: '在售' },
  { key: 'off', label: '已下架' },
];

Page(attachBarReady({
  data: {
    tabs: STATUS_TABS,
    activeTab: 'on',
    list: [],
    loading: true,
    // 分类管理
    showCat: false,
    categories: [],
    catLoading: false,
    newCatName: '',
    newCatIcon: '',
  },

  onShow() {
    if (!permission.guardAdmin('product:write')) return;
    this.load();
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key });
    this.load();
  },

  load() {
    const { activeTab } = this.data;
    this.setData({ loading: true });
    get('/api/products', { status: activeTab, pageSize: 100, page: 1 }, { silent: true })
      .then((res) => {
        this.setData({
          list: (res && res.list) || [],
          loading: false,
        });
      })
      .catch(() => this.setData({ list: [], loading: false }));
  },

  onToggleStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    const next = status === 'on' ? 'off' : 'on';
    const tip = next === 'off' ? '确定下架该商品吗？' : '确定上架该商品吗？';
    wx.showModal({
      title: '上下架',
      content: tip,
      success: (res) => {
        if (!res.confirm) return;
        post('/api/products/' + id + '/status', { status: next }, { loading: true })
          .then(() => {
            wx.showToast({ title: next === 'on' ? '已上架' : '已下架', icon: 'success' });
            this.load();
          })
          .catch(() => {});
      },
    });
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/product-edit/product-edit?id=' + id });
  },

  onCreate() {
    wx.navigateTo({ url: '/pages/admin/product-edit/product-edit' });
  },

  noop() {},

  /* ========== 分类管理 ========== */
  onOpenCats() {
    this.setData({ showCat: true });
    this.loadCats();
  },

  onCloseCats() {
    this.setData({ showCat: false });
    this.load();
  },

  loadCats() {
    this.setData({ catLoading: true });
    get('/api/admin/categories', {}, { silent: true })
      .then((list) => this.setData({ categories: list || [], catLoading: false }))
      .catch(() => this.setData({ categories: [], catLoading: false }));
  },

  onNewCatName(e) {
    this.setData({ newCatName: e.detail.value });
  },

  onNewCatIcon(e) {
    this.setData({ newCatIcon: e.detail.value });
  },

  onAddCat() {
    const name = (this.data.newCatName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }
    post('/api/admin/categories', { name, icon: this.data.newCatIcon || '' }, { loading: true })
      .then(() => {
        wx.showToast({ title: '已添加', icon: 'success' });
        this.setData({ newCatName: '', newCatIcon: '' });
        this.loadCats();
      })
      .catch(() => {});
  },

  onCatField(e) {
    const { id, f } = e.currentTarget.dataset;
    const list = this.data.categories.map((c) => (c.id === id ? { ...c, [f]: e.detail.value } : c));
    this.setData({ categories: list });
  },

  onSaveCat(e) {
    const id = e.currentTarget.dataset.id;
    const cat = this.data.categories.find((c) => c.id === id);
    if (!cat) return;
    put('/api/admin/categories/' + id, {
      name: cat.name,
      icon: cat.icon || '',
      sort: Number(cat.sort) || 0,
      status: cat.status || 'on',
    }, { loading: true })
      .then(() => wx.showToast({ title: '已保存', icon: 'success' }))
      .catch(() => {});
  },

  onCatStatusToggle(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.categories.map((c) => {
      if (c.id !== id) return c;
      const next = c.status === 'disabled' ? 'on' : 'disabled';
      return { ...c, status: next };
    });
    this.setData({ categories: list });
  },

  onDeleteCat(e) {
    const id = e.currentTarget.dataset.id;
    const cat = this.data.categories.find((c) => c.id === id);
    if (!cat) return;
    wx.showModal({
      title: '删除分类',
      content: `确认删除「${cat.name}」？分类下有商品时无法删除。`,
      success: (res) => {
        if (!res.confirm) return;
        del('/api/admin/categories/' + id, {}, { loading: true })
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadCats();
          })
          .catch(() => {});
      },
    });
  },
}));

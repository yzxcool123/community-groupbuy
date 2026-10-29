const { get, post, put } = require('../../../utils/request');
const permission = require('../../../utils/permission');
const { attachBarReady } = require('../../../utils/bar');

const SALE_TYPES = [
  { key: 'spot', label: '现货' },
  { key: 'presale', label: '预售' },
  { key: 'mixed', label: '预售+现货' },
];

Page(attachBarReady({
  data: {
    id: '',
    isEdit: false,
    saleTypes: SALE_TYPES,
    categories: [],
    categoryIndex: 0,
    form: {
      title: '',
      cover: '',
      images: '',
      detail: '',
      status: 'on',
      saleType: 'spot',
      isHot: false,
      pickupOnly: true,
    },
    skus: [{ name: '默认', spec: '', price: '', stock: '' }],
    saving: false,
  },

  onLoad(options) {
    if (!permission.guardAdmin('product:write')) return;
    const id = options.id || '';
    this.setData({ id, isEdit: !!id });
    if (id) {
      wx.setNavigationBarTitle({ title: '编辑商品' });
      this.loadProduct(id);
    } else {
      wx.setNavigationBarTitle({ title: '新建商品' });
    }
    this.loadCategories();
  },

  loadCategories() {
    get('/api/categories', null, { silent: true })
      .then((list) => {
        const categories = list || [];
        let categoryIndex = this.data.categoryIndex;
        const wantId = this.data._categoryId;
        if (wantId) {
          const idx = categories.findIndex((c) => c.id === wantId);
          if (idx >= 0) categoryIndex = idx;
        }
        this.setData({ categories, categoryIndex });
      })
      .catch(() => {});
  },

  loadProduct(id) {
    get('/api/products/' + id, null, { silent: true })
      .then((p) => {
        const cats = this.data.categories;
        let categoryIndex = cats.findIndex((c) => c.id === p.categoryId);
        const skus = (p.skus || []).map((s) => ({
          id: s.id,
          name: s.name,
          spec: s.spec || '',
          price: String(s.price),
          stock: String(s.stock),
          linePrice: s.linePrice != null ? String(s.linePrice) : '',
        }));
        this.setData({
          form: {
            title: p.title || '',
            cover: p.cover || '',
            images: (p.images || []).join('\n'),
            detail: p.detail || '',
            status: p.status || 'on',
            saleType: p.saleType || 'spot',
            isHot: !!p.isHot,
            pickupOnly: !!p.pickupOnly,
          },
          skus: skus.length ? skus : [{ name: '默认', spec: '', price: '', stock: '' }],
          categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
          _categoryId: p.categoryId || null,
        });
      })
      .catch(() => {});
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onStatusChange(e) {
    this.setData({ 'form.status': e.detail.value ? 'on' : 'off' });
  },

  onSaleTypeTap(e) {
    this.setData({ 'form.saleType': e.currentTarget.dataset.key });
  },

  onHotChange(e) {
    this.setData({ 'form.isHot': e.detail.value });
  },

  onPickupChange(e) {
    this.setData({ 'form.pickupOnly': e.detail.value });
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) });
  },

  onSkuInput(e) {
    const { index, field } = e.currentTarget.dataset;
    this.setData({ ['skus[' + index + '].' + field]: e.detail.value });
  },

  addSku() {
    const skus = this.data.skus.concat([{ name: '', spec: '', price: '', stock: '' }]);
    this.setData({ skus });
  },

  removeSku(e) {
    const index = e.currentTarget.dataset.index;
    if (this.data.skus.length <= 1) {
      wx.showToast({ title: '至少保留一个规格', icon: 'none' });
      return;
    }
    const skus = this.data.skus.slice();
    skus.splice(index, 1);
    this.setData({ skus });
  },

  save() {
    const { form, skus, categories, categoryIndex, id, isEdit, saving } = this.data;
    if (saving) return;
    if (!form.title) {
      wx.showToast({ title: '请填写商品标题', icon: 'none' });
      return;
    }
    const skuList = skus.map((s) => ({
      id: s.id || undefined,
      name: s.name || '默认',
      spec: s.spec || '',
      price: Number(s.price) || 0,
      stock: Number(s.stock) || 0,
      linePrice: s.linePrice !== '' && s.linePrice != null ? Number(s.linePrice) : null,
    }));
    if (!skuList.length || skuList.every((s) => s.price <= 0)) {
      wx.showToast({ title: '请填写有效价格', icon: 'none' });
      return;
    }

    const images = (form.images || '')
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const cat = categories[categoryIndex];
    const payload = {
      title: form.title,
      cover: form.cover || (images[0] || ''),
      images: images.length ? images : form.cover ? [form.cover] : [],
      detail: form.detail || form.title,
      categoryId: cat ? cat.id : this.data._categoryId || null,
      status: form.status,
      saleType: form.saleType,
      isHot: !!form.isHot,
      pickupOnly: !!form.pickupOnly,
      skus: skuList,
    };

    this.setData({ saving: true });
    const req = isEdit
      ? put('/api/products/' + id, payload, { loading: true })
      : post('/api/products', payload, { loading: true });

    req
      .then(() => {
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => this.setData({ saving: false }));
  },
}));

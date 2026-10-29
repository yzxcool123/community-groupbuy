const { get, post } = require('../../utils/request');

const TABS = [
  { key: '', label: '全部' },
  { key: 'unpaid', label: '待支付' },
  { key: 'ready', label: '待提货' },
  { key: 'verified', label: '已完成' },
];

const STATUS_TEXT = {
  unpaid: '待支付',
  paid: '待提货',
  ready: '待提货',
  verified: '已完成',
  cancelled: '已取消',
};

const STATUS_CLS = {
  unpaid: 'badge-warning',
  paid: 'badge-primary',
  ready: 'badge-primary',
  verified: 'badge-muted',
  cancelled: 'badge-muted',
};

Page({
  data: {
    tabs: TABS,
    activeTab: '',
    list: [],
    loading: true,
    statusText: STATUS_TEXT,
    statusCls: STATUS_CLS,
  },

  onLoad(options) {
    if (options.status !== undefined) {
      this.setData({ activeTab: options.status || '' });
    }
  },

  onShow() {
    this.load();
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key, loading: true });
    this.load();
  },

  load() {
    const { activeTab } = this.data;
    this.setData({ loading: true });

    let promise;
    if (activeTab === 'ready') {
      // 后端单状态过滤：paid + ready 合并
      promise = Promise.all([
        get('/api/orders/mine', { status: 'paid', pageSize: 50 }, { silent: true }),
        get('/api/orders/mine', { status: 'ready', pageSize: 50 }, { silent: true }),
      ]).then(([a, b]) => {
        const list = []
          .concat((a && a.list) || [])
          .concat((b && b.list) || []);
        list.sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));
        return { list };
      });
    } else {
      const params = { pageSize: 50, page: 1 };
      if (activeTab) params.status = activeTab;
      promise = get('/api/orders/mine', params, { silent: true });
    }

    promise
      .then((res) => {
        const raw = (res && res.list) || [];
        const list = raw.map((o) => this.decorate(o));
        this.setData({ list, loading: false });
      })
      .catch(() => this.setData({ list: [], loading: false }));
  },

  decorate(o) {
    const items = (o.items || []).slice(0, 3).map((i) => ({
      cover: i.cover,
      title: i.title,
      skuName: i.skuName,
      qty: i.qty,
      price: i.price,
    }));
    const payMode = o.payMode === 'cod' ? 'cod' : 'online';
    const paid = !!o.paidAt;
    let statusText = STATUS_TEXT[o.status] || o.status;
    if (o.status === 'ready' || o.status === 'paid') {
      if (payMode === 'cod') statusText = '待提货·到店付';
      else if (paid) statusText = '待提货·已付款';
    }
    return Object.assign({}, o, {
      statusText,
      statusCls: STATUS_CLS[o.status] || 'badge-muted',
      payModeText: payMode === 'cod' ? '到店付款' : '在线支付',
      paidText: paid ? '已付款' : '未付款',
      previewItems: items,
      moreCount: (o.items || []).length - items.length,
      totalText: Number(o.total || 0).toFixed(2),
    });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  },

  onPay(e) {
    const id = e.currentTarget.dataset.id;
    post('/api/orders/' + id + '/mock-pay', {}, { loading: true })
      .then(() => {
        wx.showToast({ title: '支付成功', icon: 'success' });
        this.load();
      })
      .catch(() => {});
  },

  onCancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消订单',
      content: '确定取消该订单吗？库存将回滚。',
      success: (res) => {
        if (res.confirm) {
          post('/api/orders/' + id + '/cancel', {}, { loading: true })
            .then(() => {
              wx.showToast({ title: '已取消', icon: 'success' });
              this.load();
            })
            .catch(() => {});
        }
      },
    });
  },

  goShopping() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});

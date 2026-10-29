const address = require('../../utils/address');

Page({
  data: {
    list: [],
  },

  onShow() {
    this.load();
  },

  load() {
    this.setData({ list: address.getAll() });
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/address-edit/address-edit' });
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/address-edit/address-edit?id=' + id });
  },

  onSetDefault(e) {
    const id = e.currentTarget.dataset.id;
    address.setDefault(id);
    this.load();
    wx.showToast({ title: '已设为默认', icon: 'success' });
  },

  onRemove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除地址',
      content: '确认删除该收货地址？',
      success: (res) => {
        if (!res.confirm) return;
        address.remove(id);
        this.load();
      },
    });
  },
});

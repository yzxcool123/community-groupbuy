const address = require('../../utils/address');

Page({
  data: {
    id: '',
    isEdit: false,
    form: {
      community: '',
      building: '',
      room: '',
      contactName: '',
      contactPhone: '',
    },
    isDefault: false,
  },

  onLoad(options) {
    const id = options.id || '';
    this.setData({ id, isEdit: !!id });
    if (id) {
      const a = address.getById(id);
      if (a) {
        this.setData({
          form: {
            community: a.community || '',
            building: a.building || '',
            room: a.room || '',
            contactName: a.contactName || '',
            contactPhone: a.contactPhone || '',
          },
          isDefault: !!a.isDefault,
        });
      }
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onDefaultChange(e) {
    this.setData({ isDefault: e.detail.value });
  },

  onSave() {
    const { form, isDefault, id, isEdit } = this.data;
    const community = (form.community || '').trim();
    const building = (form.building || '').trim();
    const room = (form.room || '').trim();
    const contactName = (form.contactName || '').trim();
    const contactPhone = (form.contactPhone || '').trim();

    if (!community) return wx.showToast({ title: '请填写小区名称', icon: 'none' });
    if (!building) return wx.showToast({ title: '请填写楼号', icon: 'none' });
    if (!room) return wx.showToast({ title: '请填写门牌号', icon: 'none' });
    if (!contactName) return wx.showToast({ title: '请填写收货人', icon: 'none' });
    if (!/^1\d{10}$/.test(contactPhone)) return wx.showToast({ title: '手机号格式不对', icon: 'none' });

    const payload = { community, building, room, contactName, contactPhone, isDefault };
    if (isEdit) address.update(id, payload);
    else address.add(payload);

    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 400);
  },

  onRemove() {
    const { id } = this.data;
    if (!id) return;
    wx.showModal({
      title: '删除地址',
      content: '确认删除该地址？',
      success: (res) => {
        if (!res.confirm) return;
        address.remove(id);
        wx.navigateBack();
      },
    });
  },
});

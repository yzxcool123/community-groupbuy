/* 应用入口：登录、路由、事件 */
const MENU = [
  { id: 'dashboard', label: '工作台', icon: '◱', title: '工作台', sub: '今日经营概览' },
  { id: 'products', label: '商品管理', icon: '◫', title: '商品管理', sub: '商品、SKU 与上下架', perm: 'product:read' },
  { id: 'orders', label: '订单管理', icon: '◧', title: '订单管理', sub: '订单查询与核销', perm: 'order:read' },
  { id: 'pickup', label: '自提点', icon: '◉', title: '自提点', sub: '站点维护与营业时间', perm: 'pickup:admin' },
  { id: 'users', label: '用户角色', icon: '◎', title: '用户角色', sub: '权限分配', perm: 'user:admin' },
];

const state = {
  route: 'dashboard',
  q: {},
};

function showLogin() {
  $('#layout').classList.add('hidden');
  $('#view-login').classList.remove('hidden');
}

function showLayout() {
  $('#view-login').classList.add('hidden');
  $('#layout').classList.remove('hidden');
  const u = api.user || {};
  $('#side-name').textContent = u.nickname || u.username || '用户';
  $('#side-role').textContent = (u.roles || []).join(' / ') || 'buyer';
  $('#side-avatar').textContent = (u.nickname || u.username || 'U').slice(0, 1).toUpperCase();
  renderMenu();
  startOrderNotify();
}

function visibleMenu() {
  return MENU.filter((m) => !m.perm || hasPerm(m.perm) || hasPerm('stats:read'));
}

function renderMenu() {
  const items = visibleMenu();
  $('#menu').innerHTML = items
    .map(
      (m) => `
      <div class="menu-item ${state.route === m.id ? 'active' : ''}" data-route="${m.id}">
        <div class="ico">${m.icon}</div>
        <div>${m.label}</div>
        <div class="menu-badge" data-badge="${m.id}" hidden></div>
      </div>`
    )
    .join('');
  if (orderNotify.pending > 0) {
    setMenuBadge('orders', orderNotify.pending);
  }
}

/* ========== 新订单通知 ========== */
const orderNotify = {
  timer: null,
  since: new Date().toISOString(),
  pending: 0,
  inited: false,
};

function setMenuBadge(route, count) {
  const el = document.querySelector(`[data-badge="${route}"]`);
  if (!el) return;
  if (count > 0) {
    el.hidden = false;
    el.textContent = count > 99 ? '99+' : String(count);
    el.classList.add('show');
  } else {
    el.hidden = true;
    el.classList.remove('show');
    el.textContent = '';
  }
}

function requestDesktopNotify() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function fireDesktopNotify(title, body) {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'groupbuy-order' });
    }
  } catch (e) {}
}

function notifyNewOrder(o) {
  const title = '新订单提醒';
  const body = `${o.user || '用户'} · ${fmtMoney(o.total)} · ${o.fulfillment === 'delivery' ? '送货' : '自提'} · ${o.payMode === 'cod' ? '到店付' : '在线付'}`;
  toast(`🔔 ${title}：${body}`, 'ok');
  fireDesktopNotify(title, `${o.orderNo} ${body}`);
  orderNotify.pending += 1;
  setMenuBadge('orders', orderNotify.pending);
  // 若正停在订单页，自动刷新列表
  if (state.route === 'orders') {
    rerender();
    orderNotify.pending = 0;
    setMenuBadge('orders', 0);
  }
}

function startOrderNotify() {
  if (!hasPerm('order:read') && !(api.user?.roles || []).includes('admin') && !(api.user?.roles || []).includes('staff')) {
    return;
  }
  stopOrderNotify();
  requestDesktopNotify();
  if (!orderNotify.inited) {
    orderNotify.since = new Date().toISOString();
    orderNotify.inited = true;
  }
  orderNotify.timer = setInterval(pollNewOrders, 15000);
  // 启动后先拉一次，避免漏掉轮询间隔内订单
  setTimeout(pollNewOrders, 800);
}

function stopOrderNotify() {
  if (orderNotify.timer) {
    clearInterval(orderNotify.timer);
    orderNotify.timer = null;
  }
}

async function pollNewOrders() {
  if (!api.token) return;
  try {
    const data = await api.get(
      '/api/orders/notify/recent?since=' + encodeURIComponent(orderNotify.since) + '&limit=10'
    );
    const list = (data && data.list) || [];
    if (data && data.now) orderNotify.since = data.now;
    // 按时间正序提示
    list.slice().reverse().forEach((o) => notifyNewOrder(o));
  } catch (e) {
    // 网络/权限失败忽略，下一轮重试
  }
}

async function navigate(route, q = {}) {
  const item = MENU.find((m) => m.id === route) || MENU[0];
  // 权限不足时回退
  if (item.perm && !hasPerm(item.perm) && !(api.user?.roles || []).includes('admin')) {
    toast('无权访问该模块', 'err');
    route = 'dashboard';
  }
  state.route = MENU.find((m) => m.id === route) ? route : 'dashboard';
  state.q = q;
  const cur = MENU.find((m) => m.id === state.route);
  $('#page-title').textContent = cur.title;
  $('#page-sub').textContent = cur.sub;
  renderMenu();
  const page = $('#page');
  page.innerHTML = `<div class="empty">加载中…</div>`;
  try {
    const html = await views[state.route](state);
    page.innerHTML = html;
  } catch (e) {
    page.innerHTML = `<div class="empty"><div class="icon">⚠️</div>${escapeHtml(e.message)}</div>`;
  }
}

function rerender() {
  navigate(state.route, state.q);
}

/* ---------- 登录 ---------- */
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  btn.disabled = true;
  btn.textContent = '登录中…';
  try {
    const data = await api.login($('#login-username').value.trim(), $('#login-password').value);
    api.setAuth(data.token, data.user);
    toast('登录成功');
    showLayout();
    navigate('dashboard');
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '登 录';
  }
});

$('#logout-btn').addEventListener('click', () => {
  stopOrderNotify();
  api.clearAuth();
  showLogin();
  toast('已退出登录');
});

window.addEventListener('auth:logout', () => {
  stopOrderNotify();
  showLogin();
});

/* ---------- 全局委托 ---------- */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-route],[data-goto],[data-act],[data-close],[data-page]');
  if (!t) return;

  if (t.dataset.close !== undefined) {
    closeModal();
    return;
  }

  if (t.dataset.route) {
    navigate(t.dataset.route);
    return;
  }

  if (t.dataset.goto) {
    navigate(t.dataset.goto);
    return;
  }

  if (t.dataset.page && t.dataset.page.startsWith('goto:')) {
    const page = Number(t.dataset.page.split(':')[1]) || 1;
    navigate(state.route, { ...state.q, page });
    return;
  }

  const act = t.dataset.act;
  if (!act) return;

  try {
    if (act === 'edit' && state.route === 'products') {
      await openProductEditor(t.dataset.id);
    } else if (act === 'toggle' && state.route === 'products') {
      const next = t.dataset.status === 'on' ? 'off' : 'on';
      await api.patch(`/api/products/${t.dataset.id}/status`, { status: next });
      toast(next === 'on' ? '已上架' : '已下架');
      rerender();
    } else if (act === 'detail' && state.route === 'orders') {
      await openOrderDetail(t.dataset.id);
    } else if (act === 'verify' && state.route === 'orders') {
      await openVerifyModal(t.dataset.id, t.dataset.code);
    } else if (act === 'cancel' && state.route === 'orders') {
      if (!confirm('确认取消该订单？库存将回滚。')) return;
      await api.post(`/api/orders/${t.dataset.id}/cancel`);
      toast('订单已取消');
      rerender();
    } else if (act === 'edit' && state.route === 'pickup') {
      await openPickupEditor(t.dataset.id);
    } else if (act === 'roles' && state.route === 'users') {
      await openRolesModal(t.dataset.id, t.dataset.roles || 'buyer', t.dataset.name);
    }
  } catch (err) {
    toast(err.message, 'err');
  }
});

// 工具栏按钮
document.addEventListener('click', async (e) => {
  const id = e.target.id;
  if (id === 'p-add') openProductEditor(null);
  if (id === 'p-cats') openCategoryManager();
  if (id === 'pp-add') openPickupEditor(null);
  if (id === 'o-export') exportOrdersCsv();
  if (id === 'modal-cancel') closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// 搜索回车 / 筛选变更
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'p-kw') navigate('products', { ...state.q, keyword: e.target.value.trim(), page: 1 });
  if (e.target.id === 'o-kw') navigate('orders', { ...state.q, keyword: e.target.value.trim(), page: 1 });
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'p-status') navigate('products', { ...state.q, status: e.target.value, page: 1 });
  if (e.target.id === 'p-cat') navigate('products', { ...state.q, categoryId: e.target.value, page: 1 });
  if (e.target.id === 'o-status') navigate('orders', { ...state.q, status: e.target.value, page: 1 });
});

/* ---------- 弹窗：分类管理 ---------- */
async function openCategoryManager() {
  const render = async () => {
    const list = await api.get('/api/admin/categories');
    openModal(`
      <h3>分类管理</h3>
      <p class="muted" style="margin-top:0">用于商品归类，例如：水果、蔬菜、零食、饮品。</p>
      <div class="form-row" style="margin:14px 0">
        <div class="field" style="grid-column:1/3">
          <label>新增分类</label>
          <div style="display:flex;gap:8px">
            <input class="input" id="c-new-name" placeholder="分类名称，如：零食" style="flex:1" />
            <input class="input" id="c-new-icon" placeholder="图标(emoji)可空" style="width:110px" />
            <button class="btn btn-primary" id="c-add">添加</button>
          </div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>图标</th><th>名称</th><th>排序</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${list.length
              ? list.map((c) => `
                <tr data-id="${c.id}">
                  <td style="font-size:20px">${escapeHtml(c.icon || '📁')}</td>
                  <td><input class="input" data-f="name" value="${escapeHtml(c.name)}" style="min-width:120px" /></td>
                  <td><input class="input" data-f="sort" type="number" value="${c.sort ?? 0}" style="min-width:72px;width:72px" /></td>
                  <td>
                    <select class="select" data-f="status" style="min-width:90px">
                      <option value="on" ${c.status !== 'disabled' ? 'selected' : ''}>启用</option>
                      <option value="disabled" ${c.status === 'disabled' ? 'selected' : ''}>停用</option>
                    </select>
                  </td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-sm" data-cact="save">保存</button>
                      <button class="btn btn-sm btn-danger" data-cact="del">删除</button>
                    </div>
                  </td>
                </tr>`).join('')
              : `<tr><td colspan="5"><div class="empty">暂无分类</div></td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">完成</button>
      </div>
    `);

    $('#c-add').onclick = async () => {
      const name = $('#c-new-name').value.trim();
      if (!name) return toast('请输入分类名称', 'err');
      try {
        await api.post('/api/admin/categories', { name, icon: $('#c-new-icon').value.trim(), sort: 0 });
        toast('已添加');
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    };

    $('#modal-box').onclick = async (ev) => {
      const btn = ev.target.closest('[data-cact]');
      if (!btn) return;
      const tr = btn.closest('tr');
      const id = tr.dataset.id;
      const name = tr.querySelector('[data-f="name"]').value.trim();
      const sort = Number(tr.querySelector('[data-f="sort"]').value) || 0;
      const status = tr.querySelector('[data-f="status"]').value;
      try {
        if (btn.dataset.cact === 'save') {
          await api.put(`/api/admin/categories/${id}`, { name, sort, status });
          toast('已保存');
        } else {
          if (!confirm(`确认删除分类「${name}」？`)) return;
          await api.del(`/api/admin/categories/${id}`);
          toast('已删除');
          render();
        }
      } catch (e) {
        toast(e.message, 'err');
      }
    };
  };
  await render();
}

/* ---------- 弹窗：商品编辑 ---------- */
async function openProductEditor(id) {
  let p = {
    title: '',
    cover: 'https://picsum.photos/seed/new/600/600',
    images: [],
    detail: '',
    categoryId: '',
    status: 'on',
    saleType: 'spot',
    isHot: false,
    skus: [{ name: '默认', price: 0, stock: 0, spec: '' }],
  };
  if (id) {
    const d = await api.get(`/api/products/${id}`);
    p = { ...p, ...d, skus: (d.skus || []).map((s) => ({ name: s.name, price: s.price, stock: s.stock, spec: s.spec })) };
  }
  const cats = await api.get('/api/admin/categories');
  openModal(`
    <h3>${id ? '编辑商品' : '新建商品'}</h3>
    <div class="form-row one">
      <div class="field"><label>商品标题</label><input class="input" id="e-title" value="${escapeHtml(p.title)}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>分类</label>
        <select class="select" id="e-cat">
          <option value="">未分类</option>
          ${cats.map((c) => `<option value="${c.id}" ${p.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>销售类型</label>
        <select class="select" id="e-sale">
          <option value="spot" ${p.saleType === 'spot' ? 'selected' : ''}>现货</option>
          <option value="presale" ${p.saleType === 'presale' ? 'selected' : ''}>预售</option>
          <option value="mixed" ${p.saleType === 'mixed' ? 'selected' : ''}>预售+现货</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="field"><label>封面图 URL</label><input class="input" id="e-cover" value="${escapeHtml(p.cover)}" /></div>
      <div class="field"><label>活动价（可空）</label><input class="input" id="e-act" type="number" step="0.01" value="${p.activityPrice ?? ''}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>状态</label>
        <select class="select" id="e-status">
          <option value="on" ${p.status === 'on' ? 'selected' : ''}>上架</option>
          <option value="off" ${p.status === 'off' ? 'selected' : ''}>下架</option>
        </select>
      </div>
      <div class="field"><label>热销推荐</label>
        <select class="select" id="e-hot">
          <option value="0" ${!p.isHot ? 'selected' : ''}>否</option>
          <option value="1" ${p.isHot ? 'selected' : ''}>是</option>
        </select>
      </div>
    </div>
    <div class="form-row one">
      <div class="field"><label>商品详情</label><textarea class="textarea" id="e-detail">${escapeHtml(p.detail)}</textarea></div>
    </div>
    <div class="field">
      <label>SKU 规格</label>
      <div id="e-skus">
        ${p.skus
          .map(
            (s) => `
          <div class="sku-row">
            <input class="input" data-f="name" placeholder="规格名" value="${escapeHtml(s.name)}" />
            <input class="input" data-f="spec" placeholder="描述" value="${escapeHtml(s.spec || '')}" />
            <input class="input" data-f="price" type="number" step="0.01" placeholder="价格" value="${s.price}" />
            <input class="input" data-f="stock" type="number" placeholder="库存" value="${s.stock}" />
            <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>
          </div>`
          )
          .join('')}
      </div>
      <button type="button" class="btn btn-sm" onclick="addSkuRow()" style="margin-top:6px">+ 添加规格</button>
    </div>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="e-save">保存</button>
    </div>
  `);

  $('#e-save').onclick = async () => {
    const skus = $$('#e-skus .sku-row').map((row) => ({
      name: row.querySelector('[data-f="name"]').value.trim() || '默认',
      spec: row.querySelector('[data-f="spec"]').value.trim(),
      price: Number(row.querySelector('[data-f="price"]').value) || 0,
      stock: Number(row.querySelector('[data-f="stock"]').value) || 0,
    }));
    const body = {
      title: $('#e-title').value.trim(),
      cover: $('#e-cover').value.trim(),
      categoryId: $('#e-cat').value || null,
      saleType: $('#e-sale').value,
      status: $('#e-status').value,
      isHot: $('#e-hot').value === '1',
      detail: $('#e-detail').value,
      activityPrice: $('#e-act').value === '' ? null : Number($('#e-act').value),
      pickupOnly: true,
      images: [$('#e-cover').value.trim()].filter(Boolean),
      skus,
    };
    if (!body.title) return toast('请填写标题', 'err');
    try {
      if (id) await api.put(`/api/products/${id}`, body);
      else await api.post('/api/products', body);
      toast('保存成功');
      closeModal();
      rerender();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function addSkuRow() {
  const wrap = $('#e-skus');
  const div = document.createElement('div');
  div.className = 'sku-row';
  div.innerHTML = `
    <input class="input" data-f="name" placeholder="规格名" />
    <input class="input" data-f="spec" placeholder="描述" />
    <input class="input" data-f="price" type="number" step="0.01" placeholder="价格" />
    <input class="input" data-f="stock" type="number" placeholder="库存" />
    <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>`;
  wrap.appendChild(div);
}

/* ---------- 订单 ---------- */
async function openOrderDetail(id) {
  const o = await api.get(`/api/orders/${id}`);
  openModal(`
    <h3>订单详情</h3>
    <dl class="detail-list">
      <dt>订单号</dt><dd style="font-family:ui-monospace,monospace">${escapeHtml(o.orderNo)}</dd>
      <dt>状态</dt><dd>${statusTag(o.status)}</dd>
      <dt>用户</dt><dd>${escapeHtml(o.user?.nickname || '—')} · ${escapeHtml(o.user?.phone || '')}</dd>
      <dt>履约</dt><dd>${o.fulfillment === 'delivery' ? '送货上门' : '到店自提'}</dd>
      <dt>付款</dt><dd>${payTags(o)}${o.payMode === 'cod' && !o.paid ? ' <span class="muted">核销时收款</span>' : ''}</dd>
      <dt>自提点</dt><dd>${escapeHtml(o.pickupPoint?.name || '—')}（${escapeHtml(o.pickupPoint?.address || '')}）</dd>
      ${
        o.fulfillment === 'delivery' && o.deliveryAddress
          ? `<dt>配送地址</dt><dd>${escapeHtml(o.deliveryAddress.community)} ${escapeHtml(o.deliveryAddress.building)} ${escapeHtml(o.deliveryAddress.room)}<br/>${escapeHtml(o.deliveryAddress.contactName)} · ${escapeHtml(o.deliveryAddress.contactPhone)}</dd>`
          : ''
      }
      <dt>金额</dt><dd><strong>${fmtMoney(o.total)}</strong></dd>
      <dt>核销码</dt><dd style="font-family:ui-monospace,monospace;font-size:18px;letter-spacing:.08em">${escapeHtml(o.verifyCode?.code || '—')}</dd>
      <dt>下单时间</dt><dd>${fmtTime(o.createdAt)}</dd>
      <dt>备注</dt><dd>${escapeHtml(o.remark || '—')}</dd>
    </dl>
    <div class="table-wrap" style="margin-top:16px">
      <table>
        <thead><tr><th>商品</th><th>规格</th><th>单价</th><th>数量</th></tr></thead>
        <tbody>
          ${(o.items || [])
            .map(
              (it) => `<tr>
                <td>${escapeHtml(it.title)}</td>
                <td>${escapeHtml(it.skuName || '')} ${escapeHtml(it.skuSpec || '')}</td>
                <td>${fmtMoney(it.price)}</td>
                <td>${it.qty}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">关闭</button>
    </div>
  `);
}

async function openVerifyModal(orderId, code) {
  openModal(`
    <h3>核销确认</h3>
    <p class="muted" style="margin-top:0">请确认消费者已到店取货，再执行核销。</p>
    <div class="field" style="margin:12px 0">
      <label>核销码</label>
      <input class="input" id="v-code" style="width:100%;font-family:ui-monospace,monospace;font-size:18px;letter-spacing:.1em" value="${escapeHtml(code)}" />
    </div>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="v-ok">确认核销</button>
    </div>
  `);
  $('#v-ok').onclick = async () => {
    try {
      await api.post('/api/verify', { code: $('#v-code').value.trim() });
      toast('核销成功');
      closeModal();
      rerender();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function exportOrdersCsv() {
  const rows = [['订单号', '金额', '状态', '自提点', '下单时间']];
  $$('#page table tbody tr').forEach((tr) => {
    const tds = [...tr.querySelectorAll('td')];
    if (tds.length < 6) return;
    rows.push([
      tds[0].innerText.trim(),
      tds[2].innerText.trim(),
      tds[4].innerText.trim(),
      tds[3].innerText.trim(),
      tds[5].innerText.trim(),
    ]);
  });
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `orders-${Date.now()}.csv`;
  a.click();
  toast('已导出');
}

/* ---------- 自提点 ---------- */
async function openPickupEditor(id) {
  let p = { name: '', address: '', phone: '', openTime: '09:00-21:00', status: 'on' };
  if (id) {
    const list = await api.get('/api/admin/pickup-points');
    p = list.find((x) => x.id === id) || p;
  }
  openModal(`
    <h3>${id ? '编辑自提点' : '新建自提点'}</h3>
    <div class="form-row">
      <div class="field"><label>名称</label><input class="input" id="pp-name" value="${escapeHtml(p.name)}" /></div>
      <div class="field"><label>电话</label><input class="input" id="pp-phone" value="${escapeHtml(p.phone)}" /></div>
    </div>
    <div class="form-row one">
      <div class="field"><label>地址</label><input class="input" id="pp-addr" value="${escapeHtml(p.address)}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>营业时间</label><input class="input" id="pp-open" value="${escapeHtml(p.openTime)}" /></div>
      <div class="field"><label>状态</label>
        <select class="select" id="pp-status">
          <option value="on" ${p.status !== 'disabled' ? 'selected' : ''}>启用</option>
          <option value="disabled" ${p.status === 'disabled' ? 'selected' : ''}>停用</option>
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="pp-save">保存</button>
    </div>
  `);
  $('#pp-save').onclick = async () => {
    const body = {
      name: $('#pp-name').value.trim(),
      phone: $('#pp-phone').value.trim(),
      address: $('#pp-addr').value.trim(),
      openTime: $('#pp-open').value.trim(),
      status: $('#pp-status').value === 'disabled' ? 'disabled' : 'on',
    };
    if (!body.name) return toast('名称必填', 'err');
    try {
      if (id) await api.put(`/api/admin/pickup-points/${id}`, body);
      else await api.post('/api/admin/pickup-points', body);
      toast('已保存');
      closeModal();
      rerender();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

/* ---------- 角色 ---------- */
async function openRolesModal(userId, rolesStr, name) {
  const roles = rolesStr.split(',').filter(Boolean);
  openModal(`
    <h3>设置权限 · ${escapeHtml(name)}</h3>
    <p class="muted" style="margin-top:0">勾选后，用户在微信小程序中将看到对应管理功能。</p>
    <label style="display:flex;gap:8px;align-items:center;margin:12px 0">
      <input type="checkbox" value="buyer" ${roles.includes('buyer') ? 'checked' : ''} disabled checked /> 买家（固定）
    </label>
    <label style="display:flex;gap:8px;align-items:center;margin:12px 0">
      <input type="checkbox" id="r-staff" ${roles.includes('staff') ? 'checked' : ''} /> 团长/店长（小程序核销、上货）
    </label>
    <label style="display:flex;gap:8px;align-items:center;margin:12px 0">
      <input type="checkbox" id="r-admin" ${roles.includes('admin') ? 'checked' : ''} /> 超级管理员（全部权限）
    </label>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">取消</button>
      <button class="btn btn-primary" id="r-save">保存</button>
    </div>
  `);
  $('#r-save').onclick = async () => {
    const r = ['buyer'];
    if ($('#r-staff').checked) r.push('staff');
    if ($('#r-admin').checked) r.push('admin');
    try {
      await api.put(`/api/admin/users/${userId}/roles`, { roles: r });
      toast('权限已更新');
      closeModal();
      rerender();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

/* ---------- 启动 ---------- */
(async function boot() {
  if (api.token && api.user) {
    try {
      const me = await api.me();
      api.setAuth(api.token, me);
      showLayout();
      navigate('dashboard');
      return;
    } catch {
      api.clearAuth();
    }
  }
  showLogin();
})();

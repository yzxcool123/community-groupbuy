/* 页面视图 */
/* 兜底：若 ui.js 未及时加载则使用本地实现 */
if (typeof window.payTags !== 'function') {
  window.payTags = function (o) {
    const mode = o.payMode === 'cod'
      ? '<span class="tag tag-orange">到店付款</span>'
      : '<span class="tag tag-blue">在线支付</span>';
    const paid = o.paid || o.paidAt
      ? '<span class="tag tag-green">已付款</span>'
      : '<span class="tag tag-red">未付款</span>';
    return mode + ' ' + paid;
  };
}

const views = {
  /* ========== 工作台 ========== */
  async dashboard(ctx) {
    const s = await api.get('/api/admin/stats');
    const maxGmv = Math.max(...s.days.map((d) => d.gmv), 1);
    return `
      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="stat accent">
          <div class="label">累计成交额</div>
          <div class="value">${fmtMoney(s.gmv)}</div>
          <div class="hint">含已支付 / 待提货 / 已核销</div>
        </div>
        <div class="stat">
          <div class="label">今日订单</div>
          <div class="value">${s.todayOrders}</div>
          <div class="hint">全部订单 ${s.totalOrders} 笔</div>
        </div>
        <div class="stat">
          <div class="label">待核销</div>
          <div class="value" style="color:var(--warn)">${s.pendingVerify}</div>
          <div class="hint">已核销 ${s.verified} 笔</div>
        </div>
        <div class="stat">
          <div class="label">在售商品</div>
          <div class="value">${s.productCount}</div>
          <div class="hint">注册用户 ${s.userCount} 人</div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head">
            <h3>近 7 日成交</h3>
            <span class="muted">GMV / 订单数</span>
          </div>
          <div class="bars">
            ${s.days
              .map(
                (d) => `
              <div class="bar-col" title="${d.date} · ${fmtMoney(d.gmv)} · ${d.orders}单">
                <div class="bar" style="height:${Math.max(6, Math.round((d.gmv / maxGmv) * 100))}%"></div>
                <span>${d.date}</span>
              </div>`
              )
              .join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>热销商品 Top 5</h3></div>
          ${
            s.hot.length
              ? s.hot
                  .map(
                    (h, i) => `
            <div class="hot-row">
              <div class="hot-rank">${i + 1}</div>
              <div class="name">${escapeHtml(h.title)}</div>
              <div class="num">${h.qty} 件 · ${fmtMoney(h.amount)}</div>
            </div>`
                  )
                  .join('')
              : `<div class="empty"><div class="icon">📦</div>暂无销售数据</div>`
          }
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>快捷入口</h3></div>
        <div class="quick-grid">
          <div class="quick" data-goto="products"><div class="t">商品管理</div><div class="d">上架 / 改价 / 库存</div></div>
          <div class="quick" data-goto="orders"><div class="t">订单核销</div><div class="d">查看待提货订单</div></div>
          <div class="quick" data-goto="pickup"><div class="t">自提点</div><div class="d">站点与地址维护</div></div>
          <div class="quick" data-goto="users"><div class="t">用户角色</div><div class="d">授予团长 / 管理员</div></div>
        </div>
      </div>`;
  },

  /* ========== 商品 ========== */
  async products(ctx) {
    const q = ctx.q || {};
    const statusParam = q.status || 'all';
    const [listRes, cats] = await Promise.all([
      api.get(
        `/api/products?pageSize=${q.pageSize || 20}&page=${q.page || 1}&status=${statusParam}` +
          (q.keyword ? `&keyword=${encodeURIComponent(q.keyword)}` : '') +
          (q.categoryId ? `&categoryId=${encodeURIComponent(q.categoryId)}` : '')
      ),
      api.get('/api/admin/categories'),
    ]);
    const items = listRes.list;

    return `
      <div class="toolbar">
        <input class="input" id="p-kw" placeholder="搜索商品标题" value="${escapeHtml(q.keyword || '')}" />
        <select class="select" id="p-status">
          <option value="" ${!q.status ? 'selected' : ''}>全部状态</option>
          <option value="on" ${q.status === 'on' ? 'selected' : ''}>上架中</option>
          <option value="off" ${q.status === 'off' ? 'selected' : ''}>已下架</option>
        </select>
        <select class="select" id="p-cat">
          <option value="">全部分类</option>
          ${cats.map((c) => `<option value="${c.id}" ${q.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        ${hasPerm('product:write') ? `<button class="btn" id="p-cats">分类管理</button>` : ''}
        ${hasPerm('product:write') ? `<button class="btn btn-primary" id="p-add">+ 新建商品</button>` : ''}
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>商品</th>
              <th>分类</th>
              <th>价格</th>
              <th>库存</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              items.length
                ? items
                    .map(
                      (p) => `
              <tr>
                <td>
                  <div class="row-title">
                    <img class="img-cell" src="${escapeHtml(p.cover)}" alt="" onerror="this.style.visibility='hidden'"/>
                    <div>
                      <strong>${escapeHtml(p.title)}</strong>
                      <small>${p.saleType === 'presale' ? '预售' : p.saleType === 'mixed' ? '预售+现货' : '现货'}${p.isHot ? ' · 热销' : ''}</small>
                    </div>
                  </div>
                </td>
                <td>${escapeHtml(p.categoryName || '—')}</td>
                <td>${fmtMoney(p.minPrice)}${p.activityPrice != null ? ` <span class="tag tag-orange">活动 ${fmtMoney(p.activityPrice)}</span>` : ''}</td>
                <td>${p.stock ?? '—'}</td>
                <td>${p.status === 'on' ? '<span class="tag tag-green">上架</span>' : '<span class="tag tag-gray">下架</span>'}</td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${hasPerm('product:write') ? `<button class="btn btn-sm" data-act="edit" data-id="${p.id}">编辑</button>` : ''}
                    ${hasPerm('product:write') ? `<button class="btn btn-sm" data-act="toggle" data-id="${p.id}" data-status="${p.status}">${p.status === 'on' ? '下架' : '上架'}</button>` : ''}
                  </div>
                </td>
              </tr>`
                    )
                    .join('')
                : `<tr><td colspan="6"><div class="empty"><div class="icon">🗂</div>暂无商品</div></td></tr>`
            }
          </tbody>
        </table>
      </div>`;
  },

  /* ========== 订单 ========== */
  async orders(ctx) {
    const q = ctx.q || {};
    const statusMap = {
      '': '',
      unpaid: 'unpaid',
      ready: 'ready',
      verified: 'verified',
      cancelled: 'cancelled',
    };
    const path = `/api/orders?pageSize=${q.pageSize || 10}&page=${q.page || 1}` +
      (q.status ? `&status=${q.status}` : '') +
      (q.keyword ? `&keyword=${encodeURIComponent(q.keyword)}` : '');
    const res = await api.get(path);

    return `
      <div class="toolbar">
        <input class="input" id="o-kw" placeholder="订单号 / 用户昵称" value="${escapeHtml(q.keyword || '')}" />
        <select class="select" id="o-status">
          <option value="">全部状态</option>
          ${['unpaid', 'paid', 'ready', 'verified', 'cancelled']
            .map((s) => `<option value="${s}" ${q.status === s ? 'selected' : ''}>${ORDER_STATUS[s].label}</option>`)
            .join('')}
        </select>
        <div class="spacer"></div>
        <button class="btn" id="o-export">导出本页 CSV</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>用户</th>
              <th>金额</th>
              <th>履约</th>
              <th>付款</th>
              <th>状态</th>
              <th>下单时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              res.list.length
                ? res.list
                    .map(
                      (o) => `
              <tr>
                <td><strong style="font-family:ui-monospace,monospace">${escapeHtml(o.orderNo)}</strong></td>
                <td>${escapeHtml(o.user?.nickname || o.userId)}<br/><small class="muted">${escapeHtml(o.user?.phone || '')}</small></td>
                <td>${fmtMoney(o.total)}</td>
                <td>${
                  o.fulfillment === 'delivery'
                    ? `<span class="tag tag-blue">送货</span><br/><small class="muted">${escapeHtml(o.deliveryAddress?.text || o.deliveryAddress?.community || '')}</small>`
                    : `<span class="tag tag-green">自提</span><br/><small class="muted">${escapeHtml(o.pickupPoint?.name || '—')}</small>`
                }</td>
                <td>${payTags(o)}${o.payMode === 'cod' && !o.paid && o.status === 'verified' ? '' : ''}${o.payMode === 'cod' && (o.status === 'ready' || o.status === 'paid') ? '<br/><small class="muted">核销时收款</small>' : ''}</td>
                <td>${statusTag(o.status)}</td>
                <td>${fmtTime(o.createdAt)}</td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="btn btn-sm" data-act="detail" data-id="${o.id}">详情</button>
                    ${
                      o.status === 'ready' || o.status === 'paid'
                        ? `<button class="btn btn-sm btn-primary" data-act="verify" data-id="${o.id}" data-code="${o.verifyCode?.code || ''}">核销</button>`
                        : ''
                    }
                    ${
                      o.status === 'unpaid' || o.status === 'ready' || o.status === 'paid'
                        ? `<button class="btn btn-sm btn-danger" data-act="cancel" data-id="${o.id}">取消</button>`
                        : ''
                    }
                  </div>
                </td>
              </tr>`
                    )
                    .join('')
                : `<tr><td colspan="7"><div class="empty"><div class="icon">🧾</div>暂无订单</div></td></tr>`
            }
          </tbody>
        </table>
      </div>
      ${pagination(res.page, res.pageSize, res.total, 'data-page')}`;
  },

  /* ========== 自提点 ========== */
  async pickup(ctx) {
    const list = await api.get('/api/admin/pickup-points');
    return `
      <div class="toolbar">
        <div class="spacer"></div>
        ${hasPerm('pickup:admin') ? `<button class="btn btn-primary" id="pp-add">+ 新建自提点</button>` : ''}
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>名称</th><th>地址</th><th>电话</th><th>营业时间</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            ${
              list.length
                ? list
                    .map(
                      (p) => `
              <tr>
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td>${escapeHtml(p.address)}</td>
                <td>${escapeHtml(p.phone)}</td>
                <td>${escapeHtml(p.openTime)}</td>
                <td>${p.status !== 'disabled' ? '<span class="tag tag-green">启用</span>' : '<span class="tag tag-gray">停用</span>'}</td>
                <td>${hasPerm('pickup:admin') ? `<button class="btn btn-sm" data-act="edit" data-id="${p.id}">编辑</button>` : '—'}</td>
              </tr>`
                    )
                    .join('')
                : `<tr><td colspan="6"><div class="empty"><div class="icon">📍</div>暂无自提点</div></td></tr>`
            }
          </tbody>
        </table>
      </div>`;
  },

  /* ========== 用户角色 ========== */
  async users(ctx) {
    const list = await api.get('/api/admin/users');
    return `
      <div class="card">
        <div class="card-head">
          <h3>用户与角色</h3>
          <span class="muted">授予 staff 后，该用户小程序内可见管理功能</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>用户</th><th>手机号</th><th>角色</th><th>注册时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              ${list
                .map(
                  (u) => `
                <tr>
                  <td>
                    <div class="row-title">
                      <div class="avatar" style="width:36px;height:36px;font-size:13px">${escapeHtml((u.nickname || 'U')[0])}</div>
                      <div>
                        <strong>${escapeHtml(u.nickname)}</strong>
                        <small>${escapeHtml(u.username || '小程序用户')}</small>
                      </div>
                    </div>
                  </td>
                  <td>${escapeHtml(u.phone || '—')}</td>
                  <td>
                    ${(u.roles || [])
                      .map((r) => {
                        const map = { admin: ['超级管理员', 'tag-red'], staff: ['团长', 'tag-green'], buyer: ['买家', 'tag-gray'] };
                        const [label, cls] = map[r] || [r, 'tag-blue'];
                        return `<span class="tag ${cls}">${label}</span>`;
                      })
                      .join(' ')}
                  </td>
                  <td>${fmtTime(u.createdAt)}</td>
                  <td><button class="btn btn-sm" data-act="roles" data-id="${u.id}" data-roles="${(u.roles || []).join(',')}" data-name="${escapeHtml(u.nickname)}">设权限</button></td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },
};

/* UI 工具 */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function toast(msg, type = 'ok') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2200);
}

function openModal(html) {
  $('#modal-box').innerHTML = html;
  $('#modal-root').classList.remove('hidden');
}

function closeModal() {
  $('#modal-root').classList.add('hidden');
  $('#modal-box').innerHTML = '';
}

function fmtMoney(n) {
  return `¥${Number(n || 0).toFixed(2)}`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ORDER_STATUS = {
  unpaid: { label: '待支付', cls: 'tag-orange' },
  paid: { label: '已支付', cls: 'tag-blue' },
  ready: { label: '待提货', cls: 'tag-green' },
  verified: { label: '已核销', cls: 'tag-gray' },
  cancelled: { label: '已取消', cls: 'tag-red' },
};

function statusTag(status) {
  const s = ORDER_STATUS[status] || { label: status, cls: 'tag-gray' };
  return `<span class="tag ${s.cls}">${s.label}</span>`;
}

function payTags(o) {
  const mode = o.payMode === 'cod'
    ? '<span class="tag tag-orange">到店付款</span>'
    : '<span class="tag tag-blue">在线支付</span>';
  const paid = o.paid || o.paidAt
    ? '<span class="tag tag-green">已付款</span>'
    : '<span class="tag tag-red">未付款</span>';
  return mode + ' ' + paid;
}

// 显式挂到全局，避免部分加载顺序/缓存下不可见
window.payTags = payTags;
window.statusTag = statusTag;
window.fmtMoney = fmtMoney;
window.fmtTime = fmtTime;
window.escapeHtml = escapeHtml;

function hasPerm(p) {
  const u = api.user;
  if (!u) return false;
  if ((u.roles || []).includes('admin')) return true;
  return (u.permissions || []).includes(p);
}

function pagination(page, pageSize, total, onAttr) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return `
    <div class="pagination">
      <span>共 ${total} 条 · 第 ${page}/${pages} 页</span>
      <button class="btn btn-sm" ${onAttr}="goto:${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button>
      <button class="btn btn-sm" ${onAttr}="goto:${page + 1}" ${page >= pages ? 'disabled' : ''}>下一页</button>
    </div>`;
}

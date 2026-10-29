/* API 封装 */
// 本地 http://127.0.0.1:8080 调试时指向本机 3000；部署到服务器后自动同源
const API_BASE = (() => {
  if (location.protocol === 'file:') return 'http://127.0.0.1:3000';
  if (location.port === '8080') return 'http://127.0.0.1:3000';
  return location.origin;
})();

const api = {
  token: localStorage.getItem('admin_token') || '',
  user: JSON.parse(localStorage.getItem('admin_user') || 'null'),

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(user));
  },

  clearAuth() {
    this.token = '';
    this.user = null;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  },

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(API_BASE + path, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = { code: res.status, msg: '响应解析失败' };
    }
    if (res.status === 401) {
      this.clearAuth();
      window.dispatchEvent(new CustomEvent('auth:logout'));
      throw new Error(data.msg || '登录已过期');
    }
    if (!res.ok || (data.code && data.code !== 0)) {
      throw new Error(data.msg || `请求失败 (${res.status})`);
    }
    return data.data !== undefined ? data.data : data;
  },

  get(path) {
    return this.request(path);
  },
  post(path, body) {
    return this.request(path, { method: 'POST', body });
  },
  put(path, body) {
    return this.request(path, { method: 'PUT', body });
  },
  patch(path, body) {
    return this.request(path, { method: 'PATCH', body });
  },
  del(path) {
    return this.request(path, { method: 'DELETE' });
  },

  login(username, password) {
    return this.request('/api/auth/login', { method: 'POST', body: { username, password } });
  },
  me() {
    return this.get('/api/auth/me');
  },
};

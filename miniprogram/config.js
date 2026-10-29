/**
 * 小程序运行配置（仅客户端可见信息，禁止放 AppSecret）
 *
 * ENV 一键切换：
 *   'local'  → 本机模拟器调试，连本地 127.0.0.1:3000
 *   'lan'    → 手机真机调试，连同一 Wi-Fi 下电脑的局域网 IP
 *   'remote' → 连远程云服务器（手机不在电脑前也能用）
 */
const ENV = 'local'; // ← 改这里即可切换

const HOSTS = {
  local: { host: '127.0.0.1', port: 3000 },
  // 手机与电脑同一 Wi-Fi 时使用；换网络后更新此 IP
  lan: { host: '192.168.10.61', port: 3000 },
  remote: { host: '47.96.251.224', port: 3000 },
};

const current = HOSTS[ENV] || HOSTS.local;

module.exports = {
  ENV,
  HOSTS,
  current,
  BASE_URL: `http://${current.host}:${current.port}`,
};

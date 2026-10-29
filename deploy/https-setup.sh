#!/usr/bin/env bash
# 一键给 API 配 HTTPS（Caddy 自动证书）
# 用法：sudo bash deploy/https-setup.sh api.example.com
set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "用法: sudo bash https-setup.sh api.example.com"
  exit 1
fi

if [ "$(id -u)" != "0" ]; then
  echo "请用 root 或 sudo 执行"
  exit 1
fi

echo "==> 安装 Caddy（若未安装）"
if ! command -v caddy >/dev/null 2>&1; then
  apt install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt update
  apt install -y caddy
fi

echo "==> 写入 Caddyfile（$DOMAIN → 127.0.0.1:3000）"
cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%s)" 2>/dev/null || true
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}
EOF

echo "==> 重载 Caddy"
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy

sleep 2
echo "==> 本机自检"
curl -s -o /dev/null -w "https://$DOMAIN/api/health -> %{http_code}\n" "https://$DOMAIN/api/health" || true

echo
echo "完成。请确认："
echo "1) 阿里云安全组已放行 80、443"
echo "2) 域名解析 A 记录已指向本机公网 IP"
echo "3) 微信公众平台已把 https://$DOMAIN 加入 request 合法域名"

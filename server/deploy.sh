#!/usr/bin/env bash
# 社区团购 API 远程部署脚本（Ubuntu 22.04+，含 26.04）
# 在服务器上执行：bash deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装："
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "  sudo apt install -y nodejs"
  exit 1
fi

echo "==> Node $(node -v)"

echo "==> 安装依赖"
npm install --omit=dev

echo "==> 写入环境变量（如需改密钥，编辑 .env 或此文件）"
cat > .env <<'EOF'
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
JWT_SECRET=change-me-community-groupbuy-2026
WECHAT_APPID=wxa961eae1c6580e6a
WECHAT_SECRET=30564a9c33d436958c5ffcde522a8536
EOF

echo "==> 注册并启动 systemd 服务"
sudo tee /etc/systemd/system/community-groupbuy.service >/dev/null <<EOF
[Unit]
Description=Community Groupbuy API
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$(command -v node) $APP_DIR/src/index.js
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable community-groupbuy
sudo systemctl restart community-groupbuy

sleep 1
echo "==> 本机健康检查"
curl -s "http://127.0.0.1:3000/api/health" && echo
echo "==> 状态"
sudo systemctl --no-pager status community-groupbuy | head -12 || true
echo
echo "公网访问：http://<服务器公网IP>:3000/api/health"
echo "查看日志：sudo journalctl -u community-groupbuy -f"

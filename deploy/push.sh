#!/usr/bin/env bash
# 一键推送并部署到阿里云服务器
# 用法：bash deploy/push.sh
set -euo pipefail

HOST="${HOST:-root@47.96.251.224}"
REMOTE_DIR="${REMOTE_DIR:-/opt/groupbuy}"
PKG="$(cd "$(dirname "$0")" && pwd)/community-groupbuy-deploy.tar.gz"

if [ ! -f "$PKG" ]; then
  echo "找不到部署包：$PKG"
  exit 1
fi

echo "==> 上传部署包到 $HOST"
scp "$PKG" "$HOST:/root/"

echo "==> 远程解压并部署"
ssh "$HOST" "set -e
  mkdir -p $REMOTE_DIR
  cd $REMOTE_DIR
  tar -xzf /root/community-groupbuy-deploy.tar.gz
  echo '--- 检查 admin ---'
  ls -l $REMOTE_DIR/admin/index.html
  echo '--- 执行 deploy.sh ---'
  bash deploy.sh
  echo '--- 自检 ---'
  curl -s -o /dev/null -w 'admin:%{http_code}\n' http://127.0.0.1:3000/admin/
  curl -s http://127.0.0.1:3000/api/health
"

echo
echo "完成：http://47.96.251.224:3000/admin/"

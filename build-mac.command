#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "==> SkillDock 打包脚本"
if ! command -v npm >/dev/null 2>&1; then
  echo "未找到 npm，请先安装 Node.js 20+：https://nodejs.org/"
  read -r -p "按回车退出..."
  exit 1
fi
echo "==> 安装依赖（首次会下载 Electron，约几分钟）"
npm install --no-audit --no-fund
echo "==> 打包 macOS 版本"
npm run dist:mac
echo "==> 完成，打开 release 目录"
open release

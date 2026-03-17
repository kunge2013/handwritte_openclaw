#!/usr/bin/env bash

# GitHub Helper - 创建 Issue 脚本
#
# 用法: ./create-issue.sh <repo> <title> <body>
#
# 示例: ./create-issue.sh owner/repo "Issue Title" "Issue description"

set -e

# 检查参数
if [ $# -lt 2 ]; then
  echo "用法: $0 <repo> <title> [body]"
  echo "示例: $0 owner/repo 'Issue Title' 'Issue description'"
  exit 1
fi

REPO="$1"
TITLE="$2"
BODY="${3:-}"

# 检查环境变量
if [ -z "$GITHUB_TOKEN" ]; then
  echo "错误: GITHUB_TOKEN 环境变量未设置"
  echo "请设置 GitHub Personal Access Token"
  exit 1
fi

# 构建 API 请求
API_URL="https://api.github.com/repos/${REPO}/issues"

# 发送请求
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{\"title\":\"${TITLE}\",\"body\":\"${BODY}\"}")

# 检查响应
if echo "$RESPONSE" | grep -q '"html_url"'; then
  ISSUE_URL=$(echo "$RESPONSE" | grep -o '"html_url":"[^"]*"' | cut -d'"' -f4)
  echo "✓ Issue 创建成功: $ISSUE_URL"
else
  echo "✗ Issue 创建失败"
  echo "$RESPONSE" | jq -r '.message' 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

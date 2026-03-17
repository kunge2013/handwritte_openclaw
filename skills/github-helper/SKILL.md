---
name: github-helper
description: GitHub 操作辅助技能
user-invocable: true
disable-model-invocation: false
emoji: 🐙
homepage: https://github.com
skillKey: github
primaryEnv: GITHUB_TOKEN
tags: git, github, version-control
os: [darwin, linux]
requires:
  bins: [git]
  env: [GITHUB_TOKEN]
  anyBins: [gh, git]
---

# GitHub Helper 技能

GitHub 操作辅助技能，提供 Git 和 GitHub 相关的操作支持。

## 功能

### Git 操作
- 创建和管理 Git 仓库
- 提交和推送代码
- 创建和管理分支

### GitHub API
- 创建和管理 Issues
- 创建和管理 Pull Requests
- 查询仓库信息
- 管理仓库设置

## 前置要求

- 安装 Git 命令行工具
- 配置 GitHub Personal Access Token (GITHUB_TOKEN)
- (可选) 安装 GitHub CLI (gh)

## 环境变量

- `GITHUB_TOKEN` - GitHub Personal Access Token (必需)

## 使用示例

### 克隆仓库
用户：帮我克隆 https://github.com/user/repo.git

### 创建 Issue
用户：在 user/repo 仓库创建一个 Issue，标题是 "Bug found"，内容是 "详细的 bug 描述"

### 查看 PR 状态
用户：检查 user/repo 仓库的所有开放 PR

## 注意事项

1. 确保 GITHUB_TOKEN 有足够的权限
2. 对于私有仓库，确保 Token 有 read/write 权限
3. 建议使用 GitHub CLI (gh) 以获得更好的体验

## 相关工具

此技能可以与以下工具配合使用：
- `bash` - 执行 shell 命令
- `read_file` - 读取文件内容
- `write_file` - 写入文件内容

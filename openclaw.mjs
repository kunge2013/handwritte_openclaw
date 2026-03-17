#!/usr/bin/env node

/**
 * OpenClaw 学习版 - CLI 入口
 */

// 动态导入主模块
import('./dist/index.js').catch((error) => {
  console.error('Failed to load OpenClaw:', error);
  process.exit(1);
});

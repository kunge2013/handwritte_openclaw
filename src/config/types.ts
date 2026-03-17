/**
 * OpenClaw Config 类型定义
 */

import type { AgentConfig } from '../agents/types.js';
import type { ChannelConfig } from '../channels/types.js';
import type { MemoryConfig } from '../memory/types.js';
import type { GatewayConfig } from '../gateway/types.js';
import type { ModelsConfig } from '../models/types.js';

/**
 * 主配置接口
 */
export interface Config {
  /** 元数据 */
  meta?: Record<string, unknown>;
  /** 模型提供者配置 */
  models?: ModelsConfig;
  /** 向导配置 */
  wizard?: Record<string, unknown>;
  /** Agent 配置 */
  agent: AgentConfig;
  /** Gateway 配置 */
  gateway: GatewayConfig;
  /** 渠道配置 */
  channels?: Record<string, unknown>;
  /** 记忆系统配置 */
  memory: MemoryConfig;
  /** 插件配置 */
  plugins: PluginConfig;
  /** Agents 配置 */
  agents?: Record<string, unknown>;
  /** 工具配置 */
  tools?: Record<string, unknown>;
  /** 绑定配置 */
  bindings?: Array<Record<string, unknown>>;
  /** 消息配置 */
  messages?: Record<string, unknown>;
  /** 命令配置 */
  commands?: Record<string, unknown>;
  /** 会话配置 */
  session?: Record<string, unknown>;
  /** Hooks 配置 */
  hooks?: Record<string, unknown>;
}

/**
 * 插件配置
 */
export interface PluginConfig {
  /**是否启用插件 */
  enabled: boolean;
  /** 是否自动加载 */
  autoLoad: boolean;
  /** 插件目录 */
  pluginDirs?: string[];
  /** 排除的插件 */
  exclude?: string[];
  /** 自定义配置 */
  customConfig?: Record<string, unknown>;
}

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误消息 */
  errors: string[];
  /** 警告消息 */
  warnings?: string[];
}

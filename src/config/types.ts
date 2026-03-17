/**
 * OpenClaw Config 类型定义
 */

import type { AgentConfig } from '../agents/types';
import type { ChannelConfig } from '../channels/types';
import type { MemoryConfig } from '../memory/types';
import type { GatewayConfig } from '../gateway/types';

/**
 * 主配置接口
 */
export interface Config {
  /** Agent 配置 */
  agent: AgentConfig;
  /** Gateway 配置 */
  gateway: GatewayConfig;
  /** 渠道配置 */
  channels: ChannelConfig[];
  /** 记忆系统配置 */
  memory: MemoryConfig;
  /** 插件配置 */
  plugins: PluginConfig;
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

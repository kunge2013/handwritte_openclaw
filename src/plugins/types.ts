/**
 * OpenClaw Plugins 类型定义
 */

/**
 * 插件配置
 */
export interface PluginConfig {
  /** 插件唯一标识 */
  id: string;
  /** 插件名称 */
  name?: string;
  /** 插件版本 */
  version?: string;
  /** 插件描述 */
  description?: string;
  /** 插件类型 */
  type?: string;
  /** 依赖的其他插件 */
  dependencies?: string[];
  /** 入口文件 */
  main?: string;
  /** 插件作者 */
  author?: string;
  /** 许可证 */
  license?: string;
  /** 插件配置项 */
  config?: Record<string, unknown>;
  /** 自定义数据 */
  customData?: Record<string, unknown>;
}

/**
 * 插件接口
 */
export interface Plugin {
  /** 插件 ID */
  id: string;
  /** 插件名称 */
  name: string;
  /** 版本 */
  version: string;
  /** 描述 */
  description: string;
  /** 插件路径 */
  path: string;
  /** 配置 */
  config: PluginConfig;
  /** 是否已启用 */
  enabled: boolean;
  /** 钩子 */
  hooks: Map<string, PluginHook>;
  /** 插件实例 */
  instance?: unknown;
}

/**
 * 钩子函数类型
 */
export type PluginHook<T = unknown> = (context: HookContext) => T | Promise<T>;

/**
 * 钩子上下文
 */
export interface HookContext {
  /** 上下文类型 */
  type: string;
  /** 关联的插件 */
  plugin?: Plugin;
  /** 时间戳 */
  timestamp: number;
  /** 用户数据 */
  data?: Record<string, unknown>;
  /** 停止传播标志 */
  stopPropagation?: () => void;
}

/**
 * 钩子事件
 */
export interface HookEvent {
  /** 钩子名称 */
  hook: string;
  /** 上下文 */
  context: HookContext;
  /** 结果 */
  result?: unknown;
}

/**
 * 插件状态
 */
export enum PluginStatus {
  /** 未加载 */
  UNLOADED = 'unloaded',
  /** 加载中 */
  LOADING = 'loading',
  /** 已加载 */
  LOADED = 'loaded',
  /** 初始化中 */
  INITIALIZING = 'initializing',
  /** 已初始化 */
  INITIALIZED = 'initialized',
  /** 启用中 */
  ENABLING = 'enabling',
  /** 已启用 */
  ENABLED = 'enabled',
  /** 禁用中 */
  DISABLING = 'disabling',
  /** 已禁用 */
  DISABLED = 'disabled',
  /** 错误 */
  ERROR = 'error',
}

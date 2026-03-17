/**
 * OpenClaw Agent 类型定义 (扩展支持技能系统)
 *
 * 【核心概念】
 * Agent 是 OpenClaw 的核心组件，现在支持：
 * 1. 技能系统集成
 * 2. 技能快照管理
 * 3. 技能命令分发
 * 4. 技能就绪性检查
 */

import type { SkillSnapshot, SkillCommandSpec } from './skills/types.js';

/**
 * 消息角色
 */
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool',
}

/**
 * 消消息接口
 */
export interface Message {
  /** 消息唯一标识 */
  id: string;
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 时间戳 */
  timestamp: number;
  /** 附加元数据 */
  metadata?: Record<string, unknown>;
  /** 工具调用（如果有） */
  toolCalls?: ToolCall[];
  /** 工具响应（如果有） */
  toolResponse?: ToolResponse;
}

/**
 * 工具调用
 */
export interface ToolCall {
  /** 工具名称 */
  name: string;
  /** 工具参数 */
  arguments: Record<string, unknown>;
  /** 调用 ID */
  callId: string;
}

/**
 * 工具响应
 */
export interface ToolResponse {
  /** 关联的调用 ID */
  callId: string;
  /** 响应内容内容 */
  content: string;
  /** 是否成功 */
  success: boolean;
}

/**
 * 工具定义
 */
export interface Tool {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 参数模式 (JSON Schema) */
  parameters?: Record<string, unknown>;
  /** 工具处理器 */
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * 技能配置 (扩展版)
 */
export interface SkillConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 环境变量覆盖 */
  env?: Record<string, string>;
  /** API 密钥 */
  key?: string;
}

/**
 * Agent 配置 (扩展支持技能系统)
 */
export interface AgentConfig {
  /** Agent 唯一标识 */
  id: string;
  /** Agent 名称 */
  name?: string;
  /** 使用的模型 */
  model?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 最大消息历史长度 */
  maxHistoryLength?: number;
  /** 温度参数 (0-1) */
  temperature?: number;
  /** 自定义配置 */
  customConfig?: Record<string, unknown>;
  /** 技能系统配置 */
  skills?: {
    /** 是否启用技能系统 */
    enabled?: boolean;
    /** 技能过滤器 */
    filter?: string[];
    /** 技能配置 */
    entries?: Record<string, SkillConfig>;
    /** 技能限制 */
    limits?: {
      maxSkillsInPrompt?: number;
      maxSkillsPromptChars?: number;
    };
  };
}

/**
 * 技能系统状态
 */
export interface SkillsSystemState {
  /** 是否启用 */
  enabled: boolean;
  /** 技能快照 */
  snapshot?: SkillSnapshot;
  /** 技能命令规范 */
  commandSpecs: SkillCommandSpec[];
  /** 加载的技能数量 */
  loadedCount: number;
  /** 就绪的技能数量 */
  eligibleCount: number;
  /** 最后更新时间 */
  lastUpdated?: number;
}

/**
 * Agent 状态
 */
export enum AgentState {
  /** 未初始化 */
  UNINITIALIZED = 'uninitialized',
  /** 连接中 */
  CONNECTING = 'connecting',
  /** 已连接 */
  CONNECTED = 'connected',
  /** 处理中 */
  PROCESSING = 'processing',
  /** 断开连接 */
  DISCONNECTED = 'disconnected',
  /** 错误状态 */
  ERROR = 'error',
}

/**
 * Agent 事件类型
 */
export type AgentEventType =
  | 'connected'
  | 'disconnected'
  | 'message'
  | 'error'
  | 'tool-call'
  | 'skill-loaded'
  | 'skill-invoked';

/**
 * Agent 事件数据
 */
export interface AgentEventEventData<T extends AgentEventType> {
  type: T;
  agentId: string;
  timestamp: number;
  data: unknown;
}

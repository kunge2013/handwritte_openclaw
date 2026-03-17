/**
 * OpenClaw Channel 类型定义
 */

/**
 * 渠道类型
 */
export enum ChannelType {
  TELEGRAM = 'telegram',
  WHATSAPP = 'whatsapp',
  SLACK = 'slack',
  DISCORD = 'discord',
  SIGNAL = 'signal',
  IMESSAGE = 'imessage',
  MATRIX = 'matrix',
  MSTEAMS = 'msteams',
  LINE = 'line',
  FEISHU = 'feishu',
  WEB = 'web',
}

/**
 * 渠道配置
 */
export interface ChannelConfig {
  /** 渠道唯一标识 */
  id: string;
  /** 渠道类型 */
  type: ChannelType;
  /** 渠道名称 */
  name?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 命令前缀 */
  commandPrefix?: string;
  /** 平台特定的配置 */
  platformConfig?: Record<string, unknown>;
  /** 自定义配置 */
  customConfig?: Record<string, unknown>;
}

/**
 * 消息
 */
export interface Message {
  /** 消息唯一标识 */
  id: string;
  /** 消息内容 */
  content: string;
  /** 时间戳 */
  timestamp: number;
  /** 发送用户 ID */
  userId: string;
  /** 所属渠道 ID */
  channelId: string;
  /** 房间 ID */
  roomId?: string;
  /** 回复的消息 ID */
  replyTo?: string;
  /** 附件 */
  attachments?: Attachment[];
  /** 消息元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 用户
 */
export interface User {
  /** 用户唯一标识 */
  id: string;
  /** 用户名 */
  name?: string;
  /** 显示名称 */
  displayName?: string;
  /** 头像 URL */
  avatarUrl?: string;
  /** 用户元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 附件
 */
export interface Attachment {
  /** 文件名 */
  filename?: string;
  /** MIME 类型 */
  mimeType?: string;
  /** 文件大小 */
  size?: number;
  /** 文件 URL */
  url?: string;
  /** 文件数据 */
  data?: Buffer;
}

/**
 * 渠道状态
 */
export enum ChannelStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * 渠道事件类型
 */
export type ChannelEventType =
  | 'connected'
  | 'disconnected'
  | 'message'
  | 'command'
  | 'error';

/**
 * 渠道能力
 */
export interface ChannelCapabilities {
  /** 是否支持富文本 */
  richText: boolean;
  /** 是否支持附件 */
  attachments: boolean;
  /** 是否支持回复 */
  replies: boolean;
  /** 是否支持编辑 */
  edit: boolean;
  /** 是否支持删除 */
  delete: boolean;
  /** 是否支持反应 */
  reactions: boolean;
  /** 是否支持输入指示器 */
  typingIndicator: boolean;
}

/**
 *   OpenClaw Gateway 类型定义
 */

/**
 * Gateway 配置
 */
export interface GatewayConfig {
  /** 服务器主机地址 */
  host: string;
  /** 服务器端口 */
  port: number;
  /** 最大连接数 */
  maxConnections?: number;
  /** 会话超时时间（毫秒） */
  sessionTimeout?: number;
  /** 是否启用 CORS */
  cors?: boolean;
  /** 自定义配置 */
  customConfig?: Record<string, unknown>;
}

/**
 * 会话
 */
export interface Session {
  /** 会话唯一标识 */
  id: string;
  /** 关联的渠道 ID */
  channelId: string;
  /** 创建时间 */
  createdAt: number;
  /** 最后活动时间 */
  lastActivity: number;
  /** 消息计数 */
  messageCount: number;
  /** 会话元数据 */
  metadata?: Record<string, unknown>;
  /** 用户 ID */
  userId?: string;
}

/**
 * 请求
 */
export interface Request {
  /** 会话 ID */
  sessionId: string;
  /** 渠道 ID */
  channelId: string;
  /** 用户 ID */
  userId?: string;
  /** 消息 */
  message: {
    /** 内容 */
    content: string;
    /** 消息类型 */
    type?: string;
    /** 附件 */
    attachments?: Attachment[];
  };
  /** 请求元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 响应
 */
export interface Response {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
  /** 响应内容 */
  content: string;
  /** 时间戳 */
  timestamp: number;
  /** 附加数据 */
  data?: Record<string, unknown>;
}

/**
 * 附件
 */
export interface Attachment {
  /** 文件名 */
  filename: string;
  /** MIME 类型 */
  mimeType: string;
  /** 文件大小 */
  size: number;
  /** 文件 URL 或数据 */
  url?: string;
  data?: Buffer;
}

/**
 * 连接信息
 */
export interface ConnectionInfo {
  /** 连接 ID */
  id: string;
  /** 远程地址 */
  remoteAddress: string;
  /** 连接时间 */
  connectedAt: number;
  /** 最后活动时间 */
  lastActivity: number;
}

/**
 * 认证信息
 */
export interface AuthInfo {
  /** 用户 ID */
  userId: string;
  /** 令牌 */
  token: string;
  /** 权限 */
  permissions: string[];
  /** 过期时间 */
  expiresAt?: number;
}

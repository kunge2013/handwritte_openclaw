/**
 * OpenClaw Memory 类型定义
 */

/**
 * 记忆条目类型
 */
export enum MemoryType {
  /** 对话消息 */
  MESSAGE = 'message',
  /** 用户记忆 */
  MEMORY = 'memory',
  /** 文档 */
  DOCUMENT = 'document',
  /** 工具调用结果 */
  TOOL_RESULT = 'tool_result',
  /** 自定义 */
  CUSTOM = 'custom',
}

/**
 * 记忆条目
 */
export interface MemoryEntry {
  /** 唯一标识 */
  id: string;
  /** 条目类型 */
  type: MemoryType;
  /** 内容 */
  content: string;
  /** 时间戳 */
  timestamp: number;
  /** 关联的会话 ID */
  sessionId?: string;
  /** 关联的用户 ID */
  userId?: string;
  /** 重要性评分 (0-1) */
  importance?: number;
  /** 附加元数据 */
  metadata?: Record<string, unknown>;
  /** 访问次数 */
  accessCount?: number;
  /** 最后访问时间 */
  lastAccessed?: number;
}

/**嵌入向量 */
export type Embedding = number[];

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 记忆条目 */
  entry: MemoryEntry;
  /** 相似度分数 (0-1) */
  similarity: number;
  /** 排名分数 */
  score?: number;
}

/**
 * 记忆配置
 */
export interface MemoryConfig {
  /** 最大条目数 */
  maxEntries: number;
  /** 是否启用嵌入 */
  enableEmbeddings: boolean;
  /** 嵌入向量维度 */
  embeddingDimension?: number;
  /** 时间衰减因子 */
  timeDecayFactor?: number;
  /** 后端类型 */
  backend?: 'sqlite' | 'lancedb' | 'remote';
  /** 后端配置 */
  backendConfig?: Record<string, unknown>;
}

/**
 * 批量操作选项
 */
export interface BatchOptions {
  /** 批量大小 */
  batchSize?: number;
  /** 并发数 */
  concurrency?: number;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  /** 结果数量限制 */
  limit?: number;
  /** 最小相似度 */
  minSimilarity?: number;
  /** 是否包含元数据 */
  includeMetadata?: boolean;
  /** 时间范围 */
  timeRange?: {
    start?: number;
    end?: number;
  };
  /** 会话过滤 */
  sessionIds?: string[];
  /** 用户过滤 */
  userIds?: string[];
  /** 类型过滤 */
  types?: MemoryType[];
}

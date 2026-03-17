/**
 * OpenClaw 模型类型定义 - 简化学习版
 *
 * 对应 openclaw.json 配置结构
 */

/**
 * 消息格式和原 OpenClaw 一致
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 模型配置（单个模型）
 */
export interface ModelConfig {
  /** 模型 ID */
  id: string;
  /** 模型显示名称 */
  name: string;
  /** 支持的输入类型 */
  input?: Array<'text' | 'image'>;
  /** 上下文窗口大小 */
  contextWindow: number;
  /** 最大输出 tokens */
  maxTokens: number;
  /** 自定义配置 */
  [key: string]: unknown;
}

/**
 * 模型提供者配置（对应 openclaw.json models.providers）
 */
export interface ModelProviderConfig {
  /** 基础 URL */
  baseUrl: string;
  /** API 密钥 */
  apiKey: string;
  /** API 类型 (openai-completions, openai-chat, 等) */
  api: string;
  /** 该提供者下的模型列表 */
  models: ModelConfig[];
  /** 失败重试等待时间（毫秒），默认 0，不等待直接重试 */
  retryDelayMs?: number;
  /** 最大重试次数，默认 1（总共最多请求 2 次：原始 + 1 次重试） */
  maxRetries?: number;
}

/**
 * 完整模型配置结构
 */
export interface ModelsConfig {
  providers: Record<string, ModelProviderConfig>;
}

/**
 * 模型引用格式 (providerId/modelId)
 */
export type ModelRef = string;

/**
 * 解析后的模型标识
 */
export interface ParsedModelRef {
  providerId: string;
  modelId: string;
}

/**
 * 解析模型引用 (格式: "providerId/modelId")
 */
export function parseModelRef(ref: ModelRef): ParsedModelRef {
  const [providerId, modelId] = ref.split('/');
  return { providerId, modelId };
}

/**
 * 完成请求选项
 */
export interface CompletionOptions {
  /** 模型引用 */
  model: ModelRef;
  /** 消息列表 */
  messages: ChatMessage[];
  /** 温度 */
  temperature?: number;
  /** 最大 tokens */
  maxTokens?: number;
  /** 是否流式返回 */
  stream?: boolean;
  /** 工具定义 (function calling) */
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  /** 工具调用选择 */
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  /** 流式回调 */
  onChunk?: (chunk: string) => void;
}

/**
 * 完成响应
 */
export interface CompletionResponse {
  /** 生成的文本内容 */
  content: string;
  /** 工具调用（如果有） */
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  /** 使用的 tokens 统计 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 使用的模型 */
  model: string;
  /** 响应 ID */
  id?: string;
}

/**
 * 模型提供者接口
 * 所有提供者都必须实现这个接口
 */
export interface ModelProvider {
  /** 提供者 ID */
  getId(): string;
  /** 获取该提供者下的模型列表 */
  getModels(): ModelConfig[];
  /** 获取指定模型配置 */
  getModel(modelId: string): ModelConfig | undefined;
  /** 调用完成 API */
  complete(options: CompletionOptions): Promise<CompletionResponse>;
}

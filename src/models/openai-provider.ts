/**
 * OpenAI 兼容格式模型提供者 - 简化学习版
 *
 * 支持火山引擎、OpenAI、DeepSeek、Doubao 等所有兼容 OpenAI API 的提供者
 */

import fetch, { type Response } from 'node-fetch';
import type {
  ModelProvider,
  ModelProviderConfig,
  ModelConfig,
  CompletionOptions,
  CompletionResponse,
  ChatMessage,
} from './types.js';

/**
 * OpenAI 兼容提供者实现
 */
export class OpenAICompatibleProvider implements ModelProvider {
  private providerId: string;
  private config: ModelProviderConfig;
  private models: Map<string, ModelConfig> = new Map();

  constructor(id: string, config: ModelProviderConfig) {
    this.providerId = id;
    this.config = config;
    // 构建模型映射
    for (const model of config.models) {
      this.models.set(model.id, model);
    }
  }

  /**
   * 获取提供者 ID
   */
  getId(): string {
    return this.providerId;
  }

  /**
   * 获取所有模型
   */
  getModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  /**
   * 获取单个模型配置
   */
  getModel(modelId: string): ModelConfig | undefined {
    return this.models.get(modelId);
  }

  /**
   * 调用 completion API
   */
  async complete(options: CompletionOptions): Promise<CompletionResponse> {
    const { model, messages, temperature = 0.7, maxTokens, stream = false, tools, onChunk } = options;
    const { providerId, modelId } = this.parseModelRef(model);

    // 获取模型配置
    const modelConfig = this.getModel(modelId);
    const actualMaxTokens = maxTokens || modelConfig?.maxTokens || 4096;

    // 构建 OpenAI 请求体
    const body: Record<string, unknown> = {
      model: modelId,
      messages: this.transformMessages(messages),
      temperature,
      max_tokens: actualMaxTokens,
      stream,
    };

    // 如果有工具，添加工具定义
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = options.toolChoice || 'auto';
    }

    // 获取完整端点
    const endpoint = this.getFullEndpoint();

    // 打印请求日志（包括 apiKey 前10字符）
    console.log(`[OpenAIProvider] 调用模型: ${model}, 端点: ${endpoint}`);
    console.log(`[OpenAIProvider] apiKey: ${this.config.apiKey.slice(0, 8)}... (${this.config.apiKey.length} chars)`);
    console.log(`[OpenAIProvider] api type: ${this.config.api}, baseUrl: ${this.config.baseUrl}`);
    console.log(`[OpenAIProvider] 请求参数: ${JSON.stringify(body, null, 2)}`);

    // 发送请求
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[OpenAIProvider] 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // 处理流式响应
    if (stream && response.body) {
      return this.handleStreamingResponse(response, onChunk);
    }

    // 处理非流式响应
    const data = await response.json() as OpenAIResponse;
    return this.transformResponse(data, model);
  }

  /**
   * 解析模型引用
   */
  private parseModelRef(modelRef: string): { providerId: string; modelId: string } {
    const parts = modelRef.split('/');
    if (parts.length === 2) {
      return { providerId: parts[0], modelId: parts[1] };
    }
    return { providerId: this.providerId, modelId: modelRef };
  }

  /**
   * 获取完整 API 端点
   * 根据 config.api 字段决定路径：
   * - "openai-completions": baseUrl 已经包含完整路径，直接使用
   * - "openai": baseUrl + /chat/completions (baseUrl 已经包含 /v3)
   * - 其他自定义路径直接使用
   */
  private getFullEndpoint(): string {
    let baseUrl = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;

    const apiType = this.config.api || 'openai';

    // 当 api 是 "openai-completions" 时，baseUrl 已经是完整的 completions 路径
    if (apiType === 'openai-completions') {
      return baseUrl;
    }

    // 标准 OpenAI 兼容格式，需要追加 /chat/completions
    // 火山方舟 baseUrl 已经是 https://ark.cn-beijing.volces.com/api/v3
    // 所以只需要追加 /chat/completions
    if (apiType === 'openai') {
      return `${baseUrl}/chat/completions`;
    }

    // 其他自定义 api 类型，直接使用 baseUrl
    return baseUrl;
  }

  /**
   * 转换消息为 OpenAI 格式
   */
  private transformMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map(msg => {
      const openaiMsg: OpenAIMessage = {
        role: msg.role,
        content: msg.content,
      };
      if (msg.tool_calls) {
        openaiMsg.tool_calls = msg.tool_calls;
      }
      if (msg.tool_call_id) {
        openaiMsg.tool_call_id = msg.tool_call_id;
      }
      return openaiMsg;
    });
  }

  /**
   * 转换 OpenAI 响应为内部格式
   */
  private transformResponse(data: OpenAIResponse, modelRef: string): CompletionResponse {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('[OpenAIProvider] 响应中没有 choices');
    }

    const message = choice.message;
    const result: CompletionResponse = {
      content: message.content || '',
      model: modelRef,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      id: data.id,
    };

    // 解析工具调用
    if (message.tool_calls && message.tool_calls.length > 0) {
      result.toolCalls = message.tool_calls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: this.parseArguments(tc.function.arguments),
      }));
    }

    return result;
  }

  /**
   * 解析工具调用参数（可能是 JSON 字符串）
   */
  private parseArguments(args: string): Record<string, unknown> {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch (e) {
      // 如果解析失败，返回原始字符串
      return { raw: args };
    }
  }

  /**
   * 处理流式响应
   */
  private async handleStreamingResponse(
    response: Response,
    onChunk?: (chunk: string) => void
  ): Promise<CompletionResponse> {
    if (!response.body || !onChunk) {
      throw new Error('[OpenAIProvider] 流式响应需要 onChunk 回调');
    }

    let fullContent = '';

    // 逐行处理 SSE
    for await (const chunk of response.body as unknown as AsyncIterable<Buffer>) {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            continue;
          }
          try {
            const parsed = JSON.parse(data) as OpenAIStreamChunk;
            const delta = parsed.choices[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    return {
      content: fullContent,
      model: '', // 需要从响应头获取，简化版省略
    };
  }
}

/**
 * OpenAI 响应格式（简化）
 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI 消息格式
 */
interface OpenAIMessage {
  role: string;
  content: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

/**
 * OpenAI 流式块
 */
interface OpenAIStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
    };
  }>;
}

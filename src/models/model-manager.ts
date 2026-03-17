/**
 * 模型管理器 - 简化学习版
 *
 * 【核心概念】
 * 1. 从配置加载模型提供者
 * 2. 根据模型引用获取对应的提供者和模型
 * 3. 支持动态添加提供者
 * 4. 统一调用接口
 */

import { OpenAICompatibleProvider } from './openai-provider.js';
import type {
  ModelsConfig,
  ModelProvider,
  ModelProviderConfig,
  ModelRef,
  ParsedModelRef,
  CompletionOptions,
  CompletionResponse,
  ModelConfig,
} from './types.js';
import { parseModelRef } from './types.js';

/**
 * 模型管理器
 */
export class ModelManager {
  private providers: Map<string, ModelProvider> = new Map();

  constructor() {
    console.log('[ModelManager] 初始化');
  }

  /**
   * 从配置加载所有提供者
   * 对应 openclaw.json 中的 models.providers 结构
   */
  loadFromConfig(config: ModelsConfig): void {
    console.log(`[ModelManager] 开始加载提供者，总数: ${Object.keys(config.providers).length}`);
    for (const [providerId, providerConfig] of Object.entries(config.providers)) {
      console.log(`[ModelManager] 加载提供者: ${providerId}`);
      this.loadProvider(providerId, providerConfig);
    }
    console.log(`[ModelManager] 已加载 ${this.providers.size} 个提供者`);
    this.listModels();
  }

  /**
   * 加载单个提供者
   */
  loadProvider(providerId: string, config: ModelProviderConfig): void {
    // 根据 API 类型创建提供者实例
    // 支持:
    // - openai, openai-chat, openai-completions 都是 OpenAI 兼容格式
    // 区别只是是否自动追加路径:
    // - openai: baseUrl + /v1/chat/completions
    // - openai-completions: baseUrl 已经是完整路径，直接使用
    if (config.api === 'openai-completions' || config.api === 'openai-chat' || config.api === 'openai') {
      const provider = new OpenAICompatibleProvider(providerId, config);
      this.providers.set(providerId, provider);
      console.log(`[ModelManager] 加载提供者: ${providerId} (${config.models.length} 个模型)`);
    } else {
      console.warn(`[ModelManager] 不支持的 API 类型: ${config.api} (提供者: ${providerId})`);
    }
  }

  /**
   * 获取提供者
   */
  getProvider(providerId: string): ModelProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * 获取所有提供者
   */
  getAllProviders(): ModelProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * 根据模型引用解析并获取提供者和模型
   */
  resolveModel(modelRef: ModelRef): {
    provider: ModelProvider;
    model: ModelConfig;
    parsed: ParsedModelRef;
  } | null {
    const parsed = parseModelRef(modelRef);
    const provider = this.providers.get(parsed.providerId);
    if (!provider) {
      console.error(`[ModelManager] 提供者不存在: ${parsed.providerId}`);
      return null;
    }
    const model = provider.getModel(parsed.modelId);
    if (!model) {
      console.error(`[ModelManager] 模型不存在: ${parsed.modelId} (提供者: ${parsed.providerId})`);
      return null;
    }
    return { provider, model, parsed };
  }

  /**
   * 调用模型 completion
   */
  async complete(options: CompletionOptions): Promise<CompletionResponse> {
    const resolved = this.resolveModel(options.model);
    if (!resolved) {
      throw new Error(`[ModelManager] 无法解析模型: ${options.model}`);
    }
    return resolved.provider.complete(options);
  }

  /**
   * 列出所有已加载的模型
   */
  listModels(): void {
    console.log('[ModelManager] 已加载模型:');
    for (const provider of this.providers.values()) {
      for (const model of provider.getModels()) {
        console.log(`  - ${provider.getId()}/${model.id}: ${model.name} (${model.contextWindow} ctx)`);
      }
    }
  }

  /**
   * 关闭所有连接
   */
  shutdown(): void {
    this.providers.clear();
    console.log('[ModelManager] 已关闭');
  }
}

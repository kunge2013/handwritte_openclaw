/**
 * OpenClaw Memory 记忆系统 - 简化学习版
 *
 * 【核心概念】
 * Memory 系统是 OpenClaw 的记忆和 RAG (Retrieval-Augmented Generation) 实现，负责：
 * 1. 存储对话历史和用户记忆
 * 2. 文本嵌入 (Embedding) 向量化
 * 3. 向量相似度搜索
 * 4. 时间衰减和重要性排序
 *
 * 架构:
 * ┌─────────────┐
 * │   Message   │  消息存储
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 * │ Embedder    │  文本向量化
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 │  Vector DB   │  向量存储 (SQLite-vec/LanceDB)
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 │   Search    │  相似度检索
 * └─────────────┘
 */

import type { MemoryConfig, MemoryEntry, SearchResult, Embedding } from './types.js';
import { MemoryType } from './types.js';

/**
 * 记忆管理器
 */
export class MemoryManager {
  private config: MemoryConfig;
  private entries: Map<string, MemoryEntry> = new Map();
  private embeddings: Map<string, Embedding> = new Map();
  private initialized: boolean = false;

  constructor(config: MemoryConfig) {
    this.config = config;
  }

  /**
   * 初始化记忆系统
   */
  async initialize(): Promise<void> {
    console.log('[Memory] 正在初始化记忆系统...');

    // 模拟初始化过程
    await new Promise(resolve => setTimeout(resolve, 100));

    this.initialized = true;
    console.log('[Memory] 记忆系统初始化完成');
  }

  /**
   * 添加记忆条目
   */
  async addEntry(entry: MemoryEntry): Promise<void> {
    if (!this.initialized) {
      throw new Error('记忆系统未初始化');
    }

    console.log(`[Memory] 添加记忆: ${entry.content.substring(0, 50)}...`);

    // 存储条目
    this.entries.set(entry.id, entry);

    // 如果启用了嵌入，则生成并存储向量
    if (this.config.enableEmbeddings) {
      const embedding = await this.generateEmbedding(entry.content);
      this.embeddings.set(entry.id, embedding);
    }

    // 限制条目数量
    if (this.entries.size > this.config.maxEntries) {
      await this.pruneOldEntries();
    }
  }

  /**
   * 搜索相关记忆
   */
  async search(query: string, options?: {
    limit?: number;
    minSimilarity?: number;
  }): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new Error('记忆系统未初始化');
    }

    console.log(`[Memory] 搜索: "${query}"`);

    const limit = options?.limit || 10;
    const minSimilarity = options?.minSimilarity || 0.7;

    // 生成查询的嵌入向量
    const queryEmbedding = await this.generateEmbedding(query);

    // 计算相似度
    const results: SearchResult[] = [];

    for (const [id, entry] of this.entries.entries()) {
      const embedding = this.embeddings.get(id);

      if (embedding) {
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);

        if (similarity >= minSimilarity) {
          results.push({
            entry,
            similarity,
          });
        }
      }
    }

    // 按相似度排序并返回前 N 个
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * 获取记忆条目
   */
  getEntry(id: string): MemoryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * 获取所有条目
   */
  getAllEntries(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * 更新条目
   */
  async updateEntry(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    const entry = this.entries.get(id);

    if (!entry) {
      throw new Error(`条目不存在: ${id}`);
    }

    // 更新条目
    const updated = { ...entry, ...updates };
    this.entries.set(id, updated);

    // 如果内容变更，重新生成嵌入
    if (updates.content && this.config.enableEmbeddings) {
      const embedding = await this.generateEmbedding(updates.content);
      this.embeddings.set(id, embedding);
    }
  }

  /**
   * 删除条目
   */
  async deleteEntry(id: string): Promise<void> {
    this.entries.delete(id);
    this.embeddings.delete(id);
  }

  /**
   * 清空所有条目
   */
  async clear(): Promise<void> {
    this.entries.clear();
    this.embeddings.clear();
    console.log('[Memory] 已清空所有记忆');
  }

  /**
   * 生成文本嵌入向量
   *
   * 在真实项目中，这里会调用嵌入服务（如 OpenAI Embeddings）
   */
  private async generateEmbedding(text: string): Promise<Embedding> {
    // 模拟 API 调用延迟
    await new Promise(resolve => setTimeout(resolve, 50));

    // 简化版的嵌入生成
    // 在真实项目中，这里会调用实际的嵌入服务
    const dimension = this.config.embeddingDimension || 384;
    const vector: number[] = [];

    // 生成伪随机向量（仅用于演示）
    const hash = this.hashString(text);
    for (let i = 0; i < dimension; i++) {
      vector.push(Math.sin(hash + i));
    }

    // 归一化
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map(v => v / magnitude);
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: Embedding, b: Embedding): number {
    if (a.length !== b.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
  }

  /**
   * 剪除旧条目
   */
  private async pruneOldEntries(): Promise<void> {
    // 按时间排序并删除最旧的
    const entries = Array.from(this.entries.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toDelete = entries.slice(0, entries.length - this.config.maxEntries);

    for (const [id] of toDelete) {
      await this.deleteEntry(id);
    }

    console.log(`[Memory] 已剪除 ${toDelete.length} 个旧条目`);
  }

  /**
   * 字符串哈希（用于生成确定性的向量）
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * 获取统计信息
   */
  getStats(): { entries: number; embeddings: number; initialized: boolean } {
    return {
      entries: this.entries.size,
      embeddings: this.embeddings.size,
      initialized: this.initialized,
    };
  }
}

/**
 * 记忆构建器
 * 提供便捷的 API 来构建和添加记忆
 */
export class MemoryBuilder {
  private manager: MemoryManager;

  constructor(manager: MemoryManager) {
    this.manager = manager;
  }

  /**
   * 添加对话消息
   */
  async addConversationMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const entry: MemoryEntry = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: MemoryType.MESSAGE,
      content,
      sessionId,
      metadata: {
        role,
        ...metadata,
      },
      timestamp: Date.now(),
      importance: 1.0,
    };

    await this.manager.addEntry(entry);
  }

  /**
   * 添加用户记忆
   */
  async addUserMemory(
    userId: string,
    key: string,
    value: string,
  ): Promise<void> {
    const entry: MemoryEntry = {
      id: `memory_${userId}_${key}_${Date.now()}`,
      type: MemoryType.MEMORY,
      content: `${key}: ${value}`,
      userId,
      metadata: { key },
      timestamp: Date.now(),
      importance: 0.8,
    };

    await this.manager.addEntry(entry);
  }

  /**
   * 添加文档
   */
  async addDocument(
    sessionId: string,
    title: string,
    content: string,
  ): Promise<void> {
    const entry: MemoryEntry = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: MemoryType.DOCUMENT,
      content: `${title}\n\n${content}`,
      sessionId,
      metadata: { title },
      timestamp: Date.now(),
      importance: 0.9,
    };

    await this.manager.addEntry(entry);
  }
}

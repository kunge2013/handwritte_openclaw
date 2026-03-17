/**
 * 会话工具结果防护 - 简化学习版
 *
 * 【核心概念】
 * - 跟踪未完成的工具调用
 * - 为严格提供者合成缺失的工具结果
 * - 标准化工具结果名称
 * - 对工具结果应用大小上限
 * - 在写入消息前运行 before_message_write 钩子
 */

import type { ToolCall, ToolResponse } from './types.js';

/**
 * 工具调用跟踪记录
 */
interface TrackedToolCall {
  toolCall: ToolCall;
  timestamp: number;
  completed: boolean;
  result?: ToolResponse;
}

/**
 * 会话工具结果防护
 */
export class SessionToolResultGuard {
  private trackedCalls: Map<string, TrackedToolCall> = new Map();
  private maxResultSizeBytes: number;

  constructor(options: { maxResultSizeBytes?: number } = {}) {
    this.maxResultSizeBytes = options.maxResultSizeBytes || 100_000; // 默认 100KB
  }

  /**
   * 跟踪一个新的工具调用
   */
  trackToolCall(toolCall: ToolCall): void {
    this.trackedCalls.set(toolCall.callId, {
      toolCall,
      timestamp: Date.now(),
      completed: false,
    });
  }

  /**
   * 标记工具调用完成，存储结果
   */
  completeToolCall(callId: string, result: ToolResponse): void {
    const tracked = this.trackedCalls.get(callId);
    if (tracked) {
      tracked.completed = true;
      // 检查结果大小，超限截断
      if (result.content.length > this.maxResultSizeBytes) {
        result.content = this.truncateResult(result.content, this.maxResultSizeBytes);
      }
      tracked.result = result;
    }
  }

  /**
   * 获取未完成的工具调用 ID 列表
   */
  getIncompleteToolCalls(): string[] {
    return Array.from(this.trackedCalls.entries())
      .filter(([_, tracked]) => !tracked.completed)
      .map(([id, _]) => id);
  }

  /**
   * 检查是否所有工具调用都完成
   */
  allToolCallsComplete(): boolean {
    return this.getIncompleteToolCalls().length === 0;
  }

  /**
   * 为严格提供者合成缺失的工具结果
   * 一些 LLM 提供者在多个工具调用时可能不请求完整结果
   */
  synthesizeMissingResults(): ToolResponse[] {
    const missing: ToolResponse[] = [];

    for (const [callId, tracked] of this.trackedCalls.entries()) {
      if (!tracked.completed) {
        missing.push({
          callId,
          content: '[No result received for this tool call]',
          success: false,
        });
      }
    }

    return missing;
  }

  /**
   * 获取所有已完成的工具结果
   */
  getCompletedResults(): ToolResponse[] {
    return Array.from(this.trackedCalls.values())
      .filter(t => t.completed && t.result)
      .map(t => t.result!);
  }

  /**
   * 清空所有跟踪
   */
  clear(): void {
    this.trackedCalls.clear();
  }

  /**
   * 截断超限结果
   */
  private truncateResult(content: string, maxBytes: number): string {
    const truncated = content.slice(0, maxBytes);
    return `${truncated}\n\n[... 结果被截断，总大小超过 ${maxBytes} 字节 ...]`;
  }
}

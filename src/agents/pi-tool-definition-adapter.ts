/**
 * 工具定义格式转换适配器 - 简化学习版
 *
 * 【核心概念】
 * 将 OpenClaw 内部工具定义转换为 pi-coding-agent 期望的格式
 * 处理参数标准化和结果标准化
 */

import type { Tool } from './types.js';

/**
 * 标准工具定义（适配后）
 */
export interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (...args: unknown[]) => Promise<unknown>;
}

/**
 * 拆分工具执行参数（处理新旧两种参数签名）
 */
export function splitToolExecuteArgs(args: unknown[]): {
  toolCallId: string;
  params: Record<string, unknown>;
  signal?: AbortSignal;
  onUpdate?: (data: unknown) => void;
} {
  // 新签名: (toolCallId, params, signal, onUpdate)
  if (args.length >= 2 && typeof args[0] === 'string') {
    return {
      toolCallId: args[0] as string,
      params: args[1] as Record<string, unknown>,
      signal: args[2] as AbortSignal | undefined,
      onUpdate: args[3] as (data: unknown) => void | undefined,
    };
  }
  // 兼容旧签名: (params)
  return {
    toolCallId: `call_${Date.now()}`,
    params: args[0] as Record<string, unknown>,
  };
}

/**
 * 标准化工具执行结果
 */
export function normalizeToolExecutionResult(result: {
  toolName: string;
  result: unknown;
}): {
  content: Array<{ type: string; text: string }>;
  details: unknown;
} {
  // 如果已经是标准格式，直接返回
  if (
    result &&
    typeof result === 'object' &&
    'content' in result &&
    Array.isArray((result as any).content)
  ) {
    return result as any;
  }

  // 否则转换为标准格式
  const text = typeof result.result === 'string'
    ? result.result
    : JSON.stringify(result.result, null, 2);

  return {
    content: [{ type: 'text', text }],
    details: result.result,
  };
}

/**
 * 将内部工具数组转换为适配后的工具定义
 */
export function toToolDefinitions(tools: Tool[]): ToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    label: tool.name,
    description: tool.description || '',
    parameters: tool.parameters || {},
    execute: async (...args: unknown[]): Promise<unknown> => {
      const { toolCallId, params } = splitToolExecuteArgs(args);

      // 执行工具
      const rawResult = await tool.handler(params);

      // 标准化结果
      return normalizeToolExecutionResult({
        toolName: tool.name,
        result: rawResult,
      });
    },
  }));
}

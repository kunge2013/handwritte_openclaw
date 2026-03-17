/**
 * 嵌入式运行器提示词构建器 - 简化学习版
 *
 * 【核心概念】
 * 这是 `buildAgentSystemPrompt` 的嵌入式包装器，用于子代理运行
 * 提取工具信息，然后调用主构建器
 */

import { buildAgentSystemPrompt, buildToolSummaryMap } from '../system-prompt.js';
import type { Tool } from '../types.js';
import type { BuildAgentSystemPromptOptions, PromptMode } from '../system-prompt.js';

/**
 * 构建嵌入式系统提示词参数
 */
export interface BuildEmbeddedSystemPromptOptions {
  /** 工作目录 */
  workspaceDir: string;
  /** 可用工具列表 */
  tools: Tool[];
  /** 提示词模式，默认为 minimal（子代理使用 minimal） */
  mode?: PromptMode;
  /** 运行时信息 */
  runtimeInfo?: BuildAgentSystemPromptOptions['runtimeInfo'];
  /** 沙箱信息 */
  sandboxInfo?: string;
  /** 额外系统提示 */
  extraSystemPrompt?: string;
  /** 是否启用推理标签 */
  reasoningTagHint?: boolean;
}

/**
 * 构建嵌入式（子代理）系统提示词
 */
export function buildEmbeddedSystemPrompt(options: BuildEmbeddedSystemPromptOptions): string {
  const { workspaceDir, tools, mode = 'minimal', runtimeInfo, sandboxInfo, extraSystemPrompt, reasoningTagHint } = options;

  // 提取工具名称列表和构建摘要映射
  const toolNames = tools.map(t => t.name);
  const toolSummaries = buildToolSummaryMap(tools);

  // 调用主构建器
  return buildAgentSystemPrompt({
    mode,
    workspaceDir,
    tools,
    runtimeInfo,
    extraSystemPrompt,
    reasoningTagHint: reasoningTagHint ?? true, // 子代理默认启用推理标签
    ...(sandboxInfo ? {
      contextFiles: [{
        path: 'sandbox-info.txt',
        content: sandboxInfo
      }]
    } : {})
  });
}

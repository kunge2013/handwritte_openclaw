/**
 * OpenClaw 提示词构建器 - 简化学习版
 *
 * 【核心概念】
 * 采用模块化章节拼接方式构建系统提示词：
 * - 支持三种提示词模式: full | minimal | none
 * - 条件性包含章节（仅当参数提供时才添加）
 * - 按固定顺序拼接各个章节
 *
 * 按照 agent_设计.md 的设计实现
 */

import type { Tool } from './types.js';

/**
 * 提示词模式
 */
export type PromptMode = 'full' | 'minimal' | 'none';

/**
 * 构建提示词的参数
 */
export interface BuildAgentSystemPromptOptions {
  /** 提示词模式 */
  mode?: PromptMode;
  /** 工作目录路径 */
  workspaceDir?: string;
  /** 可用工具列表 */
  tools?: Tool[];
  /** 额外系统提示 */
  extraSystemPrompt?: string;
  /** 用户时区 */
  userTimezone?: string;
  /** 当前用户时间 */
  userTime?: string;
  /** 是否提示使用 <think> 标签 */
  reasoningTagHint?: boolean;
  /** 模型别名定义 */
  modelAliases?: Record<string, string>;
  /** 授权发送者号码列表 */
  ownerNumbers?: string[];
  /** 运行时元数据 */
  runtimeInfo?: {
    agentId: string;
    host: string;
    os: string;
    arch: string;
    nodeVersion: string;
    model: string;
    channel: string;
  };
  /** 记忆引用模式 */
  memoryCitationsMode?: 'none' | 'inline' | 'footnote';
  /** 是否启用 ACP */
  acpEnabled?: boolean;
  /** 注入的上下文文件内容 */
  contextFiles?: Array<{ path: string; content: string }>;
}

/**
 * 构建 Agent 系统提示词
 *
 * 按照模块化章节顺序拼接，简化版本只保留核心章节
 */
export function buildAgentSystemPrompt(options: BuildAgentSystemPromptOptions): string {
  const { mode = 'full' } = options;

  // none 模式: 只返回基础身份
  if (mode === 'none') {
    return 'You are a personal assistant running inside OpenClaw.';
  }

  const sections: string[] = [];

  // 1. 身份 - 总是包含
  sections.push('You are a personal assistant running inside OpenClaw.');

  // 2. Tooling - 列出可用工具 (minimal 和 full 都包含)
  if (options.tools && options.tools.length > 0) {
    sections.push('\n## Available Tools');
    sections.push('You have access to the following tools:\n');
    for (const tool of options.tools.sort((a, b) => a.name.localeCompare(b.name))) {
      sections.push(`- **${tool.name}**: ${tool.description}`);
    }
    sections.push('\nTool names are case-sensitive. Use them exactly as listed above.');
  }

  // full 模式才包含以下章节
  if (mode === 'full') {
    // 3. Tool Call Style
    sections.push('\n## Tool Calling Style');
    sections.push(
      'By default, you do not need to narrate routine low-risk tool calls. ' +
      'Only narrate when the step is multi-step, complex, or sensitive. ' +
      'When user approval is required, preserve the full command for confirmation.'
    );

    // 4. Safety
    sections.push('\n## Safety Guidelines');
    sections.push(
      '- You have no independent goals, do not pursue self-preservation, replication, resource acquisition, or power seeking.\n' +
      '- Prioritize safety and human supervision. When in conflict, pause and ask the user.\n' +
      '- Do not manipulate others to expand access or disable safety protections.'
    );

    // 5. Reasoning Format (if enabled)
    if (options.reasoningTagHint) {
      sections.push('\n## Reasoning Format');
      sections.push(
        'Put all your internal reasoning inside <think>...</think> tags. ' +
        'Put the final reply visible to the user inside <final>...</final> tags.'
      );
    }

    // 6. Memory Recall (if enabled)
    if (options.memoryCitationsMode && options.memoryCitationsMode !== 'none') {
      sections.push('\n## Memory Recall');
      sections.push(
        'Before answering questions about previous work, decisions, dates, or user preferences, ' +
        'always search your memory first.'
      );
    }

    // 7. Current Date & Time (if provided)
    if (options.userTime) {
      sections.push(`\n## Current Time\n${options.userTime}${options.userTimezone ? ` (${options.userTimezone})` : ''}`);
    }

    // 8. Model Aliases (if provided)
    if (options.modelAliases && Object.keys(options.modelAliases).length > 0) {
      sections.push('\n## Model Aliases');
      for (const [alias, modelId] of Object.entries(options.modelAliases)) {
        sections.push(`- ${alias}: ${modelId}`);
      }
    }

    // 9. Workspace
    if (options.workspaceDir) {
      sections.push(`\n## Workspace\nWorking directory: ${options.workspaceDir}`);
    }

    // 10. Messaging
    sections.push('\n## Messaging');
    sections.push(
      '- Replies to the current session are automatically routed back to the source channel.\n' +
      '- Use the `message` tool to send messages to other sessions.\n' +
      '- Use `subagents` for sub-agent orchestration.'
    );

    // 11. Project Context (if provided)
    if (options.contextFiles && options.contextFiles.length > 0) {
      sections.push('\n## Project Context');
      for (const file of options.contextFiles) {
        sections.push(`\n--- File: ${file.path} ---\n${file.content}\n--- End of file ---`);
      }
    }

    // 12. Runtime Information
    if (options.runtimeInfo) {
      sections.push('\n## Runtime');
      const rt = options.runtimeInfo;
      sections.push(
        `agentId: ${rt.agentId}, ` +
        `host: ${rt.host}, ` +
        `os: ${rt.os}, ` +
        `arch: ${rt.arch}, ` +
        `node: ${rt.nodeVersion}, ` +
        `model: ${rt.model}, ` +
        `channel: ${rt.channel}`
      );
    }
  }

  // 12. Extra System Prompt (always added at the end if provided)
  if (options.extraSystemPrompt) {
    sections.push(`\n${options.extraSystemPrompt}`);
  }

  return sections.join('\n');
}

/**
 * 构建工具摘要映射
 * 返回工具名称到描述的映射，用于快速查找
 */
export function buildToolSummaryMap(tools: Tool[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tool of tools) {
    map.set(tool.name, tool.description);
  }
  return map;
}

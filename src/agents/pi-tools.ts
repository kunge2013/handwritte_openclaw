/**
 * OpenClaw 工具集合工厂 - 简化学习版
 *
 * 【核心概念】
 * 按照设计文档的步骤创建工具集合：
 * 1. 解析策略配置
 * 2. 集成基础工具
 * 3. 创建核心工具
 * 4. 创建 OpenClaw 专属工具
 * 5. 应用策略过滤
 * 6. 参数标准化
 * 7. 包装钩子
 */

import type { Tool } from './types.js';

/**
 * 工具策略配置
 */
export interface ToolPolicy {
  /** 禁用的工具名称 */
  disabledTools?: string[];
  /** 仅允许的工具名称 */
  allowedTools?: string[];
  /** 根据渠道禁用工具 */
  channelDisabled?: Record<string, string[]>;
  /** 根据模型禁用工具 */
  modelDisabled?: Record<string, string[]>;
}

/**
 * 创建 OpenClaw 编码工具集合
 */
export function createOpenClawCodingTools(policy?: ToolPolicy): Tool[] {
  const tools: Tool[] = [];

  // 1. 集成基础文件操作工具（简化版只列出定义，实际实现可扩展）
  // 这些对应设计文档中的基础工具：read, write, edit, grep, find, ls
  const baseTools: Tool[] = [
    {
      name: 'read',
      description: 'Read the contents of a file',
      handler: async (args: Record<string, unknown>) => {
        const path = args.path as string;
        // 实际实现会读取文件，这里是简化学习版
        return { path, content: '[Content would be read here]' };
      },
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
        },
        required: ['path'],
      },
    },
    {
      name: 'write',
      description: 'Write content to a file',
      handler: async (args: Record<string, unknown>) => {
        const path = args.path as string;
        const content = args.content as string;
        // 实际实现会写入文件
        return { path, bytes: content.length };
      },
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'ls',
      description: 'List files in a directory',
      handler: async (args: Record<string, unknown>) => {
        const path = args.path as string;
        // 实际实现会列出目录
        return { path, files: [] };
      },
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
        },
      },
    },
    {
      name: 'grep',
      description: 'Search for patterns in files',
      handler: async (args: Record<string, unknown>) => {
        const pattern = args.pattern as string;
        return { pattern, matches: [] };
      },
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern' },
        },
        required: ['pattern'],
      },
    },
  ];

  tools.push(...baseTools);

  // 2. 创建核心命令执行工具
  tools.push({
    name: 'exec',
    description: 'Execute a shell command',
    handler: async ({ command }) => {
      // 实际实现会执行命令
      return { command, stdout: '', stderr: '', exitCode: 0 };
    },
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
      },
      required: ['command'],
    },
  });

  // 3. 创建 OpenClaw 专属工具（简化版列出关键工具）
  const openClawTools = createOpenClawTools();
  tools.push(...openClawTools);

  // 4. 应用策略过滤
  return applyToolPolicy(tools, policy);
}

/**
 * 创建 OpenClaw 专属工具
 */
function createOpenClawTools(): Tool[] {
  const tools: Tool[] = [];

  // 网络工具
  tools.push({
    name: 'web_search',
    description: 'Search the web for information',
    handler: async (args: Record<string, unknown>) => {
      const query = args.query as string;
      return { query, results: [] };
    },
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  });

  tools.push({
    name: 'web_fetch',
    description: 'Fetch content from a URL',
    handler: async (args: Record<string, unknown>) => {
      const url = args.url as string;
      return { url, content: '' };
    },
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  });

  // 消息路由工具
  tools.push({
    name: 'message',
    description: 'Send a message to another session',
    handler: async (args: Record<string, unknown>) => {
      const sessionId = args.sessionId as string;
      const content = args.content as string;
      return { sessionId, content, sent: true };
    },
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Target session ID' },
        content: { type: 'string', description: 'Message content' },
      },
      required: ['sessionId', 'content'],
    },
  });

  // 会话管理工具
  tools.push({
    name: 'sessions_list',
    description: 'List all active sessions',
    handler: async () => {
      return { sessions: [] };
    },
  });

  // 记忆工具
  tools.push({
    name: 'memory_search',
    description: 'Search memory for relevant information',
    handler: async (args: Record<string, unknown>) => {
      const query = args.query as string;
      return { query, results: [] };
    },
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  });

  // 子代理工具
  tools.push({
    name: 'subagents',
    description: 'Spawn and manage sub-agents',
    handler: async (args: Record<string, unknown>) => {
      const prompt = args.prompt as string;
      return { prompt, result: '' };
    },
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prompt for the sub-agent' },
      },
      required: ['prompt'],
    },
  });

  return tools;
}

/**
 * 应用工具策略过滤
 */
function applyToolPolicy(tools: Tool[], policy?: ToolPolicy): Tool[] {
  if (!policy) return tools;

  let filtered = tools;

  // 禁用指定工具
  if (policy.disabledTools && policy.disabledTools.length > 0) {
    filtered = filtered.filter(t => !policy.disabledTools!.includes(t.name));
  }

  // 只允许指定工具
  if (policy.allowedTools && policy.allowedTools.length > 0) {
    filtered = filtered.filter(t => policy.allowedTools!.includes(t.name));
  }

  return filtered;
}

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

import fs from 'node:fs/promises';
import path from 'node:path';
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
        const filePath = args.path as string;
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          return { path: filePath, content, bytes: content.length };
        } catch (error) {
          return { path: filePath, error: String(error), found: false };
        }
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
        const filePath = args.path as string;
        const content = args.content as string;
        try {
          // 确保父目录存在
          await fs.mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
          // 写入文件
          await fs.writeFile(filePath, content, 'utf-8');
          return { path: filePath, bytes: content.length, ok: true };
        } catch (error) {
          return { path: filePath, error: String(error), ok: false };
        }
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
        const dirPath = args.path as string || '.';
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          const files = entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
          }));
          return { path: dirPath, files, count: files.length, ok: true };
        } catch (error) {
          return { path: dirPath, error: String(error), ok: false, files: [] };
        }
      },
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path, defaults to current directory' },
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

  // ========== 新增：获取当前日期时间工具 ==========
  tools.push({
    name: 'get_datetime',
    description:
      'Get the current date and time with timezone support. ' +
      'Returns structured information including timestamp, formatted string, ' +
      'and date components (year, month, day, hour, minute, second, weekday).',
    handler: async (args: Record<string, unknown>) => {
      // 获取参数，允许用户自定义时区
      const requestedTimezone = args.timezone as string | undefined;
      const requestedFormat = args.format as string | undefined;

      const now = new Date();

      // 如果用户指定了时区，使用指定时区计算本地时间组件
      const timezone = requestedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      // 获取指定时区下的日期时间组件
      const local = getLocalDateTimeComponents(now, timezone);

      // 根据请求的格式格式化输出
      let formatted: string;
      switch (requestedFormat) {
        case 'date':
          formatted = formatDateOnly(now, timezone);
          break;
        case 'time':
          formatted = formatTimeOnly(now, timezone);
          break;
        case 'iso':
          formatted = now.toISOString();
          break;
        case 'full':
        default:
          formatted = formatFullDateTime(now, timezone);
          break;
      }

      // 返回结构化结果
      return {
        ok: true,
        timestamp: now.getTime(),           // JavaScript 毫秒时间戳
        unixTimestamp: Math.floor(now.getTime() / 1000), // Unix 秒时间戳
        iso: now.toISOString(),             // ISO 8601 格式（总是 UTC）
        timezone,                            // 使用的时区
        formatted,                            // 格式化后的可读字符串
        local,                               // 本地时区下的各个组件
      };
    },
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description:
            'Timezone identifier (e.g. "Asia/Shanghai", "America/New_York"). ' +
            'Defaults to system timezone if not specified.',
        },
        format: {
          type: 'string',
          enum: ['full', 'date', 'time', 'iso'],
          description:
            'Output format: full="datetime with weekday", date="date only", time="time only", iso="ISO 8601 format". Defaults to "full".',
        },
      },
    },
  });

  return tools;
}

/**
 * 获取指定时区下的日期时间组件
 * 使用 Intl.DateTimeFormat 提取各个部分
 */
function getLocalDateTimeComponents(date: Date, timeZone: string) {
  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'long',
    timeZone,
  };

  const formatter = new Intl.DateTimeFormat('en-US', formatOptions);
  const parts = formatter.formatToParts(date);

  const components: Record<string, number | string> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      if (part.type === 'weekday') {
        components[part.type] = part.value;
      } else {
        components[part.type] = Number.parseInt(part.value, 10);
      }
    }
  }

  return {
    year: components.year as number,
    month: components.month as number,
    day: components.day as number,
    hour: components.hour as number,
    minute: components.minute as number,
    second: components.second as number,
    weekday: components.weekday as string,
  };
}

/**
 * 格式化完整日期时间（带星期）
 */
function formatFullDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone,
  }).format(date);
}

/**
 * 仅格式化日期
 */
function formatDateOnly(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(date);
}

/**
 * 仅格式化时间
 */
function formatTimeOnly(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone,
  }).format(date);
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

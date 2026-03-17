/**
 * OpenClaw Gateway 服务器 - 简化学习版
 *
 * 【核心概念】
 * Gateway 是 OpenClaw 的核心通信枢纽，负责：
 * 1. 提供 HTTP/WebSocket 服务器
 * 2. 处理来自渠道的消息
 * 3. 将消息路由到 Agent
 * 4. 管理 Agent 会话
 * 5. 处理认证和授权
 *
 * 架构:
 * ┌─────────────┐
 * │   Channels  │  各种消息渠道
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 * │  Gateway    │  消息路由和会话管理
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 * │   Agents    │  AI 代理
 * └─────────────┘
 */

import { EventEmitter } from 'events';
import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { MessageRole } from '../agents/types.js';
import type { Agent } from '../agents/agent.js';
import type { GatewayConfig, Session, Request, Response } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Gateway 服务器类
 */
export class GatewayServer extends EventEmitter {
  private config: GatewayConfig;
  private httpServer: HttpServer | null = null;
  private sessions: Map<string, Session> = new Map();
  private agents: Map<string, Agent> = new Map();
  private defaultAgent: Agent | null = null;
  private running: boolean = false;

  constructor(config: GatewayConfig) {
    super();
    this.config = config;
  }

  /**
   * 设置默认 Agent
   */
  setDefaultAgent(agent: Agent): void {
    this.defaultAgent = agent;
    console.log(`[Gateway] 默认 Agent 已设置: ${agent.constructor.name}`);
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    console.log(`[Gateway] 正在启动服务器，端口: ${this.config.port}`);

    // 创建 HTTP 服务器
    this.httpServer = createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    // 监听端口
    this.httpServer.listen(this.config.port, this.config.host, () => {
      this.running = true;
      const address = this.httpServer!.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      console.log(`[Gateway] 服务器已启动，监听: ${this.config.host}:${port}`);
      this.emit('started', { port: this.config.port });
    });

    // 处理错误
    this.httpServer.on('error', (error) => {
      console.error('[Gateway] 服务器错误:', error);
      this.emit('error', error);
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    console.log('[Gateway] 正在停止服务器...');

    if (this.httpServer) {
      // 关闭所有连接
      this.sessions.clear();

      // 停止 HTTP 服务器
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.httpServer = null;
    }

    this.running = false;
    console.log('[Gateway] 服务器已停止');
    this.emit('stopped');
  }

  /**
   * 注册 Agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.constructor.name, agent);
    console.log(`[Gateway] 已注册 Agent: ${agent.constructor.name}`);
  }

  /**
   * 处理 HTTP 请求
   */
  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    const { method, url } = req;

    console.log(`[Gateway] ${method} ${url}`);

    // 启用 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // 去掉查询字符串，只比较路径
    const requestUrl = req.url || '/';
    const cleanPath = requestUrl.split('?')[0];

    // 路由处理
    if (cleanPath === '/health' && method === 'GET') {
      this.handleHealthCheck(res);
    } else if (cleanPath === '/api/message' && (method === 'POST' || method === 'GET')) {
      this.handleMessage(req, res);
    } else if (cleanPath === '/api/sessions' && method === 'GET') {
      this.handleGetSessions(res);
    } else if ((url === '/' || url === '/index.html') && method === 'GET') {
      this.serveStaticFile(path.join(__dirname, '../../ui/index.html'), 'text/html', res);
    } else {
      this.handleNotFound(res);
    }
  }

  /**
   * 服务静态文件
   */
  private async serveStaticFile(filePath: string, contentType: string, res: ServerResponse): Promise<void> {
    try {
      const content = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (error) {
      console.error('[Gateway] 静态文件读取失败:', error);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  }

  /**
   * 健康检查端点
   */
  private handleHealthCheck(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      sessions: this.sessions.size,
      agents: this.agents.size,
    }));
  }

  /**
   * 解析 URL 查询参数
   */
  private parseQueryParams(url: string): Record<string, string> {
    const queryStart = url.indexOf('?');
    if (queryStart === -1) return {};
    const query = url.slice(queryStart + 1);
    const params: Record<string, string> = {};
    query.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    return params;
  }

  /**
   * 处理消息请求 - 支持 SSE 流式输出，实时推送工具执行事件
   *
   * 事件格式:
   * - event: llm_start - 大模型开始推理
   * - event: llm_end - 大模型推理完成，返回结果
   * - event: tool_call - 大模型决定调用工具
   * - event: tool_start - 工具开始执行
   * - event: tool_end - 工具执行完成
   * - event: final - 最终回答完成
   */
  private async handleMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      let request: { sessionId: string; channelId: string; message: { content: string } };

      if (req.method === 'GET') {
        // GET 请求用于 SSE，参数在查询字符串
        const params = this.parseQueryParams(req.url!);
        request = {
          sessionId: params.sessionId || 'unknown',
          channelId: params.channelId || 'webchat',
          message: { content: params.content || '' },
        };
      } else {
        // POST 请求
        const body = await this.parseRequestBody(req);
        const parsed = JSON.parse(body);
        request = {
          sessionId: parsed.sessionId,
          channelId: parsed.channelId,
          message: parsed.message,
        };
      }

      console.log(`[Gateway] 处理消息请求: ${request.sessionId}`);

      // 获取或创建会话
      const session = await this.getOrCreateSession(request.sessionId, request.channelId);

      // 设置 SSE 响应头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // 包装 send 事件
      const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // 调用 Agent 处理，同时监听工具执行事件
      if (this.defaultAgent && this.defaultAgent.isConnected()) {
        const overallStartTime = Date.now();
        let round = 0;

        // 1. Monkey patch 捕获 callLLM 来获取 LLM 调用事件
        const originalCallLLM = (this.defaultAgent as any).callLLM;
        const originalExecuteToolCall = (this.defaultAgent as any).executeToolCall;

        if (originalCallLLM) {
          (this.defaultAgent as any).callLLM = async (systemContext: string, message: any) => {
            const llmStartTime = Date.now();
            // 发送 LLM 开始事件
            sendEvent('llm_start', {
              round: round + 1,
              timestamp: llmStartTime,
              model: (this.defaultAgent as any).getCurrentModel(),
            });
            console.log(`[Gateway] 第 ${round + 1} 轮: LLM 开始推理`);

            // 调用原始方法
            const response = await originalCallLLM.call(this.defaultAgent, systemContext, message);

            const llmEndTime = Date.now();
            // 发送 LLM 结束事件
            sendEvent('llm_end', {
              round: round + 1,
              durationMs: llmEndTime - llmStartTime,
              hasToolCalls: response.toolCalls && response.toolCalls.length > 0,
              content: response.content,
              toolCalls: response.toolCalls || [],
              timestamp: llmEndTime,
            });
            console.log(`[Gateway] 第 ${round + 1} 轮: LLM 推理完成，工具调用=${!!(response.toolCalls && response.toolCalls.length)}`);

            // 如果有工具调用，逐个发送事件
            if (response.toolCalls && response.toolCalls.length > 0) {
              for (const toolCall of response.toolCalls) {
                sendEvent('tool_call', {
                  round: round + 1,
                  name: toolCall.name,
                  arguments: toolCall.arguments,
                  callId: toolCall.callId,
                  timestamp: llmEndTime,
                });
              }
            }

            round++;
            return response;
          };
        }

        // 2. Monkey patch 捕获工具执行
        if (originalExecuteToolCall) {
          (this.defaultAgent as any).executeToolCall = async (toolCall: any) => {
            // 发送工具开始事件
            sendEvent('tool_start', {
              round,
              name: toolCall.name,
              arguments: toolCall.arguments,
              timestamp: Date.now(),
            });
            console.log(`[Gateway] 工具开始执行: ${toolCall.name}`);

            // 执行原始方法
            const result = await originalExecuteToolCall.call(this.defaultAgent, toolCall);

            // 发送工具结束事件
            sendEvent('tool_end', {
              round,
              name: toolCall.name,
              result,
              durationMs: Date.now() - overallStartTime,
              timestamp: Date.now(),
            });
            console.log(`[Gateway] 工具执行完成: ${toolCall.name}, success=${result.success}`);

            return result;
          };
        }

        // 执行 Agent 处理，获取最终响应
        const agentResponse = await this.defaultAgent.processMessage({
          id: `msg_${Date.now()}`,
          role: MessageRole.USER,
          content: request.message.content,
          timestamp: Date.now(),
        });

        // 发送最终响应
        const response: Response = {
          sessionId: session.id,
          messageId: agentResponse.id,
          content: agentResponse.content,
          timestamp: Date.now(),
          data: {
            totalDurationMs: Date.now() - overallStartTime,
          },
        };

        sendEvent('final', response);
        res.end();

        // 恢复原始方法
        if (originalCallLLM) {
          (this.defaultAgent as any).callLLM = originalCallLLM;
        }
        if (originalExecuteToolCall) {
          (this.defaultAgent as any).executeToolCall = originalExecuteToolCall;
        }
      } else {
        sendEvent('error', { error: '没有可用的 Agent' });
        res.end();
      }
    } catch (error) {
      console.error('[Gateway] 处理消息失败:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '处理消息失败' }));
      }
    }
  }

  /**
   * 获取所有会话
   */
  private handleGetSessions(res: ServerResponse): void {
    const sessions = Array.from(this.sessions.values()).map(session => ({
      sessionId: session.id,
      channelId: session.channelId,
      createdAt: session.createdAt,
      messageCount: session.messageCount,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessions }));
  }

  /**
   * 404 处理
   */
  private handleNotFound(res: ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }

  /**
   * 解析请求体
   */
  private parseRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => body += chunk);
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  /**
   * 获取或创建会话
   */
  private async getOrCreateSession(sessionId: string, channelId: string): Promise<Session> {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        id: sessionId,
        channelId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        metadata: {},
      };

      this.sessions.set(sessionId, session);
      console.log(`[Gateway] 创建新会话: ${sessionId}`);

      this.emit('session-created', session);
    } else {
      session.lastActivity = Date.now();
    }

    return session;
  }

  /**
   * 处理消息
   */
  private async processMessage(session: Session, request: Request): Promise<Response> {
    // 更新会话
    session.messageCount++;
    session.lastActivity = Date.now();

    // 触发消息事件
    this.emit('message', {
      sessionId: session.id,
      channelId: session.channelId,
      message: request.message,
    });

    // 调用 Agent 处理消息
    if (this.defaultAgent && this.defaultAgent.isConnected()) {
      const agentResponse = await this.defaultAgent.processMessage({
        id: `msg_${Date.now()}`,
        role: MessageRole.USER,
        content: request.message.content,
        timestamp: Date.now(),
      });

      const response: Response = {
        sessionId: session.id,
        messageId: agentResponse.id,
        content: agentResponse.content,
        timestamp: Date.now(),
      };

      return response;
    }

    // 如果没有 Agent，直接返回
    const response: Response = {
      sessionId: session.id,
      messageId: `msg_${Date.now()}`,
      content: `[Gateway] 收到消息: ${request.message.content} (没有可用的 Agent)`,
      timestamp: Date.now(),
    };

    return response;
  }

  /**
   * 获取会话统计
   */
  getStats(): { sessions: number; agents: number; running: boolean } {
    return {
      sessions: this.sessions.size,
      agents: this.agents.size,
      running: this.running,
    };
  }
}

/**
 * Gateway 服务器管理器
 */
export class GatewayManager extends EventEmitter {
  private server: GatewayServer | null = null;

  /**
   * 创建并启动服务器
   */
  async startServer(config: GatewayConfig): Promise<GatewayServer> {
    console.log('[GatewayManager] 启动服务器...');

    this.server = new GatewayServer(config);

    // 监听服务器事件并转发
    this.server.on('started', (data) => this.emit('server-started', data));
    this.server.on('stopped', () => this.emit('server-stopped'));
    this.server.on('error', (error) => this.emit('server-error', error));
    this.server.on('message', (data) => this.emit('server-message', data));
    this.server.on('session-created', (data) => this.emit('session-created', data));

    await this.server.start();

    return this.server;
  }

  /**
   * 停止服务器
   */
  async stopServer(): Promise<void> {
    if (this.server) {
      await this.server.stop();
      this.server = null;
    }
  }

  /**
   * 获取当前服务器
   */
  getServer(): GatewayServer | null {
    return this.server;
  }
}

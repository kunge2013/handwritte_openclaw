/**
 * OpenClaw Agent 核心模块 - 简化学习版
 *
 * 【核心概念】
 * Agent 是 OpenClaw 的核心组件，负责：
 * 1. 接收用户消息
 * 2. 管理对话上下文
 * 3. 调用 LLM 模型生成响应
 * 4. 执行工具调用
 * 5. 管理会话状态
 */

import { EventEmitter } from 'events';
import { MessageRole } from './types.js';
import type { Message, Tool, AgentConfig } from './types.js';

/**
 * Agent 类 - 核心代理实现
 *
 * 生命周期:
 * 1. 初始化 (constructor)
 * 2. 连接 (connect)
 * 3. 处理消息 (processMessage)
 * 4. 断开连接 (disconnect)
 */
export class Agent extends EventEmitter {
  private config: AgentConfig;
  private messageHistory: Message[] = [];
  private tools: Map<string, Tool> = new Map();
  private connected: boolean = false;

  constructor(config: AgentConfig) {
    super();
    this.config = config;

    // 注册默认工具
    this.registerTool({
      name: 'ping',
      description: '检查代理状态',
      handler: async () => ({ status: 'ok', message: 'pong' }),
    });

    this.registerTool({
      name: 'get_context',
      description: '获取当前对话上下文',
      handler: async () => ({
        messageCount: this.messageHistory.length,
        lastMessage: this.messageHistory[this.messageHistory.length - 1],
      }),
    });
  }

  /**
   * 连接到 Agent 服务
   */
  async connect(): Promise<void> {
    console.log('[Agent] 正在连接...', this.config.id);
    // 模拟连接过程
    await new Promise(resolve => setTimeout(resolve, 100));
    this.connected = true;
    this.emit('connected', { agentId: this.config.id });
    console.log('[Agent] 连接成功');
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    console.log('[Agent] 正在断开连接...');
    this.connected = false;
    this.emit('disconnected', { agentId: this.config.id });
    console.log('[Agent] 已断开连接');
  }

  /**
   * 处理用户消息
   *
   * 流程:
   * 1. 将消息添加到历史记录
   * 2. 准备上下文（消息历史 + 系统提示）
   * 3. 发送到 LLM
   * 4. 处理响应（可能包含工具调用）
   * 5. 返回结果
   */
  async processMessage(message: Message): Promise<Message> {
    if (!this.connected) {
      throw new Error('Agent 未连接');
    }

    console.log(`[Agent] 处理消息: ${message.content.substring(0, 50)}...`);

    // 添加到消息历史
    this.messageHistory.push(message);

    // 准备上下文
    const context = this.buildContext();

    // 模拟 LLM 调用
    const response = await this.callLLM(context, message);

    // 添加响应到历史
    this.messageHistory.push(response);

    // 触发消息事件
    this.emit('message', { agentId: this.config.id, message: response });

    return response;
  }

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
    console.log(`[Agent] 已注册工具: ${tool.name}`);
  }

  /**
   * 获取所有已注册的工具
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 清除对话历史
   */
  clearHistory(): void {
    this.messageHistory = [];
    console.log('[Agent] 对话历史已清除');
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 构建上下文
   *
   * 包括：
   * - 系统提示词
   * - 可用工具信息
   * - 消息历史
   */
  private buildContext(): string {
    const systemPrompt = this.config.systemPrompt || '你是一个AI助手。';
    const toolInfo = this.tools.size > 0
      ? `\n可用工具:\n${Array.from(this.tools.values()).map(t => `- ${t.name}: ${t.description}`).join('\n')}`
      : '';

    return `${systemPrompt}${toolInfo}`;
  }

  /**
   * 调用 LLM
   *
   * 在真实项目中，这里会调用各种 LLM 提供商的 API
   */
  private async callLLM(context: string, message: Message): Promise<Message> {
    // 模拟 API 调用延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    // 简化版的响应逻辑
    // 在真实项目中，这里会：
    // 1. 构建 API 请求
    // 2. 添加认证信息
    // 3. 发送到 LLM 提供商
    // 4. 处理流式响应
    // 5. 解析工具调用

    const content = `[模拟响应] 收到消息: "${message.content}"`;

    return {
      id: `msg_${Date.now()}`,
      role: MessageRole.ASSISTANT,
      content,
      timestamp: Date.now(),
      metadata: { model: this.config.model || 'default-model' },
    };
  }
}

/**
 * Agent 管理器 - 管理多个 Agent 实例
 */
export class AgentManager extends EventEmitter {
  private agents: Map<string, Agent> = new Map();

  /**
   * 创建并注册一个新 Agent
   */
  async createAgent(config: AgentConfig): Promise<Agent> {
    console.log(`[AgentManager] 创建 Agent: ${config.id}`);

    const agent = new Agent(config);

    // 监听 Agent 事件并转发
    agent.on('connected', (data) => this.emit('agent-connected', data));
    agent.on('disconnected', (data) => this.emit('agent-disconnected', data));
    agent.on('message', (data) => this.emit('agent-message', data));

    await agent.connect();
    this.agents.set(config.id, agent);

    return agent;
  }

  /**
   * 获取 Agent
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * 获取所有 Agent
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 移除 Agent
   */
  async removeAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      await agent.disconnect();
      this.agents.delete(id);
      console.log(`[AgentManager] 已移除 Agent: ${id}`);
    }
  }

  /**
   * 关闭所有 Agent
   */
  async shutdown(): Promise<void> {
    console.log('[AgentManager] 正在关闭所有 Agent...');
    for (const [id, agent] of this.agents.entries()) {
      await agent.disconnect();
      this.agents.delete(id);
    }
    console.log('[AgentManager] 所有 Agent 已关闭');
  }
}

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
import { buildAgentSystemPrompt } from './system-prompt.js';
import type { ModelManager } from '../models/model-manager.js';
import type { Message, Tool, AgentConfig } from './types.js';
import type { CompletionOptions, ChatMessage } from '../models/types.js';
import type { BuildAgentSystemPromptOptions } from './system-prompt.js';

/**
 * Agent 类 - 核心代理实现
 *
 * 生命周期:
 * 1. 初始化 (constructor)
 * 2. 连接 (connect)
 * 3. 处理消息 (processMessage)
 * 4. 断开连接 (disconnect)
 *
 * 模型关系:
 * - Agent 通过 modelManager 调用模型
 * - Agent 配置中的 model 字段是 "providerId/modelId" 格式
 * - 支持灵活切换不同提供者的不同模型
 */
export class Agent extends EventEmitter {
  private config: AgentConfig;
  private modelRef: string;
  private modelManager: ModelManager;
  private messageHistory: Message[] = [];
  private tools: Map<string, Tool> = new Map();
  private connected: boolean = false;

  constructor(config: AgentConfig, modelManager: ModelManager) {
    super();
    this.config = config;
    this.modelManager = modelManager;
    // 默认使用配置中的 model，如果没有使用 default/default
    this.modelRef = config.model || 'default/default';

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
   * 使用模块化提示词构建器生成系统提示
   * 包括：
   * - 系统提示词
   * - 可用工具信息
   * - 消息历史
   */
  private buildContext(): string {
    // 使用新的模块化提示词构建器
    const options: BuildAgentSystemPromptOptions = {
      mode: 'full',
      tools: Array.from(this.tools.values()),
      extraSystemPrompt: this.config.systemPrompt,
      reasoningTagHint: true,
      runtimeInfo: {
        agentId: this.config.id,
        host: 'local',
        os: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        model: this.config.model || 'default',
        channel: 'unknown',
      },
    };

    return buildAgentSystemPrompt(options);
  }

  /**
   * 调用 LLM
   *
   * 使用 modelManager 调用配置的模型
   */
  private async callLLM(systemContext: string, message: Message): Promise<Message> {
    console.log(`[Agent] 调用模型: ${this.modelRef}`);

    // 转换消息为模型需要的格式
    const chatMessages: ChatMessage[] = [
      // 系统提示放在第一位
      { role: 'system', content: systemContext },
      // 加上历史消息
      ...this.messageHistory.map(m => this.convertToChatMessage(m)),
    ];

    // 转换工具为 OpenAI 格式
    const tools = this.getTools().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || {},
      },
    }));

    // 构建 completion 选项
    const options: CompletionOptions = {
      model: this.modelRef,
      messages: chatMessages,
      temperature: this.config.temperature || 0.7,
      maxTokens: this.config.maxHistoryLength || undefined,
      stream: false,
      tools: tools.length > 0 ? tools : undefined,
    };

    // 调用模型
    const response = await this.modelManager.complete(options);

    // 转换回内部消息格式
    const result: Message = {
      id: `msg_${Date.now()}`,
      role: MessageRole.ASSISTANT,
      content: response.content,
      timestamp: Date.now(),
      metadata: {
        model: this.modelRef,
        usage: response.usage,
      },
    };

    // 如果有工具调用，添加
    if (response.toolCalls && response.toolCalls.length > 0) {
      result.toolCalls = response.toolCalls.map(tc => ({
        name: tc.name,
        arguments: tc.arguments,
        callId: tc.id,
      }));
    }

    return result;
  }

  /**
   * 转换内部 Message 为 ChatMessage 格式
   */
  private convertToChatMessage(msg: Message): ChatMessage {
    switch (msg.role) {
      case MessageRole.SYSTEM:
        return { role: 'system', content: msg.content };
      case MessageRole.USER:
        return { role: 'user', content: msg.content };
      case MessageRole.ASSISTANT: {
        const chatMsg: ChatMessage = { role: 'assistant', content: msg.content };
        if (msg.toolCalls) {
          chatMsg.tool_calls = msg.toolCalls.map(tc => ({
            id: tc.callId,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }));
        }
        return chatMsg;
      }
      case MessageRole.TOOL: {
        return {
          role: 'tool',
          content: msg.toolResponse?.content || '',
          tool_call_id: msg.toolResponse?.callId || '',
        };
      }
      default:
        return { role: 'user', content: msg.content };
    }
  }

  /**
   * 切换模型
   * 支持运行时动态切换模型
   */
  switchModel(newModelRef: string): void {
    this.modelRef = newModelRef;
    console.log(`[Agent] 切换模型: ${newModelRef}`);
  }

  /**
   * 获取当前使用的模型引用
   */
  getCurrentModel(): string {
    return this.modelRef;
  }
}

/**
 * Agent 管理器 - 管理多个 Agent 实例
 */
export class AgentManager extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private modelManager: ModelManager;

  constructor(modelManager: ModelManager) {
    super();
    this.modelManager = modelManager;
  }

  /**
   * 创建并注册一个新 Agent
   */
  async createAgent(config: AgentConfig): Promise<Agent> {
    console.log(`[AgentManager] 创建 Agent: ${config.id}, 模型: ${config.model || 'default'}`);

    const agent = new Agent(config, this.modelManager);

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

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
 * 6. 集成 Skills 系统 - 动态加载可扩展技能
 */

import { EventEmitter } from 'events';
import { MessageRole } from './types.js';
import { buildAgentSystemPrompt } from './system-prompt.js';
import {
  buildWorkspaceSkillSnapshot,
  resolveSkillsPromptForRun,
} from './skills/index.js';
import type { ModelManager } from '../models/model-manager.js';
import type { Message, Tool, AgentConfig, SkillsSystemState } from './types.js';
import type { SkillSnapshot } from './skills/types.js';
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
  private skills: SkillsSystemState;

  constructor(config: AgentConfig, modelManager: ModelManager) {
    super();
    this.config = config;
    this.modelManager = modelManager;
    // 默认使用配置中的 model，如果没有使用 default/default
    this.modelRef = config.model || 'default/default';

    // 初始化技能系统状态
    this.skills = {
      enabled: config.skills?.enabled ?? true,
      snapshot: undefined,
      commandSpecs: [],
      loadedCount: 0,
      eligibleCount: 0,
      lastUpdated: undefined,
    };

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
   *
   * 如果技能系统启用，会在连接时预构建技能快照
   */
  async connect(): Promise<void> {
    console.log('[Agent] 正在连接...', this.config.id);
    // 模拟连接过程
    await new Promise(resolve => setTimeout(resolve, 100));

    // 如果技能系统启用，预构建技能快照
    if (this.skills.enabled) {
      this.initializeSkillsSnapshot();
    }

    this.connected = true;
    this.emit('connected', { agentId: this.config.id });
    console.log('[Agent] 连接成功' + (this.skills.enabled ? `, 加载 ${this.skills.loadedCount} 技能, ${this.skills.eligibleCount} 就绪` : ''));
  }

  /**
   * 初始化技能快照
   *
   * 从当前工作目录加载并构建技能快照，缓存起来供后续调用
   * 这是一个同步操作，因为只需要在初始化执行一次
   */
  private initializeSkillsSnapshot(): void {
    const workspaceDir = process.cwd();
    const skillFilter = this.config.skills?.filter;

    // 构建技能快照，包含过滤后的可用技能列表
    const snapshot: SkillSnapshot = buildWorkspaceSkillSnapshot(workspaceDir, {
      config: this.config as any,
      skillFilter,
      snapshotVersion: Date.now(),
    });

    // 更新状态
    this.skills.snapshot = snapshot;
    this.skills.loadedCount = snapshot.skills?.length ?? 0;
    this.skills.eligibleCount = snapshot.resolvedSkills?.length ?? 0;
    this.skills.lastUpdated = Date.now();

    this.emit('skill-loaded', {
      agentId: this.config.id,
      loadedCount: this.skills.loadedCount,
      eligibleCount: this.skills.eligibleCount,
      timestamp: this.skills.lastUpdated,
    });
  }

  /**
   * 获取当前技能快照
   * @returns 技能快照（如果技能系统启用）
   */
  getSkillsSnapshot(): SkillSnapshot | undefined {
    return this.skills.snapshot;
  }

  /**
   * 刷新技能快照
   *
   * 重新加载技能目录并重建快照，用于添加新技能后刷新
   */
  refreshSkills(): void {
    if (this.skills.enabled) {
      this.initializeSkillsSnapshot();
      console.log('[Agent] 技能快照已刷新', `加载 ${this.skills.loadedCount}, 就绪 ${this.skills.eligibleCount}`);
    }
  }

  /**
   * 检查技能系统是否启用
   * @returns 是否启用
   */
  isSkillsEnabled(): boolean {
    return this.skills.enabled;
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
   * 标准 ReAct 循环流程:
   * 1. 将消息添加到历史记录
   * 2. 准备上下文（消息历史 + 系统提示）
   * 3. 调用 LLM 获取响应
   * 4. 如果有工具调用：
   *    a. 依次执行每个工具
   *    b. 将工具结果添加到历史作为 TOOL 消息
   *    c. 回到步骤 3 继续让 LLM 处理工具结果
   * 5. 如果没有工具调用，返回最终结果
   */
  async processMessage(message: Message): Promise<Message> {
    if (!this.connected) {
      throw new Error('Agent 未连接');
    }

    console.log(`[Agent] 处理消息: ${message.content.substring(0, 50)}...`);

    // 添加用户消息到历史
    this.messageHistory.push(message);

    let finalResponse: Message | null = null;
    const MAX_TOOL_ROUNDS = 5; // 限制最大工具调用轮次，防止无限循环

    // ReAct 工具调用循环
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      // 调用 LLM
      const context = this.buildContext();
      const response = await this.callLLM(context, message);

      // 如果没有工具调用，这就是最终响应
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalResponse = response;
        this.messageHistory.push(finalResponse);
        this.emit('message', { agentId: this.config.id, message: finalResponse });
        return finalResponse;
      }

      console.log(`[Agent] 检测到 ${response.toolCalls.length} 个工具调用，开始执行`);

      // 有工具调用，依次执行
      for (const toolCall of response.toolCalls) {
        // 执行工具并获取结果
        const toolResult = await this.executeToolCall(toolCall);

        // 创建工具响应消息，添加到历史
        const toolResponseMessage: Message = {
          id: `msg_${Date.now()}`,
          role: MessageRole.TOOL,
          content: JSON.stringify(toolResult),
          timestamp: Date.now(),
          toolResponse: {
            callId: toolCall.callId,
            content: JSON.stringify(toolResult),
            success: toolResult.success,
          },
        };

        this.messageHistory.push(response); // 先添加 LLM 的工具调用响应
        this.messageHistory.push(toolResponseMessage); // 再添加工具执行结果

        console.log(`[Agent] 工具 ${toolCall.name} 执行完成，success=${toolResult.success}`);
      }

      // 继续下一轮循环，让 LLM 基于工具结果继续回答
    }

    // 如果达到最大轮次还没有得到最终回答
    finalResponse = {
      id: `msg_${Date.now()}`,
      role: MessageRole.ASSISTANT,
      content: '<final>已达到最大工具调用轮次限制，停止处理。</final>',
      timestamp: Date.now(),
    };

    this.messageHistory.push(finalResponse);
    this.emit('message', { agentId: this.config.id, message: finalResponse });
    return finalResponse;
  }

  /**
   * 执行单个工具调用
   * 根据工具名称找到工具实例，调用 handler，返回标准化结果
   */
  private async executeToolCall(toolCall: {
    name: string;
    arguments: Record<string, unknown>;
    callId: string;
  }): Promise<{ success: boolean; result?: unknown; error?: string }> {
    // 查找工具
    const tool = this.tools.get(toolCall.name);
    if (!tool) {
      console.error(`[Agent] 工具未找到: ${toolCall.name}`);
      return {
        success: false,
        error: `Tool not found: ${toolCall.name}`,
      };
    }

    try {
      // 执行工具 handler
      console.log(`[Agent] 执行工具: ${toolCall.name}`);
      const result = await tool.handler(toolCall.arguments);
      return {
        success: true,
        result,
      };
    } catch (error) {
      // 捕获执行错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Agent] 工具执行失败: ${toolCall.name}, error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
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
   * - 可用技能列表（如果技能系统启用）
   * - 消息历史
   */
  private buildContext(): string {
    // 获取技能提示词（如果技能系统启用且有快照）
    let skillsPrompt: string | undefined;
    if (this.skills.enabled && this.skills.snapshot) {
      const workspaceDir = process.cwd();
      skillsPrompt = resolveSkillsPromptForRun({
        skillsSnapshot: this.skills.snapshot,
        workspaceDir,
        config: this.config as any,
      });
    }

    // 使用新的模块化提示词构建器
    const options: BuildAgentSystemPromptOptions = {
      mode: 'full',
      tools: Array.from(this.tools.values()),
      extraSystemPrompt: this.config.systemPrompt,
      reasoningTagHint: true,
      skillsPrompt,
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

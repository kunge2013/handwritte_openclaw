/**
 * OpenClaw Channel 渠道系统 - 简化学习版
 *
 * 【核心概念】
 * Channel 是 OpenClaw 的消息渠道抽象层，负责：
 * 1. 连接各种消息平台（WhatsApp、Telegram、Slack 等）
 * 2. 统一消息格式
 * 3. 处理平台特定的逻辑
 * 4. 将消息发送到 Gateway
 *
 * 架构:
 * ┌─────────────┐      ┌─────────────┐
 * │  WhatsApp   │      │   Telegram  │
 * └──────┬──────┘      └──────┬──────┘
 *        │                    │
 *        └────────┬───────────┘
 *                 │
 *        ┌────────▼──────────┐
 *        │   Channel Base    │  统一抽象
 *        └────────┬──────────┘
 *                 │
 *        ┌────────▼──────────┐
 *        │     Gateway       │
 *        └──────────────────┘
 */

import { EventEmitter } from 'events';
import type { ChannelConfig, Message, User } from './types.js';

/**
 * 渠道基类
 * 所有具体的渠道实现都继承此类
 */
export abstract class BaseChannel extends EventEmitter {
  protected config: ChannelConfig;
  protected connected: boolean = false;
  protected messageQueue: Message[] = [];

  constructor(config: ChannelConfig) {
    super();
    this.config = config;
  }

  /**
   * 抽象方法：连接到渠道
   * 子类必须实现
   */
  abstract connect(): Promise<void>;

  /**
   * 抽象方法：断开连接
   * 子类必须实现
   */
  abstract disconnect(): Promise<void>;

  /**
   * 抽象方法：发送消息
   * 子类必须实现
   */
  abstract sendMessage(message: Message): Promise<void>;

  /**
   * 获取渠道 ID
   */
  getChannelId(): string {
    return this.config.id;
  }

  /**
   * 获取渠道类型
   */
  getChannelType(): string {
    return this.config.type;
  }

  /**
   * 检查是否连接
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 处理接收到的消息
   * 子类调用此方法将消息转发到 Gateway
   */
  protected async handleMessage(message: Message): Promise<void> {
    console.log(`[Channel:${this.config.type}] 处理消息: ${message.content.substring(0, 50)}...`);

    // 触发消息事件
    this.emit('message', {
      channelId: this.config.id,
      message,
    });

    // 检查是否有匹配的命令前缀
    if (message.content.startsWith(this.config.commandPrefix || '/')) {
      await this.handleCommand(message);
    }
  }

  /**
   * 处理命令
   */
  protected async handleCommand(message: Message): Promise<void> {
    const command = message.content.substring(1).split(' ')[0];
    console.log(`[Channel:${this.config.type}] 检测到命令: ${command}`);

    this.emit('command', {
      channelId: this.config.id,
      command,
      message,
    });
  }

  /**
   * 格式化消息
   * 将平台特定的消息格式转换为统一格式
   */
  protected formatMessage(rawMessage: unknown): Message {
    // 子类覆盖此方法以处理平台特定的消息格式
    return {
      id: `msg_${Date.now()}`,
      content: String(rawMessage),
      timestamp: Date.now(),
      userId: 'unknown',
      channelId: this.config.id,
    };
  }

  /**
   * 添加消息到队列
   */
  protected queueMessage(message: Message): void {
    this.messageQueue.push(message);
  }

  /**
   * 获取队列中的消息
   */
  getQueuedMessages(): Message[] {
    return [...this.messageQueue];
  }

  /**
   * 清空消息队列
   */
  clearQueue(): void {
    this.messageQueue = [];
  }
}

/**
 * Telegram 渠道实现示例
 */
export class TelegramChannel extends BaseChannel {
  private bot: unknown = null; // 在真实项目中这里是 grammy bot 实例

  async connect(): Promise<void> {
    console.log(`[Telegram] 正在连接到 ${this.config.id}...`);

    // 模拟连接过程
    await new Promise(resolve => setTimeout(resolve, 200));

    this.connected = true;
    console.log(`[Telegram] 已连接: ${this.config.id}`);
    this.emit('connected', { channelId: this.config.id });

    // 模拟接收消息
    this.simulateIncomingMessages();
  }

  async disconnect(): Promise<void> {
    console.log(`[Telegram] 正在断开连接...`);
    this.connected = false;
    console.log(`[Telegram] 已断开连接`);
    this.emit('disconnected', { channelId: this.config.id });
  }

  async sendMessage(message: Message): Promise<void> {
    console.log(`[Telegram] 发送消息到 ${message.userId}: ${message.content}`);
    // 在真实项目中这里会调用 Telegram API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * 模拟接收消息（仅用于演示）
   */
  private simulateIncomingMessages(): void {
    // 每 10 秒模拟接收一条消息
    setInterval(() => {
      if (this.connected && Math.random() > 0.7) {
        const message: Message = {
          id: `msg_${Date.now()}`,
          content: `[模拟Telegram消息] 你好，这是从 ${this.config.id} 发来的消息`,
          timestamp: Date.now(),
          userId: 'telegram_user_123',
          channelId: this.config.id,
        };
        this.handleMessage(message);
      }
    }, 10000);
  }
}

/**
 * WhatsApp 渠道实现示例
 */
export class WhatsAppChannel extends BaseChannel {
  private socket: unknown = null; // 在真实项目中这里是 Baileys socket

  async connect(): Promise<void> {
    console.log(`[WhatsApp] 正在连接到 ${this.config.id}...`);

    // 模拟连接过程
    await new Promise(resolve => setTimeout(resolve, 300));

    this.connected = true;
    console.log(`[WhatsApp] 已连接: ${this.config.id}`);
    this.emit('connected', { channelId: this.config.id });

    // 模拟接收消息
    this.simulateIncomingMessages();
  }

  async disconnect(): Promise<void> {
    console.log(`[WhatsApp] 正在断开连接...`);
    this.connected = false;
    console.log(`[WhatsApp] 已断开连接`);
    this.emit('disconnected', { channelId: this.config.id });
  }

  async sendMessage(message: Message): Promise<void> {
    console.log(`[WhatsApp] 发送消息到 ${message.userId}: ${message.content}`);
    // 在真实项目中这里会调用 WhatsApp API
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  private simulateIncomingMessages(): void {
    setInterval(() => {
      if (this.connected && Math.random() > 0.7) {
        const message: Message = {
          id: `msg_${Date.now()}`,
          content: `[模拟WhatsApp消息] 你好，这是从 ${this.config.id} 发来的消息`,
          timestamp: Date.now(),
          userId: 'whatsapp_user_456',
          channelId: this.config.id,
        };
        this.handleMessage(message);
      }
    }, 12000);
  }
}

/**
 * Slack 渠道实现示例
 */
export class SlackChannel extends BaseChannel {
  private app: unknown = null; // 在真实项目中这里是 Slack Bolt app 实例

  async connect(): Promise<void> {
    console.log(`[Slack] 正在连接到 ${this.config.id}...`);

    // 模拟连接过程
    await new Promise(resolve => setTimeout(resolve, 150));

    this.connected = true;
    console.log(`[Slack] 已连接: ${this.config.id}`);
    this.emit('connected', { channelId: this.config.id });
  }

  async disconnect(): Promise<void> {
    console.log(`[Slack] 正在断开连接...`);
    this.connected = false;
    console.log(`[Slack] 已断开连接`);
    this.emit('disconnected', { channelId: this.config.id });
  }

  async sendMessage(message: Message): Promise<void> {
    console.log(`[Slack] 发送消息到频道 ${message.channelId}: ${message.content}`);
    // 在真实项目中这里会调用 Slack API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * 渠道管理器
 */
export class ChannelManager extends EventEmitter {
  private channels: Map<string, BaseChannel> = new Map();

  /**
   * 注册渠道
   */
  async registerChannel(channel: BaseChannel): Promise<void> {
    console.log(`[ChannelManager] 注册渠道: ${channel.getChannelId()} (${channel.getChannelType()})`);

    // 监听渠道事件并转发
    channel.on('connected', (data) => this.emit('channel-connected', data));
    channel.on('disconnected', (data) => this.emit('channel-disconnected', data));
    channel.on('message', (data) => this.emit('channel-message', data));
    channel.on('command', (data) => this.emit('channel-command', data));

    // 连接渠道
    await channel.connect();

    this.channels.set(channel.getChannelId(), channel);
  }

  /**
   * 获取渠道
   */
  getChannel(id: string): BaseChannel | undefined {
    return this.channels.get(id);
  }

  /**
   * 获取所有渠道
   */
  getAllChannels(): BaseChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * 按类型获取渠道
   */
  getChannelsByType(type: string): BaseChannel[] {
    return this.getAllChannels().filter(c => c.getChannelType() === type);
  }

  /**
   * 移除渠道
   */
  async removeChannel(id: string): Promise<void> {
    const channel = this.channels.get(id);
    if (channel) {
      await channel.disconnect();
      this.channels.delete(id);
      console.log(`[ChannelManager] 已移除渠道: ${id}`);
    }
  }

  /**
   * 关闭所有渠道
   */
  async shutdown(): Promise<void> {
    console.log('[ChannelManager] 正在关闭所有渠道...');
    for (const [id, channel] of this.channels.entries()) {
      await channel.disconnect();
      this.channels.delete(id);
    }
    console.log('[ChannelManager] 所有渠道已关闭');
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; byType: Record<string, number>; connected: number } {
    const byType: Record<string, number> = {};
    let connected = 0;

    for (const channel of this.channels.values()) {
      const type = channel.getChannelType();
      byType[type] = (byType[type] || 0) + 1;
      if (channel.isConnected()) connected++;
    }

    return {
      total: this.channels.size,
      byType,
      connected,
    };
  }
}

/**
 * 渠道工厂
 * 根据配置创建相应的渠道实例
 */
export class ChannelFactory {
  /**
   * 创建渠道实例
   */
  static create(config: ChannelConfig): BaseChannel {
    switch (config.type) {
      case 'telegram':
        return new TelegramChannel(config);
      case 'whatsapp':
        return new WhatsAppChannel(config);
      case 'slack':
        return new SlackChannel(config);
      default:
        throw new Error(`不支持的渠道类型: ${config.type}`);
    }
  }
}

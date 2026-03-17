/**
 * OpenClaw 学习版 - 主入口
 *
 * 这是一个简化版本的 OpenClaw，专注于核心逻辑学习
 */

// 导出公共 API
export { Agent, AgentManager } from './agents/agent.js';
export { MessageRole } from './agents/types.js';
export type { Message, Tool, AgentConfig } from './agents/types.js';

export { GatewayServer, GatewayManager } from './gateway/server.js';
export type { GatewayConfig, Session, Request, Response } from './gateway/types.js';

export {
  BaseChannel,
  TelegramChannel,
  WhatsAppChannel,
  SlackChannel,
  ChannelManager,
  ChannelFactory,
} from './channels/channel.js';
export { ChannelType } from './channels/types.js';
export type { ChannelConfig, Message as ChannelMessage, User } from './channels/types.js';

export { MemoryManager, MemoryBuilder } from './memory/memory.js';
export { MemoryType } from './memory/types.js';
export type { MemoryConfig, MemoryEntry, SearchResult } from './memory/types.js';

export { ConfigManager, ConfigPathResolver, EnvLoader } from './config/config.js';
export type { Config } from './config/types.js';

export {
  SecretsManager,
  SecureSecret,
  SecretGenerator,
  SecretValidator,
} from './secrets/secrets.js';

export {
  PluginLoader,
  HookManager,
  PluginRegistry,
  PluginManager,
} from './plugins/plugin.js';
export type { Plugin, PluginConfig, PluginHook, HookContext } from './plugins/types.js';

export { CLIApplication, main } from './cli/cli.js';
export type { Command, CommandOptions } from './cli/types.js';

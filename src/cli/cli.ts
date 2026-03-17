/**
 * OpenClaw CLI 命令行界面 - 简化学习版
 *
 * 【核心概念】
 * CLI 模块提供命令行交互界面：
 * 1. 命令解析和路由
 * 2. 交互式命令
 * 3. 配置管理命令
 * 4. 状态查询命令
 * 5. 插件管理命令
 *
 * 命令结构:
 * openclaw <command> [options]
 *
 * 可用命令:
 * - start: 启动服务
 * - status: 查看状态
 * - config: 管理配置
 * - plugins: 管理插件
 * - doctor: 诊断检查
 * - version: 显示版本
 */

import { ConfigManager, EnvLoader, ConfigPathResolver } from '../config/config.js';
import type { Config } from '../config/types.js';
import { SecretsManager } from '../secrets/secrets.js';
import { AgentManager } from '../agents/agent.js';
import { createOpenClawCodingTools } from '../agents/pi-tools.js';
import type { AgentConfig } from '../agents/types.js';
import type { Tool } from '../agents/types.js';
import { ModelManager } from '../models/model-manager.js';
import { GatewayManager } from '../gateway/server.js';
import { ChannelManager, ChannelFactory } from '../channels/channel.js';
import { ChannelType } from '../channels/types.js';
import { MemoryManager } from '../memory/memory.js';
import { PluginManager } from '../plugins/plugin.js';
import type { Command, CommandOptions } from './types.js';

/**
 * CLI 应用
 */
export class CLIApplication {
  private configManager: ConfigManager;
  private secretsManager: SecretsManager;
  private modelManager: ModelManager;
  private agentManager: AgentManager;
  private gatewayManager: GatewayManager;
  private channelManager: ChannelManager;
  private memoryManager: MemoryManager;
  private pluginManager: PluginManager;
  private commands: Map<string, Command> = new Map();

  constructor(configPath?: string) {
    // 解析配置文件路径
    const resolvedPath = ConfigPathResolver.resolve(configPath);
    console.log(`[CLI] 配置文件路径: ${resolvedPath}`);

    // 初始化各模块
    this.configManager = new ConfigManager(resolvedPath);
    this.secretsManager = new SecretsManager();
    this.modelManager = new ModelManager();
    this.agentManager = new AgentManager(this.modelManager);
    this.gatewayManager = new GatewayManager();
    this.channelManager = new ChannelManager();
    this.memoryManager = new MemoryManager({
      maxEntries: 10000,
      enableEmbeddings: true,
      embeddingDimension: 384,
    });
    this.pluginManager = new PluginManager();

    // 注册命令
    this.registerCommands();
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    this.addCommand({
      name: 'start',
      description: '启动 OpenClaw 服务',
      handler: async (options) => this.handleStart(options),
    });

    this.addCommand({
      name: 'status',
      description: '显示服务状态',
      handler: async () => this.handleStatus(),
    });

    this.addCommand({
      name: 'config',
      description: '管理配置',
      subcommands: [
        {
          name: 'show',
          description: '显示当前配置',
          handler: async () => this.handleConfigShow(),
        },
        {
          name: 'init',
          description: '初始化配置',
          handler: async () => this.handleConfigInit(),
        },
      ],
    });

    this.addCommand({
      name: 'doctor',
      description: '运行诊断检查',
      handler: async () => this.handleDoctor(),
    });

    this.addCommand({
      name: 'version',
      description: '显示版本信息',
      handler: async () => this.handleVersion(),
    });

    this.addCommand({
      name: 'help',
      description: '显示帮助信息',
      handler: async () => this.handleHelp(),
    });
  }

  /**
   * 添加命令
   */
  private addCommand(command: Command): void {
    this.commands.set(command.name, command);
  }

  /**
   * 运行命令
   */
  async run(args: string[]): Promise<void> {
    let [commandName, ...commandArgs] = args;

    if (!commandName) {
      await this.handleHelp();
      return;
    }

    const command = this.commands.get(commandName);

    if (!command) {
      console.error(`未知命令: ${commandName}`);
      await this.handleHelp();
      process.exit(1);
      return;
    }

    // 处理子命令
    if (command.subcommands && command.subcommands.length > 0 && commandArgs.length > 0) {
      const subcommandName = commandArgs[0];
      const subcommand = command.subcommands.find(s => s.name === subcommandName);
      if (subcommand && subcommand.handler) {
        console.log(`[CLI] 执行命令: ${commandName} ${subcommandName}`);
        try {
          await subcommand.handler(commandArgs.slice(1));
          return;
        } catch (error) {
          console.error(`[CLI] 子命令执行失败:`, error);
          process.exit(1);
        }
      }
    }

    console.log(`[CLI] 执行命令: ${commandName}`);

    try {
      if (command.handler) {
        await command.handler(commandArgs);
      } else {
        this.handleHelp();
      }
    } catch (error) {
      console.error(`[CLI] 命令执行失败:`, error);
      process.exit(1);
    }
  }

  /**
   * 处理 start 命令
   */
  private async handleStart(options: CommandOptions): Promise<void> {
    console.log('[CLI] 启动 OpenClaw 服务...');

    // 加载环境变量
    await EnvLoader.load();

    // 加载配置
    await this.configManager.load();
    const config = this.configManager.getConfig();

    // 加载密钥
    this.secretsManager.loadFromEnv('openai_key', 'OPENAI_API_KEY');
    this.secretsManager.loadFromEnv('anthropic_key', 'ANTHROPIC_API_KEY');

    // 加载模型提供者配置
    if (config.models?.providers) {
      console.log(`[CLI] 发现模型配置，提供者: ${Object.keys(config.models.providers)}`);
      this.modelManager.loadFromConfig(config.models);
    } else {
      console.warn('[CLI] 未找到模型配置');
    }

    // 初始化记忆系统
    await this.memoryManager.initialize();

    // 获取第一个 Agent 配置
    let agentConfig: AgentConfig = config.agent || {
      id: 'default',
      model: 'volcengine-plan/ark-code-latest',
    };
    if (config.agents && Array.isArray((config.agents as any).list) && (config.agents as any).list.length > 0) {
      // 从 agents.list 取第一个
      agentConfig = (config.agents as any).list[0] as AgentConfig;
      // 如果 model 是 "provider/model" 格式，直接使用
      console.log(`[CLI] 使用 Agent 配置: ${agentConfig.id}, 模型: ${agentConfig.model}`);
    }

    // 创建 Agent
    const agent = await this.agentManager.createAgent(agentConfig);

    // 创建并注册所有核心工具（包括我们刚添加的 get_datetime）
    const allTools = createOpenClawCodingTools();
    for (const tool of allTools) {
      agent.registerTool(tool);
    }
    console.log(`[CLI] 已注册 ${allTools.length} 个核心工具`);

    // 监听 agent-message 事件并打印日志
    this.agentManager.on('agent-message', (data) => {
      console.log(`[Event:agent-message] Agent=${data.agentId}, message=${JSON.stringify(data.message)}`);
    });

    // 启动 Gateway
    const server = await this.gatewayManager.startServer(config.gateway || { port: 3000 });

    // 设置默认 Agent
    server.setDefaultAgent(agent);

    // 注册渠道（跳过不支持的渠道类型，简化学习版只支持 web/telegram/whatsapp/slack）
    if (config.channels && typeof config.channels === 'object') {
      for (const [channelType, channelConfig] of Object.entries(config.channels)) {
        if ((channelConfig as any).enabled !== false) {
          try {
            const channel = ChannelFactory.create({
              ...(channelConfig as object),
              type: channelType as unknown as ChannelType,
              id: channelType,
            });
            await this.channelManager.registerChannel(channel);
          } catch (error) {
            console.warn(`[CLI] 跳过不支持的渠道 ${channelType}:`, (error as Error).message);
          }
        }
      }
    }

    console.log('[CLI] OpenClaw 服务已启动');
    console.log('[CLI] 按 Ctrl+C 停止服务');

    // 监听退出信号
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * 处理 status 命令
   */
  private async handleStatus(): Promise<void> {
    console.log('=== OpenClaw 状态 ===\n');

    const gatewayStats = this.gatewayManager.getServer()?.getStats();
    const channelStats = this.channelManager.getStats();
    const memoryStats = this.memoryManager.getStats();

    console.log('Gateway:');
    console.log(`  状态: ${gatewayStats?.running ? '运行中' : '已停止'}`);
    console.log(`  会话数: ${gatewayStats?.sessions || 0}`);
    console.log(`  Agent 数: ${gatewayStats?.agents || 0}\n`);

    console.log('Channels:');
    console.log(`  总数: ${channelStats.total}`);
    console.log(`  已连接: ${channelStats.connected}`);
    console.log(`  按类型:`);
    for (const [type, count] of Object.entries(channelStats.byType)) {
      console.log(`    - ${type}: ${count}`);
    }

    console.log('\nMemory:');
    console.log(`  条目数: ${memoryStats.entries}`);
    console.log(`  嵌入数: ${memoryStats.embeddings}`);
    console.log(`  状态: ${memoryStats.initialized ? '已初始化' : '未初始化'}`);
  }

  /**
   * 处理 config show 命令
   */
  private async handleConfigShow(): Promise<void> {
    await this.configManager.load();
    const config = this.configManager.getConfig();

    console.log('=== OpenClaw 配置 ===\n');
    console.log(JSON.stringify(config, null, 2));
  }

  /**
   * 处理 config init 命令
   */
  private async handleConfigInit(): Promise<void> {
    console.log('[CLI] 初始化配置...');

    // 保存默认配置
    const configManager = this.configManager as ConfigManager & { getDefaultConfig: () => Config };
    this.configManager.update(configManager.getDefaultConfig());
    await this.configManager.save();

    console.log('[CLI] 配置已初始化');
  }

  /**
   * 处理 doctor 命令
   */
  private async handleDoctor(): Promise<void> {
    console.log('=== OpenClaw 诊断 ===\n');

    const checks = [
      {
        name: 'Node.js 版本',
        check: () => process.version >= 'v22.12.0',
      },
      {
        name: '配置文件',
        check: async () => {
          try {
            await this.configManager.load();
            return true;
          } catch {
            return false;
          }
        },
      },
      {
        name: '密钥',
        check: () => this.secretsManager.verifyAll().valid,
      },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of checks) {
      const result = await test.check();
      const status = result ? '✓ 通过' : '✗ 失败';
      console.log(`${status} ${test.name}`);

      if (result) passed++;
      else failed++;
    }

    console.log(`\n总计: ${passed} 通过, ${failed} 失败`);
  }

  /**
   * 处理 version 命令
   */
  private async handleVersion(): Promise<void> {
    console.log('OpenClaw 学习版 v0.1.0');
    console.log('Node.js', process.version);
    console.log('Platform', process.platform);
  }

  /**
   * 处理 help 命令
   */
  private async handleHelp(): Promise<void> {
    console.log('OpenClaw - 个人 AI 助手\n');
    console.log('用法: openclaw <命令> [选项]\n');
    console.log('命令:\n');

    for (const [name, command] of this.commands.entries()) {
      console.log(`  ${name.padEnd(12)} ${command.description}`);

      if (command.subcommands) {
        for (const sub of command.subcommands) {
          console.log(`    ${name} ${sub.name.padEnd(10)} ${sub.description}`);
        }
      }
    }

    console.log('\n选项:\n');
    console.log('  -h, --help     显示帮助信息');
    console.log('  -v, --version  显示版本信息');
    console.log('  --config <path> 指定配置文件路径');
  }

  /**
   * 关闭服务
   */
  private async shutdown(): Promise<void> {
    console.log('\n[CLI] 正在停止服务...');

    await this.gatewayManager.stopServer();
    await this.channelManager.shutdown();
    await this.agentManager.shutdown();

    console.log('[CLI] 服务已停止');
    process.exit(0);
  }
}

/**
 * 命令行入口
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 检查 --config 参数
  let configPath: string | undefined;
  const configArgIndex = args.indexOf('--config');
  if (configArgIndex !== -1 && configArgIndex + 1 < args.length) {
    configPath = args[configArgIndex + 1];
    // 从参数列表移除 --config 和路径
    args.splice(configArgIndex, 2);
  }

  const cli = new CLIApplication(configPath);

  await cli.run(args);
}

// 如果直接运行此文件
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

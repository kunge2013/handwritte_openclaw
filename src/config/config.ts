/**
 * OpenClaw Config 配置管理 - 简化学习版
 *
 * 【核心概念】
 * Config 模块负责：
 * 1. 加载和解析配置文件
 * 2. 配置验证
 * 3. 配置文件路径解析
 * 4. 环境变量集成
 * 5. 默认值处理
 *
 * 配置文件结构:
 * {
 *   agent: { ... },
 *   gateway: { ... },
 *   channels: [ ... ],
 *   memory: { ... },
 *   plugins: { ... }
 * }
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Config, ConfigValidationResult } from './types.js';
import { ChannelType } from '../channels/types.js';

/**
 * 配置管理器
 */
export class ConfigManager {
  private config: Config | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    // 默认配置文件路径
    this.configPath = configPath || path.join(process.cwd(), 'openclaw.config.json');
  }

  /**
   * 加载配置文件
   */
  async load(): Promise<Config> {
    console.log(`[Config] 加载配置文件: ${this.configPath}`);

    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(content);

      // 验证配置
      const validation = this.validate(parsed);
      if (!validation.valid) {
        throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
      }

      // 合并默认值
      this.config = this.mergeDefaults(parsed);

      console.log('[Config] 配置加载成功');
      return this.config;
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        console.log('[Config] 配置文件不存在，使用默认配置');
        this.config = this.getDefaultConfig();
        return this.config;
      }
      throw error;
    }
  }

  /**
   * 保存配置文件
   */
  async save(): Promise<void> {
    if (!this.config) {
      throw new Error('没有配置可保存');
    }

    console.log(`[Config] 保存配置文件: ${this.configPath}`);
    await fs.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
      'utf-8',
    );
    console.log('[Config] 配置保存成功');
  }

  /**
   * 获取配置
   */
  getConfig(): Config {
    if (!this.config) {
      throw new Error('配置未加载');
    }
    return this.config;
  }

  /**
   * 获取部分配置
   */
  getSection<T>(section: keyof Config): T {
    return this.getConfig()[section] as unknown as T;
  }

  /**
   * 更新配置
   */
  update(updates: Partial<Config>): void {
    if (!this.config) {
      this.config = this.getDefaultConfig();
    }

    this.config = { ...this.config, ...updates };
  }

  /**
   * 获取环境变量
   */
  getEnvVar(name: string, defaultValue?: string): string {
    return process.env[name] || defaultValue || '';
  }

  /**
   * 获取环境变量（数字）
   */
  getEnvVarNumber(name: string, defaultValue?: number): number {
    const value = process.env[name];
    if (value === undefined) return defaultValue ?? 0;
    return parseInt(value, 10);
  }

  /**
   * 验证配置
   */
  private validate(config: unknown): ConfigValidationResult {
    const errors: string[] = [];

    // 基本结构检查
    if (typeof config !== 'object' || config === null) {
      return { valid: false, errors: ['配置必须是一个对象'] };
    }

    const c = config as Record<string, unknown>;

    // 验证 agent 配置
    if (c.agent && typeof c.agent === 'object') {
      const agent = c.agent as Record<string, unknown>;
      if (!agent.id || typeof agent.id !== 'string') {
        errors.push('agent.id 必须是非空字符串');
      }
    }

    // 验证 gateway 配置
    if (c.gateway && typeof c.gateway === 'object') {
      const gateway = c.gateway as Record<string, unknown>;
      if (!gateway.port || typeof gateway.port !== 'number') {
        errors.push('gateway.port 必须是数字');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 合并默认值
   */
  private mergeDefaults(config: Partial<Config>): Config {
    return {
      ...this.getDefaultConfig(),
      ...config,
    };
  }

  /**
   * 获取默认配置
   */
  public getDefaultConfig(): Config {
    return {
      agent: {
        id: 'default-agent',
        name: 'OpenClaw Agent',
        model: 'claude-3-5-sonnet',
        systemPrompt: '你是一个AI助手，帮助用户解决问题。',
        maxHistoryLength: 100,
        temperature: 0.7,
      },
      gateway: {
        host: '0.0.0.0',
        port: 3000,
        maxConnections: 1000,
        sessionTimeout: 3600000, // 1小时
      },
      channels: [
        {
          id: 'telegram-main',
          type: ChannelType.TELEGRAM,
          enabled: true,
          commandPrefix: '/',
        },
      ],
      memory: {
        maxEntries: 10000,
        enableEmbeddings: true,
        embeddingDimension: 384,
      },
      plugins: {
        enabled: true,
        autoLoad: true,
      },
    };
  }
}

/**
 * 配置路径解析器
 */
export class ConfigPathResolver {
  /**
   * 解析配置文件路径
   */
  static resolve(configPath?: string): string {
    if (configPath) {
      // 绝对路径直接返回
      if (path.isAbsolute(configPath)) {
        return configPath;
      }

      // 相对路径从当前工作目录解析
      return path.resolve(process.cwd(), configPath);
    }

    // 查找配置文件的默认路径
    const defaultPaths = [
      'openclaw.config.json',
      '.openclawrc',
      '.openclawrc.json',
      'openclaw.json',
    ];

    for (const p of defaultPaths) {
      const fullPath = path.resolve(process.cwd(), p);
      // 简化检查（实际项目中应该用 fs.access）
      try {
        return fullPath;
      } catch {
        continue;
      }
    }

    // 返回默认路径
    return path.resolve(process.cwd(), 'openclaw.config.json');
  }
}

/**
 * 环境变量加载器
 */
export class EnvLoader {
  /**
   * 从 .env 文件加载环境变量
   */
  static async load(envPath?: string): Promise<void> {
    const filePath = envPath || path.join(process.cwd(), '.env');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // 跳过空行和注释
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        // 解析 KEY=VALUE 格式
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const [, key, value] = match;
          // 简单处理引号
          const cleanValue = value
            .replace(/^['"]|['"]$/g, '')
            .replace(/\\n/g, '\n');
          process.env[key] = cleanValue;
        }
      }

      console.log(`[EnvLoader] 已加载环境变量: ${filePath}`);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') {
        console.warn(`[EnvLoader] 加载环境变量失败:`, error);
      }
    }
  }
}

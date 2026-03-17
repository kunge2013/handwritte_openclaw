/**
 * OpenClaw CLI 类型定义
 */

/**
 * 命令选项
 */
export type CommandOptions = string[];

/**
 * 命令接口
 */
export interface Command {
  /** 命令名称 */
  name: string;
  /** 命令描述 */
  description: string;
  /** 子命令 */
  subcommands?: Command[];
  /** 命令处理器 */
  handler?: (args: CommandOptions) => Promise<void>;
}

/**
 * 命令上下文
 */
export interface CommandContext {
  /** 命令名称 */
  command: string;
  /** 命令参数 */
  args: CommandOptions;
  /** 全局选项 */
  options: GlobalOptions;
}

/**
 * 全局选项
 */
export interface GlobalOptions {
  /** 配置文件路径 */
  config?: string;
  /** 是否详细输出 */
  verbose?: boolean;
  /** 是否静默模式 */
  silent?: boolean;
}

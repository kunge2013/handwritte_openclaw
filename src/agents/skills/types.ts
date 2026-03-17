/**
 * OpenClaw Agent Skills 类型定义
 *
 * 【核心概念】
 * 技能系统是模块化的能力扩展框架，通过 SKILL.md 文件定义可重用的技能包。
 *
 * 【设计理念】
 * 1. 渐进式披露 - 只在需要时加载完整内容
 * 2. 可扩展性 - 支持多种安装和集成方式
 * 3. 安全性 - 严格的输入验证和路径检查
 */

/**
 * 技能安装规范
类型定义支持的安装方式
 */
export type SkillInstallSpec = {
  /** 安装包 ID (可选) */
  id?: string;
  /** 安装类型 */
  kind: 'brew' | 'node' | 'go' | 'uv' | 'download';
  /** 安装标签 (用于显示) */
  label?: string;
  /** 提供的二进制文件列表 */
  bins?: string[];
  /** 支持的操作系统 */
  os?: string[];
  /** Homebrew formula */
  formula?: string;
  /** npm/yarn/pnpm/bun 包名 */
  package?: string;
  /** Go 模块路径 */
  module?: string;
  /** 下载 URL */
  url?: string;
  /** 归档类型 */
  archive?: string;
  /** 是否提取 */
  extract?: boolean;
  /** 去除层级 */
  stripComponents?: number;
  /** 目标目录 */
  targetDir?: string;
};

/**
 * OpenClaw 技能元数据
 *
 * 从 SKILL.md 前置元数据中解析的 OpenClaw 特定配置
 */
export type OpenClawSkillMetadata = {
  /** 是否始终包含在提示词中 */
  always?: boolean;
  /** 技能键 (用于配置引用) */
  skillKey?: string;
  /** 主要环境变量名称 */
  primaryEnv?: string;
  /** 显示 emoji */
  emoji?: string;
  /** 主页 URL */
  homepage?: string;
  /** 支持的操作系统 */
  os?: string[];
  /** 依赖要求 */
  requires?: {
    /** 需要的二进制文件 (所有) */
    bins?: string[];
    /** 需要的二进制文件 (任意一个) */
    anyBins?: string[];
    /** 需要的环境变量 */
    env?: string[];
    /** 需要的配置路径 */
    config?: string[];
  };
  /** 安装规范 */
  install?: SkillInstallSpec[];
};

/**
 * 技能调用策略
 *
 * 定义技能如何被调用
 */
export type SkillInvocationPolicy = {
  /** 用户是否可以直接调用 (通过 slash 命令) */
  userInvocable: boolean;
  /** 是否禁用模型调用 (即只能用户触发) */
  disableModelInvocation: boolean;
};

/**
 * 技能命令分发规范
 *
 * 定义技能命令如何分发到工具
 */
export type SkillCommandDispatchSpec = {
  kind: 'tool';
  /** 要调用的工具名称 */
  toolName: string;
  /** 参数转发模式 */
  argMode?: 'raw';
};

/**
 * 技能命令规范
 *
 * 定义技能的命令接口
 */
export type SkillCommandSpec = {
  /** 命令名称 */
  name: string;
  /** 关联的技能名称 */
  skillName: string;
  /** 命令描述 */
  description: string;
  /** 命令分发规范 (可选) */
  dispatch?: SkillCommandDispatchSpec;
};

/**
 * 技能安装偏好设置
 */
export type SkillsInstallPreferences = {
  /** 是否优先使用 brew */
  preferBrew: boolean;
  /** Node 包管理器 */
  nodeManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
};

/**
 * 解析的前置元数据
 *
 * 从 SKILL.md 文件顶部 YAML 块解析的键值对
 */
export type ParsedSkillFrontmatter = Record<string, string>;

/**
 * 技能定义
 *
 * 从 SKILL.md 文件解析的完整技能信息
 */
export type Skill = {
  /** 技能名称 (必需) */
  name: string;
  /** 技能描述 (必需) */
  description: string;
  /** 技能目录路径 */
  baseDir: string;
  /** SKILL.md 文件路径 */
  filePath: string;
  /** 技能来源标识 */
  source: string;
};

/**
 * 技能条目
 *
 * 包含技能定义和解析的元数据
 */
export type SkillEntry = {
  /** 技能定义 */
  skill: Skill;
  /** 解析的前置元数据 */
  frontmatter: ParsedSkillFrontmatter;
  /** OpenClaw 特定元数据 */
  metadata?: OpenClawSkillMetadata;
  /** 调用策略 */
  invocation?: SkillInvocationPolicy;
};

/**
 * 技能就绪性上下文
 *
 * 用于检查技能是否可以在当前环境中运行
 */
export type SkillEligibilityContext = {
  /** 远程环境信息 (用于远程执行) */
  remote?: {
    /** 支持的平台列表 */
    platforms: string[];
    /** 检查是否有指定二进制文件 */
    hasBin: (bin: string) => boolean;
    /** 检查是否有任意一个二进制文件 */
    hasAnyBin: (bins: string[]) => boolean;
    /** 附加说明 */
    note?: string;
  };
};

/**
 * 技能快照
 *
 * 技能系统状态的快照，用于缓存和版本管理
 */
export type SkillSnapshot = {
  /** 生成的提示词内容 */
  prompt: string;
  /** 包含的技能列表 */
  skills: Array<{
    name: string;
    primaryEnv?: string;
    requiredEnv?: string[];
  }>;
  /** 技能过滤器 (如果有) */
  skillFilter?: string[];
  /** 解析的技能列表 */
  resolvedSkills?: Skill[];
  /** 快照版本 */
  version?: number;
};

/**
 * 技能加载选项
 *
 * 配置技能加载行为
 */
export type SkillLoadOptions = {
  /** 配置对象 */
  config?: unknown;
  /** 管理技能目录 */
  managedSkillsDir?: string;
  /** 内置技能目录 */
  bundledSkillsDir?: string;
  /** 工作区目录 */
  workspaceDir: string;
};

/**
 * 技能构建选项
 *
 * 构建技能提示词的选项
 */
export type SkillBuildOptions = {
  /** 配置对象 */
  config?: unknown;
  /** 技能条目 (如果已加载) */
  entries?: SkillEntry[];
  /** 技能过滤器 */
  skillFilter?: string[];
  /** 就绪性上下文 */
  eligibility?: SkillEligibilityContext;
  /** 管理技能目录 */
  managedSkillsDir?: string;
  /** 内置技能目录 */
  bundledSkillsDir?: string;
};

/**
 * 技能限制配置
 *
 * 控制技能系统的各种限制
 */
export type SkillLimits = {
  /** 每个根目录最大候选数 */
  maxCandidatesPerRoot?: number;
  /** 每个源最大加载数 */
  maxSkillsLoadedPerSource?: number;
  /** 提示词中最大技能数 */
  maxSkillsInPrompt?: number;
  /** 提示词最大字符数 */
  maxSkillsPromptChars?: number;
  /** SKILL.md 最大字节数 */
  maxSkillFileBytes?: number;
};

/**
 * 技能事件类型
 */
export type SkillEventType =
  | 'loaded'
  | 'filtered'
  | 'error'
  | 'invoked';

/**
 * 技能事件数据
 */
export type SkillEventData = {
  type: SkillEventType;
  skillName: string;
  timestamp: number;
  data?: unknown;
};

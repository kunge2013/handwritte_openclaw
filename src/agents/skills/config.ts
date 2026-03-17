/**
 * OpenClaw Agent Skills - 配置管理
 *
 * 【功能说明】
 * 管理技能系统的配置，包括技能启用状态、环境变量、允许列表等。
 *
 * 【核心功能】
 * 1. 解析技能配置
 * 2. 检查技能是否启用
 * 3. 管理内置技能允许列表
 * 4. 评估技能就绪性
 */

import type { SkillConfig } from '../types.js';
import type {
  OpenClawSkillMetadata,
  SkillEligibilityContext,
  SkillEntry,
} from './types.js';
import { resolveSkillKey } from './frontmatter.js';

/**
 * 技能配置类型 (简化版本)
 *
 * 实际项目中应该从主配置文件导入
 */
export interface SkillConfigInternal {
  /** 是否启用 */
  enabled?: boolean;
  /** 环境变量覆盖 */
  env?: Record<string, string>;
  /** API 密钥 */
  apiKey?: string;
}

/**
 * 主配置类型 (简化版本)
 */
export interface OpenClawConfigInternal {
  /** 技能配置 */
  skills?: {
    /** 允许的内置技能列表 */
    allowBundled?: string[];
    /** 技能条目配置 */
    entries?: Record<string, SkillConfigInternal>;
    /** 加载配置 */
    load?: {
      /** 额外技能目录 */
      extraDirs?: string[];
    };
  };
}

/**
 * 默认配置值
 *
 * 某些配置项有默认启用状态
 */
const DEFAULT_CONFIG_VALUES: Record<string, boolean> = {
  'browser.enabled': true,
  'browser.evaluateEnabled': true,
};

/**
 * 检查二进制文件是否存在
 *
 * @param bin - 二进制文件名
 * @returns 是否存在
 */
export function hasBinary(bin: string): boolean {
  try {
    // 使用 which 命令检查
    const { spawnSync } = require('child_process');
    const result = spawnSync('which', [bin], { encoding: 'utf-8' });
    return result.status === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * 解析配置路径
 *
 * @param config - 配置对象
 * @param pathStr - 配置路径 (点分隔)
 * @returns 配置值
 */
export function resolveConfigPath(
  config: OpenClawConfigInternal | undefined,
  pathStr: string
): unknown {
  if (!config) {
    return undefined;
  }

  const parts = pathStr.split('.');
  let current: unknown = config;

  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * 检查配置路径是否为真值
 *
 * @param config - 配置对象
 * @param pathStr - 配置路径
 * @returns 是否为真值
 */
export function isConfigPathTruthy(
  config: OpenClawConfigInternal | undefined,
  pathStr: string
): boolean {
  const value = resolveConfigPath(config, pathStr);
  const defaultValue = DEFAULT_CONFIG_VALUES[pathStr];

  if (value === undefined) {
    return defaultValue ?? false;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    return value.length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
}

/**
 * 获取运行时平台
 *
 * @returns 当前平台
 */
export function resolveRuntimePlatform(): string {
  return process.platform;
}

/**
 * 解析技能配置
 *
 * @param config - 配置对象
 * @param skillKey - 技能键
 * @returns 技能配置
 */
export function resolveSkillConfig(
  config: OpenClawConfigInternal | undefined,
  skillKey: string
): SkillConfigInternal | undefined {
  const skills = config?.skills?.entries;
  if (!skills || typeof skills !== 'object') {
    return undefined;
  }

  const entry = skills[skillKey];
  if (!entry || typeof entry !== 'object') {
    return undefined;
  }

  return entry;
}

/**
 * 规范化允许列表
 *
 * @param input - 原始输入
 * @returns 规范化的字符串数组
 */
function normalizeAllowlist(input: unknown): string[] | undefined {
  if (!input) {
    return undefined;
  }

  if (!Array.isArray(input)) {
    return undefined;
  }

  const normalized = input
    .filter(item => typeof item === 'string' && item.trim())
    .map(item => item.trim());

  return normalized.length > 0 ? normalized : undefined;
}

/**
 * 内置技能来源集合
 */
const BUNDLED_SOURCES = new Set(['openclaw-bundled', 'bundled']);

/**
 * 检查是否为内置技能
 *
 * @param entry - 技能条目
 * @returns 是否为内置技能
 */
function isBundledSkill(entry: SkillEntry): boolean {
  return BUNDLED_SOURCES.has(entry.skill.source);
}

/**
 * 解析内置技能允许列表
 *
 * @param config - 配置对象
 * @returns 允许列表
 */
export function resolveBundledAllowlist(
  config?: OpenClawConfigInternal
): string[] | undefined {
  return normalizeAllowlist(config?.skills?.allowBundled);
}

/**
 * 检查内置技能是否被允许
 *
 * @param entry - 技能条目
 * @param allowlist - 允许列表
 * @returns 是否允许
 */
export function isBundledSkillAllowed(
  entry: SkillEntry,
  allowlist?: string[]
): boolean {
  // 如果没有配置允许列表，默认允许所有
  if (!allowlist || allowlist.length === 0) {
    return true;
  }

  // 非内置技能不受限制
  if (!isBundledSkill(entry)) {
    return true;
  }

  // 检查技能是否在允许列表中
  const key = resolveSkillKey(entry.skill, entry);
  return allowlist.includes(key) || allowlist.includes(entry.skill.name);
}

/**
 * 评估技能就绪性
 *
 * 检查技能是否可以在当前环境中运行
 *
 * @param params - 评估参数
 * @returns 是否就绪
 */
export function evaluateRuntimeEligibility(params: {
  /** 技能支持的操作系统 */
  os?: string[];
  /** 远程平台列表 */
  remotePlatforms?: string[];
  /** 是否始终包含 */
  always?: boolean;
  /** 依赖要求 */
  requires?: OpenClawSkillMetadata['requires'];
  /** 检查本地二进制文件 */
  hasBin: (bin: string) => boolean;
  /** 检查远程二进制文件 */
  hasRemoteBin?: (bin: string) => boolean;
  /** 检查远程任意二进制文件 */
  hasAnyRemoteBin?: (bins: string[]) => boolean;
  /** 检查环境变量 */
  hasEnv: (envName: string) => boolean;
  /** 检查配置路径 */
  isConfigPathTruthy: (path: string) => boolean;
}): boolean {
  const {
    os,
    remotePlatforms,
    always,
    requires,
    hasBin,
    hasRemoteBin,
    hasAnyRemoteBin,
    hasEnv,
    isConfigPathTruthy,
  } = params;

  // 如果标记为 always，总是包含
  if (always) {
    return true;
  }

  // 检查操作系统兼容性
  if (os && os.length > 0) {
    const currentPlatform = resolveRuntimePlatform();

    // 检查本地平台
    const localMatch = os.includes(currentPlatform);

    // 检查远程平台 (如果有远程环境)
    let remoteMatch = false;
    if (remotePlatforms && remotePlatforms.length > 0) {
      remoteMatch = os.some(allowed => remotePlatforms.includes(allowed));
    }

    // 本地或远程至少有一个匹配
    if (!localMatch && !remoteMatch) {
      return false;
    }
  }

  // 检查依赖要求
  if (requires) {
    // 检查必需的二进制文件 (所有)
    if (requires.bins && requires.bins.length > 0) {
      const allLocalBinsExist = requires.bins.every(hasBin);

      // 检查远程
      let allRemoteBinsExist = false;
      if (hasRemoteBin) {
        allRemoteBinsExist = requires.bins.every(hasRemoteBin);
      }

      // 至少一个环境满足
      if (!allLocalBinsExist && !allRemoteBinsExist) {
        return false;
      }
    }

    // 检查必需的二进制文件 (任意一个)
    if (requires.anyBins && requires.anyBins.length > 0) {
      const anyLocalBinExists = requires.anyBins.some(hasBin);

      // 检查远程
      let anyRemoteBinExists = false;
      if (hasAnyRemoteBin) {
        anyRemoteBinExists = hasAnyRemoteBin(requires.anyBins);
      }

      // 至少一个环境满足
      if (!anyLocalBinExists && !anyRemoteBinExists) {
        return false;
      }
    }

    // 检查必需的环境变量
    if (requires.env && requires.env.length > 0) {
      const allEnvExist = requires.env.every(hasEnv);
      if (!allEnvExist) {
        return false;
      }
    }

    // 检查必需的配置路径
    if (requires.config && requires.config.length > 0) {
      const allConfigTruthy = requires.config.every(isConfigPathTruthy);
      if (!allConfigTruthy) {
        return false;
      }
    }
  }

  return true;
}

/**
 * 检查是否应该包含技能
 *
 * 综合检查技能是否应该被包含在系统中
 *
 * @param params - 检查参数
 * @returns 是否包含
 */
export function shouldIncludeSkill(params: {
  entry: SkillEntry;
  config?: OpenClawConfigInternal;
  eligibility?: SkillEligibilityContext;
}): boolean {
  const { entry, config, eligibility } = params;

  // 获取技能键和配置
  const skillKey = resolveSkillKey(entry.skill, entry);
  const skillConfig = resolveSkillConfig(config, skillKey);

  // 检查是否明确禁用
  if (skillConfig?.enabled === false) {
    return false;
  }

  // 检查内置技能允许列表
  const allowBundled = resolveBundledAllowlist(config);
  if (!isBundledSkillAllowed(entry, allowBundled)) {
    return false;
  }

  // 评估运行时就绪性
  return evaluateRuntimeEligibility({
    os: entry.metadata?.os,
    remotePlatforms: eligibility?.remote?.platforms,
    always: entry.metadata?.always,
    requires: entry.metadata?.requires,
    hasBin: hasBinary,
    hasRemoteBin: eligibility?.remote?.hasBin,
    hasAnyRemoteBin: eligibility?.remote?.hasAnyBin,
    hasEnv: (envName) =>
      Boolean(
        process.env[envName] ||
        skillConfig?.env?.[envName] ||
        (skillConfig?.apiKey && entry.metadata?.primaryEnv === envName)
      ),
    isConfigPathTruthy: (configPath) =>
      isConfigPathTruthy(config, configPath),
  });
}

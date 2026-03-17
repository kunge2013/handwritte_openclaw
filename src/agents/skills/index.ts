/**
 * OpenClaw Agent Skills - 统一导出接口
 *
 * 【功能说明】
 * 提供技能系统的统一导出接口，方便外部模块使用。
 */

// 类型定义
export type {
  Skill,
  SkillEntry,
  SkillSnapshot,
  SkillBuildOptions,
  SkillLoadOptions,
  SkillLimits,
  SkillEventType,
  SkillEventData,
  SkillCommandSpec,
  SkillCommandDispatchSpec,
  SkillInvocationPolicy,
  SkillInstallSpec,
  SkillsInstallPreferences,
  OpenClawSkillMetadata,
  ParsedSkillFrontmatter,
  SkillEligibilityContext,
} from './types.js';

// 前置元数据解析
export {
  parseFrontmatter,
  resolveOpenClawMetadata,
  resolveSkillInvocationPolicy,
  resolveSkillKey,
} from './frontmatter.js';

// 配置管理
export {
  resolveSkillConfig,
  resolveBundledAllowlist,
  isBundledSkillAllowed,
  shouldIncludeSkill,
  hasBinary,
  resolveConfigPath,
  isConfigPathTruthy,
  resolveRuntimePlatform,
  evaluateRuntimeEligibility,
} from './config.js';

// 技能过滤
export {
  normalizeSkillFilter,
  normalizeSkillFilterForComparison,
  matchesSkillFilter,
  SkillMatcher,
  SkillTagMatcher,
  createSkillFilter,
} from './filter.js';

// 工作区技能管理
export {
  loadWorkspaceSkillEntries,
  buildWorkspaceSkillSnapshot,
  buildWorkspaceSkillsPrompt,
  filterWorkspaceSkillEntries,
  buildWorkspaceSkillCommandSpecs,
  resolveSkillsPromptForRun,
} from './workspace.js';

/**
 * 技能系统版本
 */
export const SKILLS_VERSION = '1.0.0';

/**
 * 技能系统信息
 */
export interface SkillsSystemInfo {
  /** 版本 */
  version: string;
  /** 特性列表 */
  features: string[];
}

/**
 * 获取技能系统信息
 *
 * @returns 技能系统信息
 */
export function getSkillsSystemInfo(): SkillsSystemInfo {
  return {
    version: SKILLS_VERSION,
    features: [
      'progressive-disclosure',
      'skill-filtering',
      'configuration-support',
      'eligibility-checking',
      'path-compression',
      'command-dispatching',
    ],
  };
}

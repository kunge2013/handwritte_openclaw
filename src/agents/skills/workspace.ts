/**
 * OpenClaw Agent Skills - 工作区技能管理
 *
 * 【功能说明】
 * 管理工作区中的技能系统，包括技能加载、过滤、快照构建等功能。
 *
 * 【核心功能】
 * 1. 从多个源加载技能
 * 2. 构建技能快照
 * 3. 生成技能提示词
 * 4. 技能命令分发
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {
  Skill,
  SkillBuildOptions,
  SkillCommandSpec,
  SkillEligibilityContext,
  SkillEntry,
  SkillLimits,
  SkillSnapshot,
} from './types.js';
import { shouldIncludeSkill } from './config.js';
import { normalizeSkillFilter } from './filter.js';
import {
  parseFrontmatter,
  resolveOpenClawMetadata,
  resolveSkillInvocationPolicy,
} from './frontmatter.js';

const fsp = fs.promises;

/**
 * 默认技能限制配置
 */
const DEFAULT_LIMITS: Required<SkillLimits> = {
  maxCandidatesPerRoot: 300,
  maxSkillsLoadedPerSource: 200,
  maxSkillsInPrompt: 150,
  maxSkillsPromptChars: 30_000,
  maxSkillFileBytes: 256_000,
};

/**
 * 技能命令名称最大长度
 */
const SKILL_COMMAND_MAX_LENGTH = 32;

/**
 * 技能命令描述最大长度
 */
const SKILL_COMMAND_DESCRIPTION_MAX_LENGTH = 100;

/**
 * 技能命令后备名称
 */
const SKILL_COMMAND_FALLBACK = 'skill';

/**
 * 解析技能限制配置
 *
 * @param config - 配置对象 (简化版本)
 * @returns 技能限制配置
 */
function resolveSkillLimits(config?: unknown): Required<SkillLimits> {
  if (!config || typeof config !== 'object') {
    return { ...DEFAULT_LIMITS };
  }

  const configObj = config as Record<string, unknown>;
  const skillsConfig = configObj.skills;

  if (!skillsConfig || typeof skillsConfig !== 'object') {
    return { ...DEFAULT_LIMITS };
  }

  const skillsObj = skillsConfig as Record<string, unknown>;
  const limitsConfig = skillsObj.limits;

  if (!limitsConfig || typeof limitsConfig !== 'object') {
    return { ...DEFAULT_LIMITS };
  }

  const limitsObj = limitsConfig as Record<string, unknown>;

  return {
    maxCandidatesPerRoot:
      typeof limitsObj.maxCandidatesPerRoot === 'number'
        ? limitsObj.maxCandidatesPerRoot
        : DEFAULT_LIMITS.maxCandidatesPerRoot,
    maxSkillsLoadedPerSource:
      typeof limitsObj.maxSkillsLoadedPerSource === 'number'
        ? limitsObj.maxSkillsLoadedPerSource
        : DEFAULT_LIMITS.maxSkillsLoadedPerSource,
    maxSkillsInPrompt:
      typeof limitsObj.maxSkillsInPrompt === 'number'
        ? limitsObj.maxSkillsInPrompt
        : DEFAULT_LIMITS.maxSkillsInPrompt,
    maxSkillsPromptChars:
      typeof limitsObj.maxSkillsPromptChars === 'number'
        ? limitsObj.maxSkillsPromptChars
        : DEFAULT_LIMITS.maxSkillsPromptChars,
    maxSkillFileBytes:
      typeof limitsObj.maxSkillFileBytes === 'number'
        ? limitsObj.maxSkillFileBytes
        : DEFAULT_LIMITS.maxSkillFileBytes,
  };
}

/**
 * 压缩技能路径
 *
 * 将用户主目录前缀替换为 ~ 以节省 token
 *
 * @param skills - 技能列表
 * @returns 路径压缩后的技能列表
 */
function compactSkillPaths(skills: Skill[]): Skill[] {
  const home = os.homedir();
  if (!home) {
    return skills;
  }

  const prefix = home.endsWith(path.sep) ? home : home + path.sep;

  return skills.map(skill => ({
    ...skill,
    filePath: skill.filePath.startsWith(prefix)
      ? '~/' + skill.filePath.slice(prefix.length)
      : skill.filePath,
  }));
}

/**
 * 列出子目录
 *
 * @param dir - 目录路径
 * @returns 子目录名称列表
 */
function listChildDirectories(dir: string): string[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const dirs: string[] = [];

    for (const entry of entries) {
      // 跳过隐藏目录和 node_modules
      if (entry.name.startsWith('.')) {
        continue;
      }
      if (entry.name === 'node_modules') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        dirs.push(entry.name);
        continue;
      }

      // 处理符号链接
      if (entry.isSymbolicLink()) {
        try {
          if (fs.statSync(fullPath).isDirectory()) {
            dirs.push(entry.name);
          }
        } catch {
          // 忽略损坏的符号链接
        }
      }
    }

    return dirs;
  } catch {
    return [];
  }
}

/**
 * 尝试获取真实路径
 *
 * @param filePath - 文件路径
 * @returns 真实路径或 null
 */
function tryRealpath(filePath: string): string | null {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return null;
  }
}

/**
 * 从目录加载技能
 *
 *从指定的目录加载技能
 *
 * @param dir - 技能目录路径
 * @param source - 技能来源标识
 * @param limits - 技能限制
 * @returns 加载的技能列表
 */
function loadSkillsFromDir(
  dir: string,
  source: string,
  limits: Required<SkillLimits>
): Skill[] {
  const rootDir = path.resolve(dir);
  const rootRealPath = tryRealpath(rootDir) ?? rootDir;

  // 检查目录是否存在
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  // 检查根目录本身是否是技能目录
  const rootSkillMd = path.join(rootDir, 'SKILL.md');
  if (fs.existsSync(rootSkillMd)) {
    try {
      // 检查文件大小
      const size = fs.statSync(rootSkillMd).size;
      if (size > limits.maxSkillFileBytes) {
        console.warn(
          `[Skills] Skipping oversized SKILL.md: ${rootSkillMd} (${size} > ${limits.maxSkillFileBytes})`
        );
        return [];
      }

      // 读取并解析技能
      const content = fs.readFileSync(rootSkillMd, 'utf-8');
      const { name, description } = parseSkillFormat(content);

      return [
        {
          name,
          description,
          baseDir: rootRealPath,
          filePath: rootSkillMd,
          source,
        },
      ];
    } catch (error) {
      console.error(`[Skills] Failed to load skill from ${rootDir}:`, error);
      return [];
    }
  }

  // 加载子目录中的技能
  const childDirs = listChildDirectories(rootDir);
  const maxCandidates = limits.maxSkillsLoadedPerSource;
  const limitedChildren = childDirs.slice().sort().slice(0, maxCandidates);

  const skills: Skill[] = [];

  for (const name of limitedChildren) {
    const skillDir = path.join(rootDir, name);
    const skillMd = path.join(skillDir, 'SKILL.md');

    if (!fs.existsSync(skillMd)) {
      continue;
    }

    try {
      // 检查文件大小
      const size = fs.statSync(skillMd).size;
      if (size > limits.maxSkillFileBytes) {
        console.warn(
          `[Skills] Skipping oversized SKILL.md: ${skillMd} (${size} > ${limits.maxSkillFileBytes})`
        );
        continue;
      }

      // 读取并解析技能
      const content = fs.readFileSync(skillMd, 'utf-8');
      const { name: skillName, description } = parseSkillFormat(content);

      skills.push({
        name: skillName,
        description,
        baseDir: skillDir,
        filePath: skillMd,
        source,
      });

      // 检查是否达到限制
      if (skills.length >= maxCandidates) {
        break;
      }
    } catch (error) {
      console.error(`[Skills] Failed to load skill from ${skillDir}:`, error);
    }
  }

  return skills;
}

/**
 * 解析技能元数据
 *
 * 从 SKILL.md 内容中提取名称和描述
 *
 * @param content - SKILL.md 内容
 * @returns 技能元数据
 */
function parseSkillFormat(content: string): { name: string; description: string } {
  // 尝试从前置元数据中获取
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const frontmatterMatch = content.match(frontmatterRegex);

  let name = '';
  let description = '';

  if (frontmatterMatch) {
    const frontmatterContent = frontmatterMatch[1];
    const lines = frontmatterContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed
        .slice(colonIndex + 1)
        .trim()
        .replace(/^["']|["']$/g, '');

      if (key === 'name' && !name) {
        name = value;
      } else if (key === 'description' && !description) {
        description = value;
      }
    }
  }

  // 如果没有从前置元数据获取到，尝试从正文获取
  if (!name || !description) {
    const bodyContent = frontmatterMatch
      ? content.slice(frontmatterMatch[0].length)
      : content;
    const lines = bodyContent.split('\n').filter(l => l.trim());

    if (!name && lines.length > 0) {
      // 第一行可能是标题
      const firstLine = lines[0].trim();
      if (firstLine.startsWith('#')) {
        name = firstLine.replace(/^#+\s*/, '');
      } else {
        name = firstLine;
      }
    }

    if (!description && lines.length > 1) {
      // 第二行可能是描述
      description = lines[1].trim();
    }
  }

  return {
    name: name || 'unknown',
    description: description || 'No description',
  };
}

/**
 * 过滤技能条目
 *
 * @param entries - 技能条目列表
 * @param config - 配置对象
 * @param eligibility - 就绪性上下文
 * @returns 过滤后的技能条目列表
 */
function filterSkillEntries(
  entries: SkillEntry[],
  config?: unknown,
  eligibility?: SkillEligibilityContext
): SkillEntry[] {
  return entries.filter(entry =>
    shouldIncludeSkill({
      entry,
      config: config as any,
      eligibility,
    })
  );
}

/**
 * 应用技能提示词限制
 *
 * @param skills - 技能列表
 * @param limits - 技能限制
 * @returns 限制后的技能列表和是否被截断
 */
function applySkillsPromptLimits(params: {
  skills: Skill[];
  limits: Required<SkillLimits>;
}): {
  skillsForPrompt: Skill[];
  truncated: boolean;
  truncatedReason: 'count' | 'chars' | null;
} {
  const { skills, limits } = params;
  const total = skills.length;

  // 先按数量限制
  let skillsForPrompt = skills.slice(0, limits.maxSkillsInPrompt);
  let truncated = total > skillsForPrompt.length;
  let truncatedReason: 'count' | 'chars' | null = truncated ? 'count' : null;

  // 检查字符限制 (使用二分查找)
  const fits = (skillList: Skill[]): boolean => {
    const block = formatSkillsForPrompt(skillList);
    return block.length <= limits.maxSkillsPromptChars;
  };

  if (!fits(skillsForPrompt)) {
    let lo = 0;
    let hi = skillsForPrompt.length;

    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(skillsForPrompt.slice(0, mid))) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    skillsForPrompt = skillsForPrompt.slice(0, lo);
    truncated = true;
    truncatedReason = 'chars';
  }

  return { skillsForPrompt, truncated, truncatedReason };
}

/**
 * 格式化技能为提示词
 *
 * @param skills - 技能列表
 * @returns 格式化的提示词
 */
function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) {
    return '';
  }

  const blocks: string[] = [];

  for (const skill of skills) {
    const emoji = skill.name.includes('github') ? '🐙' :
                  skill.name.includes('git') ? '📝' :
                  skill.name.includes('code') ? '💻' :
                  '🔧';

    const line = `${emoji} /${skill.name} - ${skill.description}`;
    blocks.push(line);
  }

  return `## Available Skills\n\n${blocks.join('\n')}`;
}

/**
 * 加载工作区技能条目
 *
 * 从工作区加载所有技能条目
 *
 * @param workspaceDir - 工作区目录
 * @param config - 配置对象
 * @returns 加载的技能条目列表
 */
export function loadWorkspaceSkillEntries(
  workspaceDir: string,
  config?: unknown
): SkillEntry[] {
  const limits = resolveSkillLimits(config);

  // 定义技能加载源
  const sources = [
    { dir: path.join(workspaceDir, 'skills'), source: 'workspace' },
    { dir: path.join(workspaceDir, '.agents', 'skills'), source: 'agents-project' },
    { dir: path.join(os.homedir(), '.agents', 'skills'), source: 'agents-personal' },
  ];

  // 加载所有技能
  const allSkills: Skill[] = [];

  for (const src of sources) {
    try {
      const skills = loadSkillsFromDir(src.dir, src.source, limits);
      allSkills.push(...skills);
    } catch (error) {
      console.warn(`[Skills] Failed to load skills from ${src.dir}:`, error);
    }
  }

  // 使用 Map 合并同名技能 (后面的覆盖前面的)
  const merged = new Map<string, Skill>();

  for (const skill of allSkills) {
    merged.set(skill.name, skill);
  }

  // 转换为技能条目
  const entries: SkillEntry[] = [];

  for (const skill of merged.values()) {
    try {
      const content = fs.readFileSync(skill.filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      entries.push({
        skill,
        frontmatter,
        metadata: resolveOpenClawMetadata(frontmatter),
        invocation: resolveSkillInvocationPolicy(frontmatter),
      });
    } catch (error) {
      console.warn(`[Skills] Failed to parse skill ${skill.name}:`, error);
    }
  }

  return entries;
}

/**
 * 构建工作区技能快照
 *
 * @param workspaceDir - 工作区目录
 * @param options - 构建选项
 * @returns 技能快照
 */
export function buildWorkspaceSkillSnapshot(
  workspaceDir: string,
  options?: SkillBuildOptions & { snapshotVersion?: number }
): SkillSnapshot {
  const entries = options?.entries || loadWorkspaceSkillEntries(workspaceDir, options?.config);
  const eligible = filterSkillEntries(entries, options?.config, options?.eligibility);

  // 应用技能过滤器
  let filtered = eligible;
  const skillFilter = normalizeSkillFilter(options?.skillFilter);

  if (skillFilter && skillFilter.length > 0) {
    filtered = eligible.filter(entry => skillFilter!.includes(entry.skill.name));
  }

  // 过滤禁用模型调用的技能
  const promptEntries = filtered.filter(
    entry => entry.invocation?.disableModelInvocation !== true
  );

  const resolvedSkills = promptEntries.map(entry => entry.skill);

  // 应用提示词限制
  const { skillsForPrompt } = applySkillsPromptLimits({
    skills: resolvedSkills,
    limits: resolveSkillLimits(options?.config),
  });

  // 生成提示词
  const prompt = formatSkillsForPrompt(compactSkillPaths(skillsForPrompt));

  return {
    prompt,
    skills: eligible.map(entry => ({
      name: entry.skill.name,
      primaryEnv: entry.metadata?.primaryEnv,
      requiredEnv: entry.metadata?.requires?.env?.slice(),
    })),
    skillFilter,
    resolvedSkills: skillsForPrompt,
    version: options?.snapshotVersion,
  };
}

/**
 * 构建工作区技能提示词
 *
 * @param workspaceDir - 工作区目录
 * @param options - 构建选项
 * @returns 技能提示词
 */
export function buildWorkspaceSkillsPrompt(
  workspaceDir: string,
  options?: SkillBuildOptions
): string {
  const snapshot = buildWorkspaceSkillSnapshot(workspaceDir, options);
  return snapshot.prompt;
}

/**
 * 过滤工作区技能条目
 *
 * @param entries - 技能条目列表
 * @param config - 配置对象
 * @returns 过滤后的技能条目列表
 */
export function filterWorkspaceSkillEntries(
  entries: SkillEntry[],
  config?: unknown
): SkillEntry[] {
  return filterSkillEntries(entries, config);
}

/**
 * 规范化技能命令名称
 *
 * @param raw - 原始名称
 * @returns 规范化的名称
 */
function sanitizeSkillCommandName(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized.slice(0, SKILL_COMMAND_MAX_LENGTH) || SKILL_COMMAND_FALLBACK;
}

/**
 * 解析唯一的技能命令名称
 *
 * @param base - 基础名称
 * @param used - 已使用的名称集合
 * @returns 唯一的命令名称
 */
function resolveUniqueSkillCommandName(base: string, used: Set<string>): string {
  const normalizedBase = base.toLowerCase();

  if (!used.has(normalizedBase)) {
    return base;
  }

  // 尝试添加数字后缀
  for (let index = 2; index < 1000; index += 1) {
    const suffix = `_${index}`;
    const maxBaseLength = Math.max(1, SKILL_COMMAND_MAX_LENGTH - suffix.length);
    const trimmedBase = base.slice(0, maxBaseLength);
    const candidate = `${trimmedBase}${suffix}`;
    const candidateKey = candidate.toLowerCase();

    if (!used.has(candidateKey)) {
      return candidate;
    }
  }

  // 后备方案
  const fallback = `${base.slice(0, Math.max(1, SKILL_COMMAND_MAX_LENGTH - 2))}_x`;
  return fallback;
}

/**
 * 构建工作区技能命令规范
 *
 * @param workspaceDir - 工作区目录
 * @param options - 构建选项
 * @returns 技能命令规范列表
 */
export function buildWorkspaceSkillCommandSpecs(
  workspaceDir: string,
  options?: SkillBuildOptions & { reservedNames?: Set<string> }
): SkillCommandSpec[] {
  const entries = options?.entries || loadWorkspaceSkillEntries(workspaceDir, options?.config);
  const eligible = filterSkillEntries(entries, options?.config, options?.eligibility);

  // 只包含用户可调用的技能
  const userInvocable = eligible.filter(
    entry => entry.invocation?.userInvocable !== false
  );

  const used = new Set<string>();

  // 添加保留名称
  for (const reserved of options?.reservedNames ?? []) {
    used.add(reserved.toLowerCase());
  }

  const specs: SkillCommandSpec[] = [];

  for (const entry of userInvocable) {
    const rawName = entry.skill.name;
    const base = sanitizeSkillCommandName(rawName);
    const unique = resolveUniqueSkillCommandName(base, used);

    used.add(unique.toLowerCase());

    // 截断描述
    const rawDescription = entry.skill.description?.trim() || rawName;
    const description =
      rawDescription.length > SKILL_COMMAND_DESCRIPTION_MAX_LENGTH
        ? rawDescription.slice(0, SKILL_COMMAND_DESCRIPTION_MAX_LENGTH - 1) + '…'
        : rawDescription;

    specs.push({
      name: unique,
      skillName: rawName,
      description,
    });
  }

  return specs;
}

/**
 * 解析技能提示词 (用于运行时)
 *
 * @param params - 解析参数
 * @returns 提示词字符串
 */
export function resolveSkillsPromptForRun(params: {
  skillsSnapshot?: SkillSnapshot;
  entries?: SkillEntry[];
  config?: unknown;
  workspaceDir: string;
}): string {
  // 如果有快照，直接使用
  if (params.skillsSnapshot?.prompt?.trim()) {
    return params.skillsSnapshot.prompt;
  }

  // 如果有技能条目，构建提示词
  if (params.entries && params.entries.length > 0) {
    const prompt = buildWorkspaceSkillsPrompt(params.workspaceDir, {
      entries: params.entries,
      config: params.config,
    });
    return prompt.trim() || '';
  }

  return '';
}

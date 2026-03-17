/**
 * OpenClaw Agent Skills - 前置元数据解析
 *
 * 【功能说明】
 * 解析 SKILL.md 文件顶部的 YAML 前置元数据块，提取技能的元数据信息。
 *
 * 【格式示例】
 * ```yaml
 * ---
 * name: my-skill
 * description: My skill description
 * user-invocable: true
 * disable-model-invocation: false
 * emoji: 🎯
 * homepage: https://example.com
 * skillKey: my-skill
 * primaryEnv: API_KEY
 * os: [darwin, linux]
 * requires:
 *   bins: [git, node]
 *   env: [API_KEY]
 * install:
 *   - kind: brew
 *     formula: my-tool
 * ---
 * ```
 */

import type {
  OpenClawSkillMetadata,
  ParsedSkillFrontmatter,
  SkillInstallSpec,
  SkillInvocationPolicy,
} from './types.js';

// 正则表达式用于验证各种格式
const BREW_FORMULA_PATTERN = /^[A-Za-z0-9][A-Za-z0-9@+._/-]*$/;
const GO_MODULE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~+\-/]*(?:@[A-Za-z0-9][A-Za-z0-9._~+\-/]*)?$/;
const UV_PACKAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-[\]=<>!~+,]*$/;
const URL_PATTERN = /^https?:\/\/[^\s<>"{}|\\^`[\]]+$/;
const NPM_PACKAGE_PATTERN = /^(?:@[a-z0-9-]+[\/])?[a-z0-9-]+(?:@[^s<>"{}|\\^`[\]]+)?$/i;

/**
 * 解析前置元数据块
 *
 * 从 SKILL.md 文件内容中提取 YAML 前置元数据块
 *
 * @param content - SKILL.md 文件内容
 * @returns 解析的前置元数据对象
 */
export function parseFrontmatter(content: string): ParsedSkillFrontmatter {
  const result: ParsedSkillFrontmatter = {};

  // 匹配 YAML 前置元数据块
  // 格式: ---\nkey: value\n...\n---
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return result;
  }

  const frontmatterContent = match[1];
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
    const value = trimmed.slice(colonIndex + 1).trim();

    // 移除可能的引号
    result[key] = value.replace(/^["']|["']$/g, '');
  }

  return result;
}

/**
 * 解析布尔值
 *
 * @param value - 字符串值
 * @param defaultValue - 默认值
 * @returns 解析的布尔值
 */
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === '1') {
    return true;
  }
  if (lower === 'false' || lower === 'no' || lower === '0') {
    return false;
  }
  return defaultValue;
}

/**
 * 解析字符串列表
 *
 * @param value - 字符串值 (可能是逗号分隔或 YAML 数组格式)
 * @returns 解析的字符串数组
 */
function parseStringList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  // 尝试解析 YAML 数组格式: [item1, item2, item3]
  const arrayMatch = value.match(/^\[(.*)\]$/);
  if (arrayMatch) {
    const items = arrayMatch[1].split(',').map(item => item.trim()).filter(Boolean);
    return items;
  }

  // 否则按逗号分隔
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * 规范化 Homebrew formula
 *
 * @param raw - 原始值
 * @returns 规范化的 formula 或 undefined
 */
function normalizeBrewFormula(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const formula = raw.trim();
  if (!formula || formula.startsWith('-') || formula.includes('\\') || formula.includes('..')) {
    return undefined;
  }
  if (!BREW_FORMULA_PATTERN.test(formula)) {
    return undefined;
  }
  return formula;
}

/**
 * 规范化 npm 包规范
 *
 * @param raw - 原始值
 * @returns 规范化的包名或 undefined
 */
function normalizeNpmPackage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const pkg = raw.trim();
  if (!pkg || pkg.startsWith('-')) {
    return undefined;
  }
  if (!NPM_PACKAGE_PATTERN.test(pkg)) {
    return undefined;
  }
  return pkg;
}

/**
 * 规范化 Go 模块
 *
 * @param raw - 原始值
 * @returns 规范化的模块路径或 undefined
 */
function normalizeGoModule(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const module = raw.trim();
  if (
    !module ||
    module.startsWith('-') ||
    module.includes('\\') ||
    module.includes('://')
  ) {
    return undefined;
  }
  if (!GO_MODULE_PATTERN.test(module)) {
    return undefined;
  }
  return module;
}

/**
 * 规范化 uv 包
 *
 * @param raw - 原始值
 * @returns 规范化的包名或 undefined
 */
function normalizeUvPackage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const pkg = raw.trim();
  if (!pkg || pkg.startsWith('-') || pkg.includes('\\') || pkg.includes('://')) {
    return undefined;
  }
  if (!UV_PACKAGE_PATTERN.test(pkg)) {
    return undefined;
  }
  return pkg;
}

/**
 * 规范化下载 URL
 *
 * @param raw - 原始值
 * @returns 规范化的 URL 或 undefined
 */
function normalizeDownloadUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const url = raw.trim();
  if (!url) {
    return undefined;
  }
  if (!URL_PATTERN.test(url)) {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * 解析安装规范
 *
 * @param input - 原始输入
 * @returns 解析的安装规范或 undefined
 */
function parseInstallSpec(input: unknown): SkillInstallSpec | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const obj = input as Record<string, unknown>;
  const kind = obj.kind;

  if (typeof kind !== 'string') {
    return undefined;
  }

  const validKinds = ['brew', 'node', 'go', 'uv', 'download'];
  if (!validKinds.includes(kind)) {
    return undefined;
  }

  const spec: SkillInstallSpec = {
    kind: kind as SkillInstallSpec['kind'],
  };

  // 解析通用字段
  if (typeof obj.id === 'string' && obj.id.trim()) {
    spec.id = obj.id.trim();
  }
  if (typeof obj.label === 'string' && obj.label.trim()) {
    spec.label = obj.label.trim();
  }
  if (Array.isArray(obj.bins)) {
    spec.bins = obj.bins.filter(b => typeof b === 'string' && b.trim()).map(b => b.trim());
  }
  if (Array.isArray(obj.os)) {
    spec.os = obj.os.filter(o => typeof o === 'string' && o.trim()).map(o => o.trim());
  }

  // 解析类型特定字段
  if (spec.kind) {
    switch (spec.kind) {
      case 'brew': {
        spec.formula = normalizeBrewFormula(obj.formula);
        if (!spec.formula) {
          return undefined;
        }
        break;
      }
      case 'node': {
        spec.package = normalizeNpmPackage(obj.package);
        if (!spec.package) {
          return undefined;
        }
        break;
      }
      case 'go': {
        spec.module = normalizeGoModule(obj.module);
        if (!spec.module) {
          return undefined;
        }
        break;
      }
      case 'uv': {
        spec.package = normalizeUvPackage(obj.package);
        if (!spec.package) {
          return undefined;
        }
        break;
      }
      case 'download': {
        spec.url = normalizeDownloadUrl(obj.url);
        if (!spec.url) {
          return undefined;
        }
        break;
      }
    }
  }

  // 解析其他可选字段
  if (typeof obj.archive === 'string') {
    spec.archive = obj.archive;
  }
  if (typeof obj.extract === 'boolean') {
    spec.extract = obj.extract;
  }
  if (typeof obj.stripComponents === 'number' && obj.stripComponents >= 0) {
    spec.stripComponents = obj.stripComponents;
  }
  if (typeof obj.targetDir === 'string' && obj.targetDir.trim()) {
    spec.targetDir = obj.targetDir.trim();
  }

  return spec;
}

/**
 * 解析依赖要求
 *
 * @param obj - 前置元数据对象
 * @returns 依赖要求对象
 */
function parseRequires(obj: Record<string, unknown>): OpenClawSkillMetadata['requires'] {
  const requiresRaw = obj.requires;
  if (!requiresRaw || typeof requiresRaw !== 'object') {
    return undefined;
  }

  const requiresObj = requiresRaw as Record<string, unknown>;
  const requires: OpenClawSkillMetadata['requires'] = {};

  if (Array.isArray(requiresObj.bins)) {
    requires.bins = requiresObj.bins
      .filter(b => typeof b === 'string' && b.trim())
      .map(b => b.trim());
  }

  if (Array.isArray(requiresObj.anyBins)) {
    requires.anyBins = requiresObj.anyBins
      .filter(b => typeof b === 'string' && b.trim())
      .map(b => b.trim());
  }

  if (Array.isArray(requiresObj.env)) {
    requires.env = requiresObj.env
      .filter(e => typeof e === 'string' && e.trim())
      .map(e => e.trim());
  }

  if (Array.isArray(requiresObj.config)) {
    requires.config = requiresObj.config
      .filter(c => typeof c === 'string' && c.trim())
      .map(c => c.trim());
  }

  if (Object.keys(requires).length === 0) {
    return undefined;
  }

  return requires;
}

/**
 * 解析 OpenClaw 技能元数据
 *
 * @param frontmatter - 解析的前置元数据
 * @returns OpenClaw 技能元数据
 */
export function resolveOpenClawMetadata(
  frontmatter: ParsedSkillFrontmatter
): OpenClawSkillMetadata | undefined {
  let hasMetadata = false;
  const metadata: OpenClawSkillMetadata = {};

  // 解析基础字段
  if (frontmatter['always']) {
    metadata.always = parseBool(frontmatter['always'], false);
    hasMetadata = true;
  }

  if (frontmatter['skillKey']?.trim()) {
    metadata.skillKey = frontmatter['skillKey'].trim();
    hasMetadata = true;
  }

  if (frontmatter['primaryEnv']?.trim()) {
    metadata.primaryEnv = frontmatter['primaryEnv'].trim();
    hasMetadata = true;
  }

  if (frontmatter['emoji']?.trim()) {
    metadata.emoji = frontmatter['emoji'].trim();
    hasMetadata = true;
  }

  if (frontmatter['homepage']?.trim()) {
    const url = normalizeDownloadUrl(frontmatter['homepage']);
    if (url) {
      metadata.homepage = url;
      hasMetadata = true;
    }
  }

  // 解析 OS 列表
  const osList = parseStringList(frontmatter['os']);
  if (osList.length > 0) {
    metadata.os = osList;
    hasMetadata = true;
  }

  // 解析依赖要求
  const requires = parseRequires(frontmatter);
  if (requires) {
    metadata.requires = requires;
    hasMetadata = true;
  }

  // 解析安装规范 (简化版本，实际应该支持多个)
  // 这里只是示例，完整实现需要更复杂的 YAML 解析
  if (frontmatter['install']) {
    const installRaw = frontmatter['install'];
    if (typeof installRaw === 'string') {
      // 简单的安装类型声明
      const kind = installRaw.trim();
      if (['brew', 'node', 'go', 'uv', 'download'].includes(kind)) {
        const spec: SkillInstallSpec = { kind: kind as SkillInstallSpec['kind'] };
        metadata.install = [spec];
        hasMetadata = true;
      }
    }
  }

  return hasMetadata ? metadata : undefined;
}

/**
 * 解析技能调用策略
 *
 * @param frontmatter - 解析的前置元数据
 * @returns 技能调用策略
 */
export function resolveSkillInvocationPolicy(
  frontmatter: ParsedSkillFrontmatter
): SkillInvocationPolicy {
  return {
    userInvocable: parseBool(frontmatter['user-invocable'], true),
    disableModelInvocation: parseBool(frontmatter['disable-model-invocation'], false),
  };
}

/**
 * 解析技能键
 *
 * @param skill - 技能定义
 * @param entry - 技能条目 (可选)
 * @returns 技能键
 */
export function resolveSkillKey(
  skill: { name: string },
  entry?: { metadata?: OpenClawSkillMetadata }
): string {
  return entry?.metadata?.skillKey ?? skill.name;
}

/**
 * OpenClaw Agent Skills - 技能过滤
 *
 * 【功能说明】
 * 提供技能过滤功能，支持基于名称、配置、标签等多种条件过滤技能。
 *
 * 【核心功能】
 * 1. 规范化技能过滤器
 * 2. 比较技能过滤器
 * 3. 匹配技能名称
 */

/**
 * 规范化字符串条目
 *
 * 将输入转换为规范化的字符串数组
 *
 * @param input - 原始输入
 * @returns 规范化的字符串数组
 */
function normalizeStringEntries(input: unknown): string[] {
  if (!input) {
    return [];
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return [];
    }
    // 按逗号分隔
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }

  if (Array.isArray(input)) {
    return input
      .filter(item => typeof item === 'string' && item.trim())
      .map(item => item.trim());
  }

  return [];
}

/**
 * 规范化技能过滤器
 *
 * 将各种格式的输入转换为规范化的技能名称数组
 *
 * @param skillFilter - 技能过滤器 (可能是字符串、数组或 undefined)
 * @returns 规范化的技能名称数组或 undefined
 */
export function normalizeSkillFilter(
  skillFilter?: ReadonlyArray<unknown>
): string[] | undefined {
  if (skillFilter === undefined) {
    return undefined;
  }

  const normalized = normalizeStringEntries(skillFilter);
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * 规范化技能过滤器用于比较
 *
 * 返回排序和去重的过滤器，便于比较
 *
 * @param skillFilter - 技能过滤器
 * @returns 规范化的技能名称数组或 undefined
 */
export function normalizeSkillFilterForComparison(
  skillFilter?: ReadonlyArray<unknown>
): string[] | undefined {
  const normalized = normalizeSkillFilter(skillFilter);
  if (normalized === undefined) {
    return undefined;
  }

  // 去重并排序
  return Array.from(new Set(normalized)).sort();
}

/**
 * 比较两个技能过滤器是否匹配
 *
 * @param cached - 缓存的过滤器
 * @param next - 新的过滤器
 * @returns 是否匹配
 */
export function matchesSkillFilter(
  cached?: ReadonlyArray<unknown>,
  next?: ReadonlyArray<unknown>
): boolean {
  const cachedNormalized = normalizeSkillFilterForComparison(cached);
  const nextNormalized = normalizeSkillFilterForComparison(next);

  // 两者都为 undefined，视为匹配
  if (cachedNormalized === undefined && nextNormalized === undefined) {
    return true;
  }

  // 一个为 undefined，另一个不是，不匹配
  if (cachedNormalized === undefined || nextNormalized === undefined) {
    return false;
  }

  // 长度不同，不匹配
  if (cachedNormalized.length !== nextNormalized.length) {
    return false;
  }

  // 逐个比较
  return cachedNormalized.every((entry, index) => entry === nextNormalized[index]);
}

/**
 * 技能匹配器
 *
 * 用于检查技能是否匹配给定的过滤器
 */
export class SkillMatcher {
  private includePatterns: RegExp[] = [];
  private excludePatterns: RegExp[] = [];

  /**
   * 构造函数
   *
   * @param filter - 过滤器字符串或数组
   */
  constructor(filter?: string | string[]) {
    if (!filter) {
      return;
    }

    const patterns = Array.isArray(filter) ? filter : [filter];

    for (const pattern of patterns) {
      const trimmed = pattern.trim();
      if (!trimmed) {
        continue;
      }

      // 检查是否为排除模式 (以 ! 开头)
      if (trimmed.startsWith('!')) {
        const excludePattern = trimmed.slice(1);
        this.excludePatterns.push(this.createPattern(excludePattern));
      } else {
        this.includePatterns.push(this.createPattern(trimmed));
      }
    }

    // 如果没有包含模式，默认包含所有
    if (this.includePatterns.length === 0) {
      this.includePatterns.push(/.*/);
    }
  }

  /**
   * 创建正则表达式模式
   *
   * @param pattern - 模式字符串
   * @returns 正则表达式
   */
  private createPattern(pattern: string): RegExp {
    // 支持通配符 * 和 ?
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义正则特殊字符
      .replace(/\*/g, '.*') // * 匹配任意字符
      .replace(/\?/g, '.'); // ? 匹配单个字符

    try {
      return new RegExp(`^${escaped}$`, 'i');
    } catch (error) {
      // 如果正则表达式无效，返回一个不匹配任何内容的模式
      console.warn(`Invalid skill filter pattern: ${pattern}`);
      return /^(?!)/;
    }
  }

  /**
   * 检查技能名称是否匹配
   *
   * @param skillName - 技能名称
   * @returns 是否匹配
   */
  matches(skillName: string): boolean {
    // 检查是否被排除
    for (const excludePattern of this.excludePatterns) {
      if (excludePattern.test(skillName)) {
        return false;
      }
    }

    // 检查是否包含
    for (const includePattern of this.includePatterns) {
      if (includePattern.test(skillName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 过滤技能名称列表
   *
   * @param skillNames - 技能名称列表
   * @returns 过滤后的列表
   */
  filter(skillNames: string[]): string[] {
    return skillNames.filter(name => this.matches(name));
  }
}

/**
 * 技能标签匹配器
 *
 * 基于技能标签过滤技能
 */
export class SkillTagMatcher {
  private requiredTags: Set<string> = new Set();
  private excludedTags: Set<string> = new Set();

  /**
   * 构造函数
   *
   * @param tags - 标签配置
   */
  constructor(tags?: {
    /** 必需的标签 */
    require?: string | string[];
    /** 排除的标签 */
    exclude?: string | string[];
  }) {
    if (tags?.require) {
      const requireTags = Array.isArray(tags.require) ? tags.require : [tags.require];
      for (const tag of requireTags) {
        const trimmed = tag.trim();
        if (trimmed) {
          this.requiredTags.add(trimmed);
        }
      }
    }

    if (tags?.exclude) {
      const excludeTags = Array.isArray(tags.exclude) ? tags.exclude : [tags.exclude];
      for (const tag of excludeTags) {
        const trimmed = tag.trim();
        if (trimmed) {
          this.excludedTags.add(trimmed);
        }
      }
    }
  }

  /**
   * 检查技能标签是否匹配
   *
   * @param skillTags - 技能标签列表
   * @returns 是否匹配
   */
  matches(skillTags?: string[]): boolean {
    if (!skillTags || skillTags.length === 0) {
      return this.requiredTags.size === 0;
    }

    const tagSet = new Set(skillTags);

    // 检查是否包含所有必需的标签
    for (const requiredTag of this.requiredTags) {
      if (!tagSet.has(requiredTag)) {
        return false;
      }
    }

    // 检查是否包含任何排除的标签
    for (const excludedTag of this.excludedTags) {
      if (tagSet.has(excludedTag)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 从前置元数据中提取标签
   *
   * @param frontmatter - 前置元数据
   * @returns 标签列表
   */
  static extractTags(frontmatter?: Record<string, string>): string[] | undefined {
    const tagsRaw = frontmatter?.['tags'];
    if (!tagsRaw) {
      return undefined;
    }

    const tags = normalizeStringEntries(tagsRaw);
    return tags.length > 0 ? tags : undefined;
  }
}

/**
 * 创建组合技能过滤函数
 *
 * 支持多种过滤条件的组合
 *
 * @param filters - 过滤条件
 * @returns 过滤函数
 */
export function createSkillFilter(filters: {
  /** 名称过滤 */
  nameFilter?: string | string[];
  /** 标签过滤 */
  tagFilter?: {
    require?: string | string[];
    exclude?: string | string[];
  };
  /** 自定义过滤函数 */
  customFilter?: (skillName: string) => boolean;
}): (skillName: string, skillTags?: string[]) => boolean {
  const nameMatcher = filters.nameFilter
    ? new SkillMatcher(filters.nameFilter)
    : null;
  const tagMatcher = filters.tagFilter
    ? new SkillTagMatcher(filters.tagFilter)
    : null;

  return (skillName: string, skillTags?: string[]) => {
    // 名称过滤
    if (nameMatcher && !nameMatcher.matches(skillName)) {
      return false;
    }

    // 标签过滤
    if (tagMatcher && !tagMatcher.matches(skillTags)) {
      return false;
    }

    // 自定义过滤
    if (filters.customFilter && !filters.customFilter(skillName)) {
      return false;
    }

    return true;
  };
}

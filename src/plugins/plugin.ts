/**
 * OpenClaw Plugins 插件系统 - 简化学习版
 *
 * 【核心概念】
 * 插件系统允许动态扩展 OpenClaw 的功能：
 * 1. 插件发现和加载
 * 2. 插件生命周期管理
 * 3. 钩子系统
 * 4. 插件依赖解析
 * 5. 插件隔离
 *
 * 插件生命周期:
 * init -> enable -> [active] -> disable -> destroy
 *
 *   ┌─────────────┐
 *   │  Plugin     │
 *   │  Loader     │  加载和初始化插件
 *   └──────┬──────┘
 *          │
 *   ┌──────▼──────┐
 *   │  Hook       │  生命周期钩子
 *   │  Manager    │
 *   └──────┬──────┘
 *          │
 *   ┌──────▼──────┐
 *   │  Plugin     │  已加载的插件
 *   │  Registry   │
 *   └─────────────┘
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Plugin, PluginConfig, PluginHook, HookContext } from './types.js';

/**
 * 插件加载器
 */
export class PluginLoader {
  private pluginDirs: string[] = [];
  private loadedPlugins: Map<string, Plugin> = new Map();

  constructor(pluginDirs: string[] = []) {
    this.pluginDirs = pluginDirs;
  }

  /**
   * 添加插件目录
   */
  addPluginDir(dir: string): void {
    this.pluginDirs.push(dir);
  }

  /**
   * 发现插件
   */
  async discoverPlugins(): Promise<string[]> {
    const pluginPaths: string[] = [];

    for (const dir of this.pluginDirs) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pluginPath = path.join(dir, entry.name);
            const configPath = path.join(pluginPath, 'plugin.json');

            // 检查是否是有效的插件目录
            try {
              await fs.access(configPath);
              pluginPaths.push(pluginPath);
            } catch {
              continue;
            }
          }
        }
      } catch {
        continue;
      }
    }

    console.log(`[PluginLoader] 发现 ${pluginPaths.length} 个插件`);
    return pluginPaths;
  }

  /**
   * 加载插件
   */
  async loadPlugin(pluginPath: string): Promise<Plugin> {
    console.log(`[PluginLoader] 加载插件: ${pluginPath}`);

    // 读取插件配置
    const configPath = path.join(pluginPath, 'plugin.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config: PluginConfig = JSON.parse(configContent);

    // 创建插件实例
    const plugin: Plugin = {
      id: config.id,
      name: config.name || config.id,
      version: config.version || '1.0.0',
      description: config.description || '',
      path: pluginPath,
      config,
      enabled: false,
      hooks: new Map(),
    };

    // 模拟加载插件代码
    // 在真实项目中，这里会动态 require 或 import 插件模块
    console.log(`[PluginLoader] 插件已加载: ${plugin.id}`);

    return plugin;
  }

  /**
   * 初始化插件
   */
  async initializePlugin(plugin: Plugin, context: HookContext): Promise<void> {
    console.log(`[PluginLoader] 初始化插件: ${plugin.id}`);

    // 调用插件的生命周期方法
    if (plugin.hooks.has('init')) {
      const initHook = plugin.hooks.get('init')!;
      await initHook(context);
    }

    console.log(`[PluginLoader] 插件已初始化: ${plugin.id}`);
  }

  /**
   * 启用插件
   */
  async enablePlugin(plugin: Plugin, context: HookContext): Promise<void> {
    console.log(`[PluginLoader] 启用插件: ${plugin.id}`);

    if (plugin.hooks.has('enable')) {
      const enableHook = plugin.hooks.get('enable')!;
      await enableHook(context);
    }

    plugin.enabled = true;
    this.loadedPlugins.set(plugin.id, plugin);

    console.log(`[PluginLoader] 插件已启用: ${plugin.id}`);
  }

  /**
   * 禁用插件
   */
  async disablePlugin(plugin: Plugin, context: HookContext): Promise<void> {
    console.log(`[PluginLoader] 禁用插件: ${plugin.id}`);

    if (plugin.hooks.has('disable')) {
      const disableHook = plugin.hooks.get('disable')!;
      await disableHook(context);
    }

    plugin.enabled = false;
    this.loadedPlugins.delete(plugin.id);

    console.log(`[PluginLoader] 插件已禁用: ${plugin.id}`);
  }

  /**
   * 获取已加载的插件
   */
  getLoadedPlugins(): Plugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * 获取插件
   */
  getPlugin(id: string): Plugin | undefined {
    return this.loadedPlugins.get(id);
  }
}

/**
 * 钩子管理器
 *
 * 钩子类型:
 * - 生命周期钩子: init, enable, disable, destroy
 * - 消息钩子: before-message, after-message
 * - 命令钩子: before-command, after-command
 */
export class HookManager {
  private hooks: Map<string, PluginHook[]> = new Map();

  /**
   * 注册钩子
   */
  registerHook(hookName: string, hook: PluginHook): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    this.hooks.get(hookName)!.push(hook);
    console.log(`[HookManager] 已注册钩子: ${hookName}`);
  }

  /**
   * 执行钩子
   */
  async executeHook(hookName: string, context: HookContext): Promise<void> {
    const hooks = this.hooks.get(hookName);

    if (!hooks || hooks.length === 0) {
      return;
    }

    console.log(`[HookManager] 执行钩子: ${hookName} (${hooks.length} 个监听器)`);

    for (const hook of hooks) {
      try {
        await hook(context);
      } catch (error) {
        console.error(`[HookManager] 钩子执行失败: ${hookName}`, error);
      }
    }
  }

  /**
   * 执行钩子并返回结果
   */
  async executeHookWithResult<T>(hookName: string, context: HookContext): Promise<T[]> {
    const hooks = this.hooks.get(hookName);

    if (!hooks || hooks.length === 0) {
      return [];
    }

    console.log(`[HookManager] 执行钩子: ${hookName} (${hooks.length} 个监听器)`);

    const results: T[] = [];

    for (const hook of hooks) {
      try {
        const result = await hook(context);
        if (result !== undefined) {
          results.push(result as T);
        }
      } catch (error) {
        console.error(`[HookManager] 钩子执行失败: ${hookName}`, error);
      }
    }

    return results;
  }

  /**
   * 移除钩子
   */
  removeHook(hookName: string, hook: PluginHook): void {
    const hooks = this.hooks.get(hookName);

    if (hooks) {
      const index = hooks.indexOf(hook);
      if (index > -1) {
        hooks.splice(index, 1);
      }
    }
  }

  /**
   * 获取钩子数量
   */
  getHookCount(hookName: string): number {
    return this.hooks.get(hookName)?.length || 0;
  }
}

/**
 * 插件注册表
 */
export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private dependencies: Map<string, string[]> = new Map();

  /**
   * 注册插件
   */
  register(plugin: Plugin): void {
    this.plugins.set(plugin.id, plugin);

    if (plugin.config.dependencies) {
      this.dependencies.set(plugin.id, plugin.config.dependencies);
    }

    console.log(`[PluginRegistry] 已注册插件: ${plugin.id}`);
  }

  /**
   * 获取插件
   */
  get(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * 获取所有插件
   */
  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 按类型获取插件
   */
  getByType(type: string): Plugin[] {
    return this.getAll().filter(p => p.config.type === type);
  }

  /**
   * 检查依赖关系
   */
  checkDependencies(pluginId: string): { satisfied: boolean; missing: string[] } {
    const deps = this.dependencies.get(pluginId) || [];
    const missing: string[] = [];

    for (const dep of deps) {
      if (!this.plugins.has(dep)) {
        missing.push(dep);
      }
    }

    return {
      satisfied: missing.length === 0,
      missing,
    };
  }

  /**
   * 获取加载顺序（基于依赖关系）
   */
  getLoadOrder(): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (pluginId: string): void => {
      if (visited.has(pluginId)) {
        return;
      }

      if (visiting.has(pluginId)) {
        throw new Error(`循环依赖检测: ${pluginId}`);
      }

      visiting.add(pluginId);

      const deps = this.dependencies.get(pluginId) || [];
      for (const dep of deps) {
        visit(dep);
      }

      visiting.delete(pluginId);
      visited.add(pluginId);
      order.push(pluginId);
    };

    for (const pluginId of this.plugins.keys()) {
      visit(pluginId);
    }

    return order;
  }
}

/**
 * 插件管理器
 * 统一的插件管理接口
 */
export class PluginManager extends HookManager {
  private loader: PluginLoader;
  private registry: PluginRegistry;

  constructor(pluginDirs: string[] = []) {
    super();
    this.loader = new PluginLoader(pluginDirs);
    this.registry = new PluginRegistry();
  }

  /**
   * 加载所有插件
   */
  async loadAll(context: HookContext): Promise<void> {
    console.log('[PluginManager] 加载所有插件...');

    const pluginPaths = await this.loader.discoverPlugins();
    const plugins: Plugin[] = [];

    for (const pluginPath of pluginPaths) {
      try {
        const plugin = await this.loader.loadPlugin(pluginPath);
        plugins.push(plugin);
        this.registry.register(plugin);
      } catch (error) {
        console.error(`[PluginManager] 加载插件失败: ${pluginPath}`, error);
      }
    }

    // 按依赖顺序初始化
    const loadOrder = this.registry.getLoadOrder();

    for (const pluginId of loadOrder) {
      const plugin = this.registry.get(pluginId);
      if (plugin) {
        await this.loader.initializePlugin(plugin, context);
        await this.loader.enablePlugin(plugin, context);
      }
    }

    console.log(`[PluginManager] 已加载 ${plugins.length} 个插件`);
  }

  /**
   * 获取加载器
   */
  getLoader(): PluginLoader {
    return this.loader;
  }

  /**
   * 获取注册表
   */
  getRegistry(): PluginRegistry {
    return this.registry;
  }
}

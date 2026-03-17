/**
 * before-tool-call 钩子机制 - 简化学习版
 *
 * 【核心概念】
 * 插件可以在工具执行前注册钩子，钩子可以：
 * 1. 允许执行（不阻塞）
 * 2. 阻塞执行（返回 blocked: true + 原因）
 * 3. 修改参数（返回调整后的 params）
 *
 * 使用场景：循环检测、日志记录、权限检查
 */

/**
 * before-tool-call 钩子结果
 */
export interface BeforeToolCallResult {
  /** 是否阻塞执行 */
  blocked: boolean;
  /** 阻塞原因 */
  reason?: string;
  /** 修改后的参数，如果不修改则不返回 */
  params?: Record<string, unknown>;
}

/**
 * before-tool-call 钩子函数类型
 */
export type BeforeToolCallHook = (
  toolName: string,
  params: Record<string, unknown>,
  toolCallId: string
) => Promise<BeforeToolCallResult> | BeforeToolCallResult;

/**
 * 钩子注册表
 */
const beforeToolCallHooks: BeforeToolCallHook[] = [];

/**
 * 注册 before-tool-call 钩子
 */
export function registerBeforeToolCallHook(hook: BeforeToolCallHook): void {
  beforeToolCallHooks.push(hook);
}

/**
 * 运行所有 before-tool-call 钩子
 */
export async function runBeforeToolCallHook(
  toolName: string,
  params: Record<string, unknown>,
  toolCallId: string
): Promise<BeforeToolCallResult> {
  let currentParams = { ...params };
  let hooksRun = 0;

  for (const hook of beforeToolCallHooks) {
    try {
      const result = await hook(toolName, currentParams, toolCallId);

      if (result.blocked) {
        // 有一个钩子阻塞，直接返回
        return {
          blocked: true,
          reason: result.reason || `Blocked by hook ${hooksRun}`,
        };
      }

      // 如果钩子修改了参数，更新
      if (result.params) {
        currentParams = { ...result.params };
      }

      hooksRun++;
    } catch (error) {
      // 钩子出错，阻塞执行
      return {
        blocked: true,
        reason: `Hook threw exception: ${(error as Error).message}`,
      };
    }
  }

  // 所有钩子通过，返回（可能带有修改后的参数）
  return {
    blocked: false,
    params: currentParams,
  };
}

/**
 * 清空所有钩子（主要用于测试）
 */
export function clearBeforeToolCallHooks(): void {
  beforeToolCallHooks.length = 0;
}

/**
 * 获取所有已注册的钩子
 */
export function getBeforeToolCallHooks(): BeforeToolCallHook[] {
  return [...beforeToolCallHooks];
}

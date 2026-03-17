/**
 * VolcEngine (火山方舟) 模型目录 - 遵循原 openclaw 项目架构
 * 参考: D:\github.io\openclaw\src\agents\doubao-models.ts
 */

import type { ModelConfig } from './types.js';

export const VOLC_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
export const VOLC_CODING_BASE_URL = "https://ark.cn-beijing.volces.com/api/coding/v3";

/**
 * 共享编码模型目录
 */
export const VOLC_SHARED_CODING_MODEL_CATALOG = [
  {
    id: "ark-code-latest",
    name: "Ark Coding Plan",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 256000,
    maxTokens: 128000,
  },
  {
    id: "doubao-seed-code",
    name: "Doubao Seed Code",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 256000,
    maxTokens: 128000,
  },
  {
    id: "glm-4.7",
    name: "GLM 4.7 Coding",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 200000,
    maxTokens: 128000,
  },
  {
    id: "deepseek-v3.2",
    name: "DeepSeek V3.2",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 128000,
    maxTokens: 128000,
  },
  {
    id: "doubao-seed-2.0-code",
    name: "Doubao Seed 2.0 Code",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 256000,
    maxTokens: 128000,
  },
  {
    id: "doubao-seed-2.0-pro",
    name: "Doubao Seed 2.0 Pro",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 256000,
    maxTokens: 128000,
  },
  {
    id: "doubao-seed-2.0-lite",
    name: "Doubao Seed 2.0 Lite",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 256000,
    maxTokens: 128000,
  },
  {
    id: "minimax-m2.5",
    name: "MiniMax M2.5",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 200000,
    maxTokens: 128000,
  },
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5 Coding",
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 256000,
    maxTokens: 128000,
  },
] as const;

/**
 * 默认定价 (近似值)
 */
export const VOLC_DEFAULT_COST = {
  input: 0.0001,     // ¥0.0001 per 1K tokens
  output: 0.0002,   // ¥0.0002 per 1K tokens
  cacheRead: 0,
  cacheWrite: 0,
};

/**
 * 类型导出
 */
export type VolcModelCatalogEntry = (typeof VOLC_SHARED_CODING_MODEL_CATALOG)[number];

/**
 * 构建 VolcEngine 模型定义
 */
export function buildVolcModelDefinition(
  entry: VolcModelCatalogEntry,
): ModelConfig {
  return {
    id: entry.id,
    name: entry.name,
    input: [...entry.input],
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxTokens,
  };
}

/**
 * 构建所有模型定义
 */
export function buildAllVolcModels(): ModelConfig[] {
  return VOLC_SHARED_CODING_MODEL_CATALOG.map(buildVolcModelDefinition);
}

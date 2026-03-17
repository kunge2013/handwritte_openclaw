/**
 * OpenClaw Secrets 密钥管理 - 简化学习版
 *
 * 【核心概念】
 * Secrets 模块负责安全管理敏感信息：
 * 1. 从环境变量读取密钥
 * 2. 从密钥库获取凭证
 * 3. 安全存储和访问密钥
 * 4. 密钥验证和刷新
 *
 * 安全原则:
 * - 密钥永远不写入日志
 * - 密钥永远不序列化到 JSON
 * - 内存中密钥使用后尽快清除
 */

import * as crypto from 'crypto';

/**
 * 密钥类型
 */
export enum SecretType {
  API_KEY = 'api_key',
  TOKEN = 'token',
  PASSWORD = 'password',
  CERTIFICATE = 'certificate',
  PRIVATE_KEY = 'private_key',
}

/**
 * 密钥信息
 */
export interface SecretInfo {
  /** 密钥类型 */
  type: SecretType;
  /** 密钥名称/用途 */
  name: string;
  /** 提供商 */
  provider?: string;
  /** 是否已加载 */
  loaded: boolean;
  /** 是否已验证 */
  verified?: boolean;
}

/**
 * 密钥管理器
 */
export class SecretsManager {
  private secrets: Map<string, string> = new Map();
  private secretInfos: Map<string, SecretInfo> = new Map();
  private namespace: string;

  constructor(namespace: string = 'default') {
    this.namespace = namespace;
  }

  /**
   * 从环境变量加载密钥
   */
  loadFromEnv(key: string, envVarName?: string): void {
    const envName = envVarName || key.toUpperCase();
    const value = process.env[envName];

    if (value) {
      this.secrets.set(key, value);
      this.secretInfos.set(key, {
        type: SecretType.API_KEY,
        name: key,
        loaded: true,
      });
      console.log(`[Secrets] 已加载密钥: ${key} (来源: 环境变量)`);
    }
  }

  /**
   * 设置密钥
   */
  setSecret(key: string, value: string, info?: Partial<SecretInfo>): void {
    this.secrets.set(key, value);
    this.secretInfos.set(key, {
      type: SecretType.API_KEY,
      name: key,
      loaded: true,
      ...info,
    });
    console.log(`[Secrets] 已设置密钥: ${key}`);
  }

  /**
   * 获取密钥
   */
  getSecret(key: string): string | undefined {
    return this.secrets.get(key);
  }

  /**
   * 检查密钥是否存在
   */
  hasSecret(key: string): boolean {
    return this.secrets.has(key);
  }

  /**
   * 删除密钥
   */
  removeSecret(key: string): void {
    // 安全清除（覆盖内存）
    const value = this.secrets.get(key);
    if (value) {
      const buffer = Buffer.from(value);
      buffer.fill(0);
    }

    this.secrets.delete(key);
    this.secretInfos.delete(key);
    console.log(`[Secrets] 已删除密钥: ${key}`);
  }

  /**
   * 获取所有密钥名称（不返回值）
   */
  getSecretNames(): string[] {
    return Array.from(this.secrets.keys());
  }

  /**
   * 获取密钥信息
   */
  getSecretInfo(key: string): SecretInfo | undefined {
    return this.secretInfos.get(key);
  }

  /**
   * 验证密钥
   */
  verifySecret(key: string): boolean {
    const value = this.secrets.get(key);
    const info = this.secretInfos.get(key);

    if (!value || !info) {
      return false;
    }

    // 基本验证：非空且有一定长度
    const isValid = value.length > 0 && value.trim().length > 0;

    if (info) {
      info.verified = isValid;
    }

    return isValid;
  }

  /**
   * 验证所有密钥
   */
  verifyAll(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    let allValid = true;

    for (const [key, value] of this.secrets.entries()) {
      if (!value || value.length === 0) {
        missing.push(key);
        allValid = false;
      }
    }

    return {
      valid: allValid && missing.length === 0,
      missing,
    };
  }

  /**
   * 清空所有密钥
   */
  clear(): void {
    // 安全清除所有密钥
    for (const key of this.secrets.keys()) {
      this.removeSecret(key);
    }
  }

  /**
   * 获取命名空间
   */
  getNamespace(): string {
    return this.namespace;
  }
}

/**
 * 安全的密钥包装器
 * 不允许直接访问密钥值
 */
export class SecureSecret {
  private secret: string;
  private revealed: boolean = false;

  constructor(secret: string) {
    this.secret = secret;
  }

  /**
   * 获取密钥（一次性）
   */
  reveal(): string {
    if (this.revealed) {
      throw new Error('密钥已被揭示，无法再次访问');
    }

    this.revealed = true;
    return this.secret;
  }

  /**
   * 检查密钥长度
   */
  length(): number {
    return this.secret.length;
  }

  /**
   * 检查密钥是否为空
   */
  isEmpty(): boolean {
    return this.secret.length === 0;
  }

  /**
   * 检查是否已揭示
   */
  isRevealed(): boolean {
    return this.revealed;
  }
}

/**
 * 密钥生成器
 * 用于生成临时密钥或令牌
 */
export class SecretGenerator {
  /**
   * 生成随机密钥
   */
  static generateKey(length: number = 32): string {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .substring(0, length);
  }

  /**
   * 生成 UUID
   */
  static generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * 生成 API Token
   */
  static generateToken(prefix: string = 'tok'): string {
    const token = crypto.randomBytes(32).toString('base64');
    return `${prefix}_${token}`;
  }

  /**
   * 生成哈希（用于验证）
   */
  static hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * 验证哈希
   */
  static verifyHash(value: string, hash: string): boolean {
    const computed = this.hash(value);
    return computed === hash;
  }
}

/**
 * 密钥验证器
 */
export class SecretValidator {
  /**
   * 验证 OpenAI API Key 格式
   */
  static isOpenAIKey(key: string): boolean {
    return key.startsWith('sk-') && key.length >= 20;
  }

  /**
   * 验证 Anthropic API Key 格式
   */
  static isAnthropicKey(key: string): boolean {
    return key.startsWith('sk-ant-') && key.length >= 40;
  }

  /**
   * 验证 Bearer Token 格式
   */
  static isBearerToken(token: string): boolean {
    // Bearer token 通常是 base64 编码的 JWT 或随机字符串
    return token.length >= 20 && !token.includes('\n');
  }

  /**
   * 验证 API Key 基本格式
   */
  static isValidAPIKey(key: string): boolean {
    return key.length >= 16 && /^[a-zA-Z0-9_-]+$/.test(key);
  }
}

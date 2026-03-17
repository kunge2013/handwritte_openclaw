# OpenClaw 学习版

这是一个简化版本的 OpenClaw 项目，专注于核心逻辑学习。

## 项目简介

OpenClaw 是一个个人 AI 助手项目，运行在用户自己的设备上，支持多种消息渠道。这个学习版保留了核心架构和主要逻辑，去除了复杂的实现细节，便于学习理解。

## 项目结构

```
openclaw_study/
├── src/
│   ├── agents/         # AI 代理核心
│   ├── gateway/        # 网关服务
│   ├── channels/       # 消息渠道
│   ├── memory/         # 记忆系统
│   ├── config/         # 配置管理
│   ├── secrets/        # 密钥管理
│   ├── plugins/        # 插件系统
│   ├── cli/            # 命令行界面
│   └── index.ts        # 主入口
├── package.json
├── tsconfig.json
└── openclaw.mjs        # CLI 入口
```

## 快速开始

### 安装依赖

```bash
cd openclaw_study
npm install
```

### 编译项目

```bash
npm run build
```

### 运行命令

```bash
# 查看帮助
npm start -- help

# 初始化配置
npm start -- config init

# 启动服务
npm start -- start

# 查看状态
npm start -- status

# 运行诊断
npm start -- doctor
```

## 核心架构

OpenClaw 采用分层架构设计，各模块职责清晰：

```
┌─────────────────────────────────────────────────────────┐
│                        CLI                             │  命令行界面
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                    Gateway                            │  消息路由和会话管理
└──────┬────────────────────────────┬─────────────────────┘
       │                            │
┌──────▼──────┐          ┌─────────▼─────────┐
│   Agents    │          │     Channels      │  AI 代理 / 消息渠道
└──────┬──────┘          └─────────┬─────────┘
       │                            │
       └────────┬───────────────────┘
                │
┌───────────────▼───────────────────────────────────────┐
│                   Memory                              │  向量数据库和 RAG
└───────────────┬───────────────────────────────────────┘
                │
┌───────────────▼───────────────────────────────────────┐
│                Plugins                               │  插件系统
└─────────────────────────────────────────────────────────┘
```

## 模块详解

### 1. Agents (AI 代理)

**核心文件**: `src/agents/agent.ts`

**主要功能**:
- 接收和处理用户消息
- 管理对话上下文和历史
- 调用 LLM 模型生成响应
- 执行工具调用
- 管理会话状态

**关键类**:
- `Agent`: 单个代理实例
- `AgentManager`: 管理多个代理

**学习要点**:
```typescript
// 创建 Agent
const agent = new Agent({
  id: 'my-agent',
  model: 'claude-3-5-sonnet',
  systemPrompt: '你是一个AI助手',
});

// 连接并处理消息
await agent.connect();
const response = await agent.processMessage({
  id: 'msg-1',
  role: MessageRole.USER,
  content: '你好',
  timestamp: Date.now(),
});
```

### 2. Gateway (网关)

**核心文件**: `src/gateway/server.ts`

**主要功能**:
- 提供 HTTP/WebSocket 服务器
- 处理来自渠道的消息
- 将消息路由到 Agent
- 管理会话

**关键类**:
- `GatewayServer`: HTTP 服务器实现
- `GatewayManager`: 服务器管理

**学习要点**:
```typescript
const server = new GatewayServer({
  host: '0.0.0.0',
  port: 3000,
  maxConnections: 1000,
});

await server.start();
```

### 3. Channels (消息渠道)

**核心文件**: `src/channels/channel.ts`

**主要功能**:
- 连接各种消息平台（WhatsApp、Telegram、Slack 等）
- 统一消息格式
- 处理平台特定逻辑

**关键类**:
- `BaseChannel`: 渠道基类
- `ChannelManager`: 渠道管理器
- `ChannelFactory`: 渠道工厂

**支持的渠道**:
- Telegram
- WhatsApp
- Slack
- Discord
- Signal

**学习要点**:
```typescript
// 创建渠道
const telegramChannel = new TelegramChannel({
  id: 'telegram-main',
  type: ChannelType.TELEGRAM,
  enabled: true,
});

// 注册到管理器
const manager = new ChannelManager();
await manager.registerChannel(telegramChannel);
```

### 4. Memory (记忆系统)

**核心文件**: `src/memory/memory.ts`

**主要功能**:
- 存储对话历史和用户记忆
- 文本嵌入向量化
- 向量相似度搜索
- 时间衰减和重要性排序

**关键类**:
- `MemoryManager`: 记忆管理
- `MemoryBuilder`: 便捷构建器

**学习要点**:
```typescript
const memory = new MemoryManager({
  maxEntries: 10000,
  enableEmbeddings: true,
  embeddingDimension: 384,
});

await memory.initialize();

// 添加记忆
await memory.addEntry({
  id: 'memory-1',
  type: MemoryType.MESSAGE,
  content: '这是一个消息',
  timestamp: Date.now(),
});

// 搜索相关记忆
const results = await memory.search('查询内容', { limit: 10 });
```

### 5. Config (配置管理)

**核心文件**: `src/config/config.ts`

**主要功能**:
- 加载和解析配置文件
- 配置验证
- 环境变量集成
- 默认值处理

**关键类**:
- `ConfigManager`: 配置管理
- `ConfigPathResolver`: 路径解析
- `EnvLoader`: 环境变量加载

### 6. Secrets (密钥管理)

**核心文件**: `src/secrets/secrets.ts`

**主要功能**:
- 从环境变量读取密钥
- 安全存储和访问密钥
- 密钥验证

**关键类类**:
- `SecretsManager`: 密钥管理
- `SecureSecret`: 安全包装器
- `SecretGenerator`: 密钥生成

**安全原则**:
- 密钥永远不写入日志
- 密钥永远不序列化到 JSON
- 内存中密钥使用后尽快清除

### 7. Plugins (插件系统)

**核心文件**: `src/plugins/plugin.ts`

**主要功能**:
- 插件发现和加载
- 插件生命周期管理
- 钩子系统
- 插件依赖解析

**关键类**:
- `PluginLoader`: 插件加载器
- `HookManager`: 钩子管理器
- `PluginRegistry`: 插件注册表
- `PluginManager`: 统一管理接口

**插件生命周期**:
```
init -> enable -> [active] -> disable -> destroy
```

**钩子类型**:
- 生命周期: `init`, `enable`, `disable`, `destroy`
- 消息: `before-message`, `after-message`
- 命令: `before-command`, `after-command`

## 数据流

### 消息处理流程

```
1. 用户发送消息 (WhatsApp/Telegram/etc.)
   ↓
2. Channel 接收并格式化消息
   ↓
3. Channel 触发 'message' 事件
   ↓
4. Gateway 接收消息，获取/创建会话
   ↓
5. Gateway 路由到 Agent
   ↓
6. Agent 构建上下文（历史 + 记忆）
   ↓
7. Agent 调用 LLM 生成响应
   ↓
8. Agent 处理工具调用（如果有）
   ↓
9. Agent 返回响应
   ↓
10. Gateway 将响应返回给 Channel
   ↓
11. Channel 发送响应到用户
```

### 配置结构

```json
{
  "agent": {
    "id": "default-agent",
    "name": "OpenClaw Agent",
    "model": "claude-3-5-sonnet",
    "systemPrompt": "你是一个AI助手",
    "maxHistoryLength": 100,
    "temperature": 0.7
  },
  "gateway": {
    "host": "0.0.0.0",
    "port": 3000,
    "maxConnections": 1000
  },
  "channels": [
    {
      "id": "telegram-main",
      "type": "telegram",
      "enabled": true
    }
  ],
  "memory": {
    "maxEntries": 10000,
    "enableEmbeddings": true,
    "embeddingDimension": 384
  },
  "plugins": {
    "enabled": true,
    "autoLoad": true
  }
}
```

## 学习路径

### 初级阶段

1. **理解项目结构**
   - 阅读本 README
   - 查看 package.json 和 tsconfig.json

2. **学习基础模块**
   - Config: 理解配置加载
   - Secrets: 理解密钥管理

3. **运行 CLI 命令**
   - `npm start -- help`
   - `npm start -- doctor`

### 中级阶段

1. **学习核心模块**
   - Agent: 理解 AI 代理工作原理
   - Memory: 理解向量和 RAG

2. **理解消息流**
   - 阅读 Channel 和 Gateway
   - 跟踪消息处理流程

3. **实践配置**
   - 创建自己的配置文件
   - 配置不同的渠道

### 高级阶段

1. **学习插件系统**
   - 创建自定义插件
   - 使用钩子系统

2. **扩展功能**
   - 添加新的渠道支持
   - 实现自定义工具

3. **深入理解**
   - 阅读原始 OpenClaw 源码
   - 理解 ACP (Agent Client Protocol)

## 代码示例

### 创建自定义 Agent

```typescript
import { Agent, AgentConfig } from 'openclaw-study';

const config: AgentConfig = {
  id: 'custom-agent',
  name: '我的助手',
  model: 'claude-3-5-sonnet',
  systemPrompt: '你是一个专业的编程助手',
  temperature: 0.7,
};

const agent = new Agent(config);

// 注册自定义工具
agent.registerTool({
  name: 'get_weather',
  description: '获取天气信息',
  handler: async (args) => {
    // 实现天气查询
    return { temperature: 25, condition: '晴' };
  },
});

await agent.connect();
```

### 创建自定义 Channel

```typescript
import { BaseChannel, ChannelConfig, ChannelType } from 'openclaw-study';

class MyCustomChannel extends BaseChannel {
  async connect(): Promise<void> {
    console.log('连接到自定义渠道...');
    this.connected = true;
    this.emit('connected', { channelId: this.config.id });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected', { channelId: this.config.id });
  }

  async sendMessage(message): Promise<void> {
    console.log('发送消息:', message.content);
  }
}

// 使用
const channel = new MyCustomChannel({
  id: 'custom-1',
  type: 'custom' as ChannelType,
});
```

### 创建自定义插件

```typescript
import { Plugin, PluginHook } from 'openclaw-study';

const plugin: Plugin = {
  id: 'my-plugin',
  name: '我的插件',
  version: '1.0.0',
  description: '自定义功能',
  path: '/path/to/plugin',
  config: {},
  enabled: false,
  hooks: new Map([
    ['before-message', async (context) => {
      console.log('消息前处理');
    }],
  ]),
};
```

## 与原始 OpenClaw 的差异

### 简化的内容

1. **LLM 集成**: 使用模拟响应，未集成实际 API
2. **嵌入服务**: 使用模拟向量生成
3. **向量数据库**: 使用内存存储，未使用 SQLite-vec/LanceDB
4. **渠道 SDK**: 未包含完整的平台 SDK
5. **ACP/MCP 协议**: 简化了协议实现

### 保留的核心逻辑

1. **架构设计**: 完整保留了分层架构
2. **模块关系**: 保留了模块间的交互方式
3. **数据流**: 保留了消息处理流程
4. **设计模式**: 保留了工厂、管理器、事件等模式

## 参考资源

- [OpenClaw 原始项目](../openclaw)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Node.js 文档](https://nodejs.org/)

## 许可证

MIT

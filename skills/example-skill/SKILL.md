---
name: example-skill
description: 示例技能演示
user-invocable: true
disable-model-invocation: false
emoji: 🎯
homepage: https://example.com
skillKey: example
primaryEnv: EXAMPLE_API_KEY
tags: demo, example
---

# 示例技能

这是一个示例技能文件，用于演示 OpenClaw 技能系统的功能。

## 功能说明

该技能展示了如何：
1. 使用前置元数据定义技能属性
2. 指定技能的调用策略
3. 配置环境变量依赖
4. 定义技能的标签

## 使用方法

当用户请求相关功能时，AI Agent 会自动识别并使用此技能。

## 示例

用户：帮我创建一个示例项目

Agent：[调用 example-skill] 创建示例项目...

## 技能结构

```
skills/
└── example-skill/
    ├── SKILL.md          (必需) - 技能定义文件
    ├── scripts/           (可选) - 可执行脚本
    ├── references/        (可选) - 参考文档
    └── assets/           (可选) - 输出资源
```

## 扩展性

可以通过以下方式扩展技能：
- 添加自定义脚本到 `scripts/` 目录
- 提供参考文档到 `references/` 目录
- 包含资源文件到 `assets/` 目录

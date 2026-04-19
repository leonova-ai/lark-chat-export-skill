---
name: lark-chat-export
version: 1.0.0
description: >
  飞书聊天记录导出+AI整理工具。无需管理员权限，一键导出任意飞书聊天记录，
  支持多格式输出（Markdown/JSON/HTML/TXT）和AI自动结构化整理（摘要/会议纪要/待办清单/主题分类）。
  专为 OpenClaw 智能体设计，任何安装了此 Skill 的 OpenClaw Agent 都可以直接调用。
author: AutoClaw
homepage: https://github.com/leonova-ai/lark-chat-export-skill
tags:
  - 飞书
  - 聊天记录
  - 导出
  - AI整理
  - 会议纪要
  - 办公效率
  - OpenClaw

triggers:
  - "导出聊天记录"
  - "导出群聊"
  - "聊天记录整理"
  - "生成会议纪要"
  - "聊天摘要"
  - "export chat"
  - "chat history"

commands:
  - name: export
    description: 导出飞书聊天记录，支持按条件筛选，可选AI自动整理
    usage: node index.js <chat_id> [options]
    parameters:
      - name: chat_id
        type: string
        description: 飞书群ID(oc_xxx)或用户open_id(ou_xxx)
        required: true
      - name: last
        type: number
        description: 导出最近N天的聊天记录
        required: false
      - name: start
        alias: s
        type: string
        description: 导出开始时间，格式：YYYY-MM-DD
        required: false
      - name: end
        alias: e
        type: string
        description: 导出结束时间，格式：YYYY-MM-DD
        required: false
      - name: keyword
        alias: k
        type: string
        description: 只导出包含指定关键词的消息
        required: false
      - name: sender
        type: string
        description: 只导出指定发言人的消息
        required: false
      - name: at-me
        type: boolean
        description: 只导出@我的消息
        required: false
      - name: format
        alias: f
        type: string
        enum: [md, json, html, txt]
        default: md
        description: 导出格式
        required: false
      - name: ai-summary
        type: boolean
        description: 启用AI生成聊天摘要/会议纪要/待办清单
        required: false
      - name: ai-mode
        type: string
        enum: [summary, meeting, todo, topics]
        default: summary
        description: AI整理模式
        required: false
      - name: output
        alias: o
        type: string
        description: 输出文件路径
        required: false
      - name: no-attachment
        type: boolean
        description: 忽略附件/图片/文件消息
        required: false
---

# 飞书聊天记录导出+AI整理 Skill

> 专为 OpenClaw 智能体设计，任何安装了此 Skill 的 OpenClaw Agent 都可以直接调用。

## 能力概述

- **聊天记录导出** — 无需管理员权限，导出任意飞书群聊/私聊记录
- **多格式输出** — 支持 Markdown / JSON / HTML / TXT
- **AI自动整理** — 一键生成聊天摘要、会议纪要、待办清单、主题分类
- **灵活过滤** — 按时间范围、关键词、发言人、@我的消息筛选

## 适用场景

当 OpenClaw 智能体遇到以下用户请求时，应触发此 Skill：
- 「帮我导出最近一周的群聊记录」
- 「把这个群的聊天整理成会议纪要」
- 「导出所有@我的消息」
- 「导出聊天记录并生成待办清单」
- 「export chat history」

## 安装到 OpenClaw

### 方式一：通过 ClawHub 安装
```bash
openclaw skill install leonova-ai/lark-chat-export-skill
```

### 方式二：手动安装
```bash
cd ~/.openclaw-autoclaw/skills
git clone https://github.com/leonova-ai/lark-chat-export-skill.git
```

安装后，任何 OpenClaw 智能体都可以自动识别并调用此 Skill。

## 配置

在 `.env` 文件中配置：
```
# 飞书User Access Token（必填）
FEISHU_USER_ACCESS_TOKEN=u-xxxxx

# AI服务配置（可选，至少启用一个即可使用AI整理）
# 火山引擎·豆包
ARK_API_KEY=sk-xxx
# Kimi
KIMI_API_KEY=sk-xxx
# OpenAI兼容
OPENAI_API_KEY=sk-xxx
# 通义千问
DASHSCOPE_API_KEY=sk-xxx
```

## OpenClaw 智能体调用示例

### 基础导出
当用户说「帮我导出最近一周的群聊记录」时：
```bash
node index.js <chat_id> --last 7
```

### AI智能整理
当用户说「帮我把这个群的聊天整理成会议纪要」时：
```bash
node index.js <chat_id> --last 7 --ai-summary --ai-mode meeting
```

### 过滤筛选
当用户说「导出群里@我的所有消息」时：
```bash
node index.js <chat_id> --last 30 --at-me
```

## 输出说明

- 导出文件默认命名为 `chat-export-{chat_id}-{date}.{format}`
- 启用AI整理时，同时生成 `{原文件名}_summary.md` 摘要文件
- HTML格式输出包含本地搜索功能，可直接在浏览器打开使用

## 项目结构

```
lark-chat-export-skill/
├── index.js           # CLI入口
├── skill.yml          # Skill定义文件
├── SKILL.md           # OpenClaw智能体使用说明（本文件）
├── package.json       # 项目依赖
├── .env.example       # 环境变量模板
├── README.md          # 项目说明文档
├── test.js            # 测试脚本
└── src/
    ├── lark-client.js # 飞书API客户端
    ├── formatter.js   # 格式化引擎
    ├── ai-summary.js  # AI整理模块
    └── utils.js       # 工具函数
```

## 与其他 OpenClaw 组件的协作

### 与 OpenClaw Skill 联动
- 与 `feishu-im-read` 配合：先用 feishu-im-read 读取消息，再用本工具导出
- 与 `feishu-create-doc` 配合：导出后可一键创建飞书文档
- 与 `feishu-task` 配合：AI整理的待办清单可直接创建为飞书任务

### 与 Hermes Agent（Nous Research）集成
- 本 Skill 遵循 [agentskills.io](https://agentskills.io) 开放标准，可与 [Hermes Agent](https://github.com/NousResearch/hermes-agent) 兼容
- 导出的聊天记录可作为 Hermes 的对话记忆和语料输入
- AI整理的会议纪要和待办清单可通过 Hermes 的技能系统自动沉淀

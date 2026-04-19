# 🚀 飞书聊天记录导出+AI整理工具

> 无需管理员权限，一键导出任意飞书聊天记录，支持多格式输出 + AI自动结构化整理
>
> **飞书CLI创作者大赛参赛作品 | 标准Skill格式，任意智能体可安装使用**

## 😫 解决的痛点

飞书官方的聊天记录导出功能存在诸多限制：

| 痛点 | 官方方案 | 本工具 |
|------|---------|--------|
| 需要管理员权限 | ✅ 需要 | ❌ 不需要 |
| 导出格式单一 | 仅HTML | Markdown / JSON / HTML / TXT |
| 时间范围受限 | 最长3个月 | 无限制 |
| 无法筛选过滤 | 不支持 | 关键词/发言人/@我 |
| 无AI整理 | 不支持 | 摘要/纪要/待办/分类 |
| 无法本地搜索 | 不支持 | HTML版内置搜索 |

## ✨ 核心特性

- **🔓 无需管理员权限** — 普通员工即可导出任何自己有权限看到的群聊/私聊记录
- **📊 多格式输出** — 支持 Markdown / JSON / HTML / TXT 四种格式，HTML版支持本地搜索
- **🤖 AI智能整理** — 一键生成聊天摘要 / 会议纪要 / 待办清单 / 主题分类
- **🔍 灵活过滤** — 支持按时间范围、关键词、发言人、@我的消息等条件筛选
- **⚡ 零配置快速** — 只需一个User Access Token即可使用，30秒完成导出

## 📦 安装

### 方式一：智能体自动安装（推荐）
任何支持 CLI 的智能体（AutoClaw、Kimi、Claude 等）都可以直接安装：
```bash
git clone https://github.com/leonova-ai/lark-chat-export-skill.git
cd lark-chat-export-skill
npm install
cp .env.example .env
# 编辑 .env 填入 FEISHU_USER_ACCESS_TOKEN
```

### 方式二：手动安装
```

## 🔧 配置

### 快速开始（只需30秒）

1. 打开 👉 https://open.feishu.cn/api-explorer
2. 左侧搜索 **「获取登录用户信息」**
3. 顶部认证方式选 **User Access Token**
4. 点「调试」按钮，飞书扫码授权
5. 复制返回的 **access_token**（格式：`u-xxxxx`）
6. 粘贴到 `.env` 文件的 `FEISHU_USER_ACCESS_TOKEN`

### AI服务配置（可选，不配置仍可导出文件）

| 服务 | 环境变量 | 特点 |
|------|---------|------|
| 火山引擎·豆包 | `ARK_API_KEY` | 国内访问快，成本低 |
| Kimi (Moonshot) | `KIMI_API_KEY` | 128K上下文，适合超长记录 |
| OpenAI兼容 | `OPENAI_API_KEY` + `OPENAI_BASE_URL` | 通用接口 |
| 通义千问 | `DASHSCOPE_API_KEY` | 国内访问，qwen-long模型 |

## 🚀 使用

### 基础用法

```bash
# 导出指定群最近7天的聊天记录（Markdown格式）
node index.js oc_xxxxxx --last 7

# 导出指定时间范围
node index.js oc_xxxxxx -s "2026-04-01" -e "2026-04-18"

# 导出私聊记录
node index.js ou_xxxxxx --last 3

# 导出为HTML格式（带搜索功能）
node index.js oc_xxxxxx --last 7 -f html

# 导出为JSON格式
node index.js oc_xxxxxx --last 7 -f json
```

### 过滤筛选

```bash
# 只导出包含"项目"关键词的消息
node index.js oc_xxxxxx --last 30 -k "项目"

# 只导出指定发言人的消息
node index.js oc_xxxxxx -s "2026-04-01" -e "2026-04-18" --sender "张三"

# 只导出@我的消息
node index.js oc_xxxxxx --last 7 --at-me

# 忽略图片/文件等附件消息
node index.js oc_xxxxxx --last 7 --no-attachment
```

### AI智能整理

```bash
# 生成聊天摘要（默认模式）
node index.js oc_xxxxxx --last 7 --ai-summary

# 生成会议纪要
node index.js oc_xxxxxx --last 7 --ai-summary --ai-mode meeting

# 提取待办任务
node index.js oc_xxxxxx --last 7 --ai-summary --ai-mode todo

# 按主题分类
node index.js oc_xxxxxx --last 7 --ai-summary --ai-mode topics

# 指定输出路径
node index.js oc_xxxxxx --last 7 --ai-summary -o ./exports/chat.md
```

### 参数说明

| 参数 | 说明 | 必填 | 默认值 |
|------|------|------|--------|
| `<chat_id>` | 飞书群ID(oc_xxx)或用户open_id(ou_xxx) | ✅ | - |
| `-s, --start` | 开始时间 (YYYY-MM-DD) | ❌* | - |
| `-e, --end` | 结束时间 (YYYY-MM-DD) | ❌ | 当前时间 |
| `--last <days>` | 最近N天（与-s/-e二选一） | ❌* | - |
| `-k, --keyword` | 关键词过滤 | ❌ | - |
| `--sender` | 发言人过滤 | ❌ | - |
| `--at-me` | 只导出@我的消息 | ❌ | false |
| `-f, --format` | 输出格式：md/json/html/txt | ❌ | md |
| `--ai-summary` | 启用AI整理 | ❌ | false |
| `--ai-mode` | AI模式：summary/meeting/todo/topics | ❌ | summary |
| `-o, --output` | 输出文件路径 | ❌ | 自动生成 |
| `--no-attachment` | 忽略附件消息 | ❌ | false |

\* `-s/-e` 和 `--last` 必须至少填一个

## 📁 项目结构

```
lark-chat-export-skill/
├── index.js           # CLI入口，参数解析与主流程
├── skill.yml          # 飞书CLI Skill定义文件
├── package.json       # 项目依赖与元信息
├── .env.example       # 环境变量模板
├── SETUP.md           # 快速配置指南
├── README.md          # 项目说明
├── test.js            # 测试脚本
└── src/
    ├── lark-client.js # 飞书API客户端（消息拉取、过滤、用户信息）
    ├── formatter.js   # 格式化引擎（MD/JSON/HTML/TXT输出）
    ├── ai-summary.js  # AI整理模块（支持多种AI后端和整理模式）
    └── utils.js       # 工具函数（日期解析、参数校验）
```

## 🏗️ 技术架构

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   CLI 入口   │────▶│  飞书API客户端 │────▶│ 飞书开放平台   │
│  (index.js)  │     │(lark-client) │     │ User Token认证 │
└──────┬───────┘     └──────┬───────┘     └───────────────┘
       │                    │
       │             ┌──────▼───────┐
       │             │   消息过滤    │
       │             │ 关键词/人/@我 │
       │             └──────┬───────┘
       │                    │
       │             ┌──────▼───────┐
       ├────────────▶│  格式化引擎   │
       │             │(formatter.js)│
       │             └──────┬───────┘
       │                    │
       │             ┌──────▼───────┐     ┌───────────────┐
       └────────────▶│  AI整理模块   │────▶│ LLM API       │
                     │(ai-summary)  │     │ 豆包/Kimi/GPT  │
                     └──────┬───────┘     └───────────────┘
                            │
                     ┌──────▼───────┐
                     │  文件输出     │
                     │ MD/JSON/HTML  │
                     └──────────────┘
```

## 🔒 隐私与安全

本工具涉及聊天记录的导出和AI整理，请知悉以下要点：

- **数据存储**：导出的聊天记录保存在你的本地电脑，不会上传到任何服务器（AI整理功能除外）
- **AI整理**：启用 `--ai-summary` 时，聊天内容会发送给你配置的AI服务商（如豆包/Kimi/OpenAI）进行摘要生成。如不希望发送，不使用此参数即可
- **Token安全**：`FEISHU_USER_ACCESS_TOKEN` 仅存储在本地 `.env` 文件中，不会被上传或外泄。Token有效期2小时，过期自动失效
- **建议**：
  - 导出敏感群聊时，避免使用AI整理功能
  - 导出文件妥善保管，不要分享到公开渠道
  - 定期更换飞书User Access Token
  - `.env` 文件已加入 `.gitignore`，不会被提交到代码仓库

## 📝 License

MIT

const OpenAI = require('openai');
const larkClient = require('./lark-client');

class AISummary {
  constructor() {
    this.client = null;
    this.model = null;
    this._initClient();
  }

  _initClient() {
    // 优先使用火山引擎·豆包（ARK）
    if (process.env.ARK_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.ARK_API_KEY,
        baseURL: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      });
      this.model = process.env.ARK_MODEL || 'deepseek-v3-241226';
    }
    // 其次使用Kimi（Moonshot）- 128K上下文适合超长聊天记录
    else if (process.env.KIMI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.KIMI_API_KEY,
        baseURL: 'https://api.moonshot.cn/v1',
      });
      this.model = process.env.KIMI_MODEL || 'moonshot-v1-128k';
    }
    // 再使用OpenAI兼容接口
    else if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      });
      this.model = process.env.OPENAI_MODEL || 'gpt-4o';
    }
    // 最后尝试使用通义千问
    else if (process.env.DASHSCOPE_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.DASHSCOPE_API_KEY,
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      });
      this.model = process.env.DASHSCOPE_MODEL || 'qwen-long';
    }
  }

  // 检查是否已配置AI服务
  isAvailable() {
    return this.client !== null;
  }

  // 生成AI摘要
  async generate(messages, mode) {
    if (!this.client) {
      throw new Error('未配置AI服务，请设置 ARK_API_KEY / KIMI_API_KEY / OPENAI_API_KEY / DASHSCOPE_API_KEY 环境变量');
    }

    // 构建聊天文本
    let chatText;
    if (typeof messages === 'string') {
      chatText = messages.substring(0, 100000); // 限制10万字
    } else {
      chatText = this._buildChatText(messages);
    }

    if (!chatText.trim()) {
      throw new Error('聊天内容为空，无法生成摘要');
    }

    // 根据模式选择prompt
    const prompt = this._getPrompt(mode, chatText);

    // 调用AI
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: '你是一个专业的聊天记录整理助手，擅长从杂乱的聊天记录中提取关键信息并结构化整理。输出语言与聊天内容语言一致。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      });

      return response.choices[0].message.content;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message;
      throw new Error(`AI调用失败: ${errMsg}`);
    }
  }

  // 构建聊天文本（从消息数组）
  _buildChatText(messages) {
    let text = '';
    const maxChars = 100000;

    for (const msg of messages) {
      const parsed = larkClient.parseMessageSync(msg);
      if (!parsed.text || parsed.text.startsWith('[')) continue;

      const line = `${parsed.senderName} (${parsed.time}): ${parsed.text}\n`;

      if (text.length + line.length > maxChars) {
        text += '...(内容过长，已截断)\n';
        break;
      }

      text += line;
    }

    return text;
  }

  // 根据模式获取prompt
  _getPrompt(mode, chatText) {
    const prompts = {
      summary: `请对以下飞书群聊记录进行摘要整理：

${chatText}

请按以下格式输出：

## 📋 聊天摘要

### 核心讨论点
- 列出3-5个核心讨论话题

### 共识与决策
- 列出已达成共识或做出的决策

### 待办任务
- 列出明确的待办任务（负责人+截止时间）

### 重要信息
- 其他值得注意的信息（链接、文件、数据等）

如果某个部分没有内容，可以省略。`,

      meeting: `请将以下飞书群聊记录整理成正式的会议纪要：

${chatText}

请按以下格式输出：

## 📝 会议纪要

**会议时间**: [从聊天记录推断]
**参会人员**: [从聊天记录推断]

### 一、议题
1. [议题1]
2. [议题2]

### 二、讨论内容
#### [议题1]
- 讨论要点
- 各方观点

#### [议题2]
- 讨论要点
- 各方观点

### 三、决议事项
1. [决议1] - 负责人：[xxx]
2. [决议2] - 负责人：[xxx]

### 四、待办清单
| 任务 | 负责人 | 截止时间 |
|------|--------|----------|
|      |        |          |`,

      todo: `请从以下飞书群聊记录中提取所有待办任务：

${chatText}

请按以下格式输出：

## ✅ 待办任务清单

### 高优先级 🔴
- [ ] 任务描述（负责人：xxx，截止时间：xxx）
  - 相关讨论：简要说明

### 中优先级 🟡
- [ ] 任务描述（负责人：xxx，截止时间：xxx）
  - 相关讨论：简要说明

### 低优先级 🟢
- [ ] 任务描述（负责人：xxx，截止时间：xxx）
  - 相关讨论：简要说明

### 已完成 ✅
- [x] 任务描述

请仔细分析每条消息，不要遗漏任何任务。如果没有明确负责人或截止时间，标注"待确认"。`,

      topics: `请对以下飞书群聊记录进行主题分类整理：

${chatText}

请按以下格式输出：

## 📂 按主题分类整理

### 主题1: [主题名称]
**讨论时间**: [起止时间]
**参与人员**: [列出参与者]
**讨论要点**:
- 要点1
- 要点2

**结论**: [如有]

---

### 主题2: [主题名称]
...

请将同一话题的连续讨论归类到同一个主题下，保持时间顺序。`
    };

    return prompts[mode] || prompts.summary;
  }
}

module.exports = new AISummary();

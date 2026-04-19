#!/usr/bin/env node
'use strict';

/**
 * 飞书聊天记录导出工具 - 测试脚本
 * 运行: node test.js
 */

require('dotenv').config();
const chalk = require('chalk');
const dayjs = require('dayjs');

// 测试模块
const larkClient = require('./src/lark-client');
const formatter = require('./src/formatter');
const aiSummary = require('./src/ai-summary');
const { parseDate, validateParams } = require('./src/utils');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(chalk.green(`  ✅ ${name}`));
    passed++;
  } catch (err) {
    console.log(chalk.red(`  ❌ ${name}`));
    console.log(chalk.red(`     ${err.message}`));
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log(chalk.cyan('\n🧪 飞书聊天记录导出工具 - 单元测试\n'));

// ========== utils.js ==========
console.log(chalk.yellow('📦 utils.js'));

test('parseDate - 支持YYYY-MM-DD', () => {
  const d = parseDate('2026-04-18');
  assert(d !== null, '应返回有效日期');
  assert(d.format('YYYY-MM-DD') === '2026-04-18', '日期应正确');
});

test('parseDate - 支持YYYY-MM-DD HH:MM', () => {
  const d = parseDate('2026-04-18 09:30');
  assert(d !== null, '应返回有效日期');
  assert(d.format('YYYY-MM-DD HH:mm') === '2026-04-18 09:30', '日期时间应正确');
});

test('parseDate - null输入返回null', () => {
  assert(parseDate(null) === null, 'null应返回null');
  assert(parseDate('') === null, '空字符串应返回null');
});

test('parseDate - 无效日期返回null', () => {
  assert(parseDate('not-a-date') === null, '无效日期应返回null');
});

test('validateParams - 无时间参数报错', () => {
  const result = validateParams({ start: null, end: null, last: null });
  assert(!result.ok, '应返回校验失败');
});

test('validateParams - last参数合法', () => {
  const result = validateParams({ start: null, end: null, last: 7, format: 'md', aiMode: 'summary' });
  assert(result.ok, '应返回校验通过');
});

test('validateParams - 不支持的格式报错', () => {
  const result = validateParams({ start: '2026-04-01', end: null, last: null, format: 'pdf', aiMode: 'summary' });
  assert(!result.ok, '应返回校验失败');
});

test('validateParams - 不支持的AI模式报错', () => {
  const result = validateParams({ start: '2026-04-01', end: null, last: null, format: 'md', aiMode: 'invalid' });
  assert(!result.ok, '应返回校验失败');
});

// ========== lark-client.js ==========
console.log(chalk.yellow('\n📦 lark-client.js'));

test('extractText - 文本消息', () => {
  const msg = { msg_type: 'text', content: JSON.stringify({ text: '你好世界' }) };
  const text = larkClient.extractText(msg);
  assert(text === '你好世界', '应提取文本内容');
});

test('extractText - 富文本消息', () => {
  const msg = {
    msg_type: 'post',
    content: JSON.stringify({
      zh_cn: {
        content: [[{ tag: 'text', text: 'hello ' }, { tag: 'text', text: 'world' }]]
      }
    })
  };
  const text = larkClient.extractText(msg);
  assert(text === 'hello world', '应拼接富文本内容');
});

test('extractText - 空消息返回空字符串', () => {
  assert(larkClient.extractText({}) === '', '空消息应返回空字符串');
  assert(larkClient.extractText({ content: '' }) === '', '空content应返回空字符串');
});

test('extractText - 图片消息', () => {
  const msg = { msg_type: 'image', content: JSON.stringify({ image_key: 'img_xxx' }) };
  const text = larkClient.extractText(msg);
  assert(text === '[image]', '图片应返回[image]');
});

test('filterByKeyword - 关键词过滤', () => {
  const messages = [
    { msg_type: 'text', content: JSON.stringify({ text: '项目进度讨论' }) },
    { msg_type: 'text', content: JSON.stringify({ text: '今天天气不错' }) },
    { msg_type: 'text', content: JSON.stringify({ text: '项目需求变更' }) },
  ];
  const filtered = larkClient.filterByKeyword(messages, '项目');
  assert(filtered.length === 2, '应过滤出2条含"项目"的消息');
});

test('filterByKeyword - 大小写不敏感', () => {
  const messages = [
    { msg_type: 'text', content: JSON.stringify({ text: 'Hello World' }) },
    { msg_type: 'text', content: JSON.stringify({ text: 'hello everyone' }) },
  ];
  const filtered = larkClient.filterByKeyword(messages, 'hello');
  assert(filtered.length === 2, '应大小写不敏感匹配');
});

test('filterNoAttachment - 过滤附件消息', () => {
  const messages = [
    { msg_type: 'text', content: JSON.stringify({ text: '文本消息' }) },
    { msg_type: 'image', content: JSON.stringify({}) },
    { msg_type: 'file', content: JSON.stringify({}) },
    { msg_type: 'text', content: JSON.stringify({ text: '另一条文本' }) },
  ];
  const filtered = larkClient.filterNoAttachment(messages);
  assert(filtered.length === 2, '应只保留2条文本消息');
});

test('parseMessageSync - 同步解析消息', () => {
  const msg = {
    message_id: 'om_xxx',
    chat_id: 'oc_xxx',
    sender_id: 'ou_xxx',
    msg_type: 'text',
    content: JSON.stringify({ text: '测试消息' }),
    create_time: 1713408000,
  };
  const parsed = larkClient.parseMessageSync(msg);
  assert(parsed.id === 'om_xxx', 'id应正确');
  assert(parsed.text === '测试消息', '文本应正确');
  assert(parsed.msgType === 'text', '类型应正确');
});

// ========== formatter.js ==========
console.log(chalk.yellow('\n📦 formatter.js'));

test('getDefaultFilename - 生成文件名', () => {
  const name = formatter.getDefaultFilename('oc_abc12345', 'md');
  assert(name.startsWith('chat-export-'), '应以chat-export-开头');
  assert(name.endsWith('.md'), '应以.md结尾');
});

test('getDefaultFilename - HTML格式', () => {
  const name = formatter.getDefaultFilename('oc_test', 'html');
  assert(name.endsWith('.html'), '应以.html结尾');
});

test('escapeHtml - HTML转义', () => {
  assert(formatter.escapeHtml('<script>') === '&lt;script&gt;', '应转义<>');
  assert(formatter.escapeHtml('"hello"') === '&quot;hello&quot;', '应转义引号');
  assert(formatter.escapeHtml("it's") === 'it&#039;s', '应转义单引号');
  assert(formatter.escapeHtml(null) === '', 'null应返回空字符串');
});

// ========== ai-summary.js ==========
console.log(chalk.yellow('\n📦 ai-summary.js'));

test('isAvailable - 未配置时返回false', () => {
  // 如果环境变量未设置，应返回false
  const origArk = process.env.ARK_API_KEY;
  const origKimi = process.env.KIMI_API_KEY;
  const origOpenai = process.env.OPENAI_API_KEY;
  const origDash = process.env.DASHSCOPE_API_KEY;
  delete process.env.ARK_API_KEY;
  delete process.env.KIMI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;

  // 重新初始化
  const freshSummary = new (require('./src/ai-summary').constructor)();
  const available = freshSummary.isAvailable();

  // 恢复
  if (origArk) process.env.ARK_API_KEY = origArk;
  if (origKimi) process.env.KIMI_API_KEY = origKimi;
  if (origOpenai) process.env.OPENAI_API_KEY = origOpenai;
  if (origDash) process.env.DASHSCOPE_API_KEY = origDash;

  assert(!available, '未配置API Key时应返回false');
});

test('_getPrompt - 返回有效的prompt', () => {
  const prompt = aiSummary._getPrompt('summary', '测试内容');
  assert(prompt.includes('测试内容'), '应包含输入内容');
  assert(prompt.includes('核心讨论点'), '应包含摘要格式指引');
});

test('_getPrompt - meeting模式', () => {
  const prompt = aiSummary._getPrompt('meeting', '讨论内容');
  assert(prompt.includes('会议纪要'), '应包含会议纪要格式');
});

test('_getPrompt - todo模式', () => {
  const prompt = aiSummary._getPrompt('todo', '讨论内容');
  assert(prompt.includes('待办'), '应包含待办格式');
});

test('_getPrompt - topics模式', () => {
  const prompt = aiSummary._getPrompt('topics', '讨论内容');
  assert(prompt.includes('主题分类'), '应包含主题分类格式');
});

test('_buildChatText - 构建聊天文本', () => {
  const messages = [
    { sender_id: 'ou_a', msg_type: 'text', content: JSON.stringify({ text: '你好' }), create_time: 1713408000 },
    { sender_id: 'ou_b', msg_type: 'text', content: JSON.stringify({ text: '在吗' }), create_time: 1713408060 },
  ];
  const text = aiSummary._buildChatText(messages);
  assert(text.includes('你好'), '应包含消息1');
  assert(text.includes('在吗'), '应包含消息2');
});

// ========== 结果 ==========
console.log(chalk.cyan('\n' + '─'.repeat(40)));
console.log(chalk.green(`✅ 通过: ${passed}`));
if (failed > 0) {
  console.log(chalk.red(`❌ 失败: ${failed}`));
}
console.log(chalk.cyan(`📊 总计: ${passed + failed}`));
console.log('');

process.exit(failed > 0 ? 1 : 0);

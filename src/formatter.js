const fs = require('fs').promises;
const path = require('path');
const larkClient = require('./lark-client');

class Formatter {

  // 格式化消息为Markdown
  async formatMarkdown(messages) {
    let md = '# 飞书聊天记录\n\n';
    md += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
    md += `> 消息总数: ${messages.length}\n\n`;
    md += '---\n\n';

    let currentDate = '';

    for (const msg of messages) {
      const parsed = await larkClient.parseMessage(msg);

      // 按日期分组
      const dateStr = parsed.time.split(' ')[0];
      if (dateStr !== currentDate) {
        if (currentDate) md += '\n';
        currentDate = dateStr;
        md += `## 📅 ${dateStr}\n\n`;
      }

      // 根据消息类型格式化
      switch (parsed.msgType) {
        case 'text':
        case 'post':
          md += `**${parsed.senderName}** (${parsed.time})\n\n${parsed.text}\n\n`;
          break;
        case 'image':
          md += `**${parsed.senderName}** (${parsed.time})\n\n*[图片${parsed.imageKey ? ': ' + parsed.imageKey : ''}]*\n\n`;
          break;
        case 'file':
          md += `**${parsed.senderName}** (${parsed.time})\n\n*[文件: ${parsed.fileName || '未知'}]*\n\n`;
          break;
        case 'interactive':
          md += `**${parsed.senderName}** (${parsed.time})\n\n*[消息卡片]*\n\n`;
          break;
        case 'sticker':
          md += `**${parsed.senderName}** (${parsed.time})\n\n${parsed.text}\n\n`;
          break;
        default:
          md += `**${parsed.senderName}** (${parsed.time})\n\n${parsed.text}\n\n`;
      }
    }

    return md;
  }

  // 格式化消息为JSON
  async formatJSON(messages) {
    const parsedMessages = [];
    for (const msg of messages) {
      const parsed = await larkClient.parseMessage(msg);
      parsedMessages.push(parsed);
    }

    return JSON.stringify({
      exportTime: new Date().toISOString(),
      totalMessages: parsedMessages.length,
      messages: parsedMessages,
    }, null, 2);
  }

  // 格式化消息为HTML
  async formatHTML(messages) {
    let messageRows = '';
    let currentDate = '';
    let openDateDiv = false;

    for (const msg of messages) {
      const parsed = await larkClient.parseMessage(msg);
      const dateStr = parsed.time.split(' ')[0];

      if (dateStr !== currentDate) {
        // 关闭上一个日期分组
        if (openDateDiv) {
          messageRows += '  </div>\n';
        }
        currentDate = dateStr;
        messageRows += `  <div class="date-group">\n`;
        messageRows += `    <div class="date-header">📅 ${this.escapeHtml(dateStr)}</div>\n`;
        openDateDiv = true;
      }

      const bodyHtml = this._renderMessageBody(parsed);

      messageRows += `    <div class="message" data-search="${this.escapeHtml((parsed.text || '').toLowerCase())}">\n`;
      messageRows += `      <div class="message-header">\n`;
      messageRows += `        <span class="sender">${this.escapeHtml(parsed.senderName)}</span>\n`;
      messageRows += `        <span class="time">${this.escapeHtml(parsed.time)}</span>\n`;
      messageRows += `      </div>\n`;
      messageRows += `      <div class="message-body">${bodyHtml}</div>\n`;
      messageRows += `    </div>\n`;
    }

    if (openDateDiv) {
      messageRows += '  </div>\n';
    }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>飞书聊天记录</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5; color: #333; }
    .header { background: #fff; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header h1 { margin: 0 0 8px 0; font-size: 22px; color: #1a73e8; }
    .header p { margin: 0; color: #666; font-size: 14px; }
    .search-box { margin-top: 12px; }
    .search-box input { width: 100%; padding: 10px 14px; font-size: 14px; border: 2px solid #e0e0e0; border-radius: 8px; outline: none; transition: border-color 0.2s; }
    .search-box input:focus { border-color: #1a73e8; }
    .stats { margin-top: 8px; font-size: 13px; color: #888; }
    .date-group { margin-bottom: 16px; }
    .date-header { background: #e3f2fd; padding: 8px 16px; border-radius: 6px; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #1565c0; }
    .message { background: #fff; padding: 12px 16px; border-radius: 10px; margin-bottom: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: box-shadow 0.2s; }
    .message:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .message-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .sender { font-weight: 600; color: #1a73e8; font-size: 14px; }
    .time { color: #999; font-size: 12px; }
    .message-body { line-height: 1.7; font-size: 14px; white-space: pre-wrap; word-break: break-word; }
    .special-msg { color: #999; font-style: italic; }
    .highlight { background: #fff9c4; padding: 1px 2px; border-radius: 2px; }
    .msg-type-tag { display: inline-block; background: #f0f0f0; color: #666; font-size: 11px; padding: 1px 6px; border-radius: 3px; margin-left: 6px; font-style: normal; }
  </style>
</head>
<body>
  <div class="header">
    <h1>💬 飞书聊天记录</h1>
    <p>导出时间: ${new Date().toLocaleString('zh-CN')} | 消息总数: ${messages.length}</p>
    <div class="search-box">
      <input type="text" id="search" placeholder="🔍 搜索消息内容..." oninput="filterMessages()">
    </div>
    <div class="stats" id="stats"></div>
  </div>
  <div id="messages">
${messageRows}
  </div>
  <script>
    function filterMessages() {
      const query = document.getElementById('search').value.toLowerCase().trim();
      const allMsgs = document.querySelectorAll('.message');
      let visible = 0;
      allMsgs.forEach(msg => {
        const text = msg.getAttribute('data-search') || '';
        const show = !query || text.includes(query);
        msg.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      document.getElementById('stats').textContent = query
        ? '匹配 ' + visible + ' / ' + allMsgs.length + ' 条消息'
        : '';
    }
  </script>
</body>
</html>`;

    return html;
  }

  // 渲染单条消息的HTML body
  _renderMessageBody(parsed) {
    switch (parsed.msgType) {
      case 'text':
      case 'post':
        return this.escapeHtml(parsed.text);
      case 'image':
        return `<span class="special-msg">[图片${parsed.imageKey ? ': ' + this.escapeHtml(parsed.imageKey) : ''}]</span>`;
      case 'file':
        return `<span class="special-msg">[文件: ${this.escapeHtml(parsed.fileName || '未知')}]</span>`;
      case 'interactive':
        return `<span class="special-msg">[消息卡片]</span>`;
      case 'sticker':
        return this.escapeHtml(parsed.text);
      default:
        return `<span class="special-msg">[${this.escapeHtml(parsed.msgType)}]</span>`;
    }
  }

  // 格式化消息为纯文本
  async formatTXT(messages) {
    let txt = '飞书聊天记录\n';
    txt += `${'='.repeat(50)}\n`;
    txt += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
    txt += `消息总数: ${messages.length}\n`;
    txt += `${'='.repeat(50)}\n\n`;

    let currentDate = '';

    for (const msg of messages) {
      const parsed = await larkClient.parseMessage(msg);
      const dateStr = parsed.time.split(' ')[0];

      if (dateStr !== currentDate) {
        currentDate = dateStr;
        txt += `\n--- ${dateStr} ---\n\n`;
      }

      switch (parsed.msgType) {
        case 'text':
        case 'post':
          txt += `[${parsed.time}] ${parsed.senderName}:\n${parsed.text}\n\n`;
          break;
        case 'image':
          txt += `[${parsed.time}] ${parsed.senderName}: [图片]\n\n`;
          break;
        case 'file':
          txt += `[${parsed.time}] ${parsed.senderName}: [文件: ${parsed.fileName || '未知'}]\n\n`;
          break;
        default:
          txt += `[${parsed.time}] ${parsed.senderName}: ${parsed.text}\n\n`;
      }
    }

    return txt;
  }

  // 统一格式化入口
  async format(messages, formatType) {
    switch (formatType) {
      case 'md':
        return await this.formatMarkdown(messages);
      case 'json':
        return await this.formatJSON(messages);
      case 'html':
        return await this.formatHTML(messages);
      case 'txt':
        return await this.formatTXT(messages);
      default:
        throw new Error(`不支持的格式: ${formatType}，支持: md, json, html, txt`);
    }
  }

  // 获取默认文件名
  getDefaultFilename(chatId, formatType) {
    const extMap = { md: 'md', json: 'json', html: 'html', txt: 'txt' };
    const ext = extMap[formatType] || 'md';
    const timestamp = new Date().toISOString().slice(0, 10);
    return `chat-export-${chatId.slice(-8)}-${timestamp}.${ext}`;
  }

  // 写入文件
  async writeFile(outputPath, content, aiContent, formatType) {
    // 确保目录存在
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(outputPath, content, 'utf8');

    // 如果有AI内容，同时保存摘要
    if (aiContent) {
      const aiPath = outputPath.replace(/\.\w+$/, '') + '_summary.md';
      await fs.writeFile(aiPath, aiContent, 'utf8');
    }
  }

  // HTML转义
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

module.exports = new Formatter();

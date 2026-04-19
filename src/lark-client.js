const axios = require('axios');
const chalk = require('chalk');

class LarkClient {
  constructor() {
    this.userAccessToken = process.env.FEISHU_USER_ACCESS_TOKEN || null;
    this.userInfo = null;
    this._nameCache = {};
  }

  // 确保有用户Token
  async ensureToken() {
    if (this.userAccessToken) return this.userAccessToken;
    throw new Error(
      '未配置用户Token！请设置 FEISHU_USER_ACCESS_TOKEN 环境变量。\n' +
      '获取方式：https://open.feishu.cn/api-explorer → 搜索「获取登录用户信息」→ 选 User Access Token → 扫码授权 → 复制 access_token'
    );
  }

  // 获取当前用户信息
  async getUserInfo() {
    if (this.userInfo) return this.userInfo;
    const token = await this.ensureToken();
    try {
      const resp = await axios.get('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        headers: { Authorization: `Bearer ${token}` },
      });
      this.userInfo = resp.data.data;
      return this.userInfo;
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.code === 20005) {
        throw new Error('用户Token已过期，请重新获取：\nhttps://open.feishu.cn/api-explorer → 搜索「获取登录用户信息」→ 扫码获取新Token');
      }
      throw new Error(`获取用户信息失败: ${errData?.msg || err.message}`);
    }
  }

  // 获取我的 open_id
  async getMyOpenId() {
    const info = await this.getUserInfo();
    return info?.open_id;
  }

  // 拉取所有消息（自动分页）
  async fetchAllMessages(chatId, startTime, endTime, onProgress) {
    const allMessages = [];
    let pageToken = null;
    let hasMore = true;
    let total = 0;
    let fetched = 0;

    const token = await this.ensureToken();
    const startTs = startTime ? Math.floor(new Date(startTime).getTime() / 1000) : undefined;
    const endTs = endTime ? Math.floor(new Date(endTime).getTime() / 1000) : undefined;

    while (hasMore) {
      const params = {
        container_id_type: 'chat',
        container_id: chatId,
        page_size: 50,
      };
      if (startTs !== undefined) params.start_time = startTs;
      if (endTs !== undefined) params.end_time = endTs;
      if (pageToken) params.page_token = pageToken;

      let resp;
      try {
        resp = await axios.get('https://open.feishu.cn/open-apis/im/v1/messages', {
          params,
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        const errData = err.response?.data;
        if (errData?.code === 230002) {
          throw new Error('你没有权限访问该会话，请确认：\n1. 会话ID是否正确\n2. 你是否在该群/私聊中');
        }
        if (errData?.code === 20005) {
          throw new Error('用户Token已过期，请重新获取');
        }
        throw new Error(`飞书API请求失败: ${errData?.msg || err.message}`);
      }

      const data = resp.data;
      if (data.code !== 0) {
        throw new Error(`飞书API错误: ${data.msg} (code: ${data.code})`);
      }

      const items = data.data.items || [];
      allMessages.push(...items);
      fetched += items.length;
      total = data.data.total || fetched;
      pageToken = data.data.page_token;
      hasMore = data.data.has_more || false;

      if (onProgress) {
        onProgress(Math.min(fetched / total, 1));
      }
    }

    // 按时间正序排列
    allMessages.sort((a, b) => (a.create_time || 0) - (b.create_time || 0));
    return allMessages;
  }

  // 按关键词过滤
  filterByKeyword(messages, keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return messages.filter(msg => {
      const text = this.extractText(msg);
      return text && text.toLowerCase().includes(lowerKeyword);
    });
  }

  // 按发言人过滤
  async filterBySender(messages, sender) {
    if (sender.startsWith('ou_')) {
      return messages.filter(msg => msg.sender_id === sender);
    }
    const names = await this.batchGetSenderNames(messages);
    return messages.filter(msg => {
      const name = names[msg.sender_id] || '';
      return name === sender || name.includes(sender);
    });
  }

  // 过滤@我的消息
  async filterAtMe(messages) {
    const myOpenId = await this.getMyOpenId();
    if (!myOpenId) {
      console.warn(chalk.yellow('⚠️  无法获取用户信息，跳过@过滤'));
      return messages;
    }
    return messages.filter(msg => {
      const mentions = msg.mentions || [];
      return mentions.some(m => {
        // 兼容不同API版本的mentions结构
        const mentionId = m.id?.open_id || m.id?.user_id || m.open_id;
        return mentionId === myOpenId;
      });
    });
  }

  // 过滤附件消息（只保留文本类消息）
  filterNoAttachment(messages) {
    const attachmentTypes = ['image', 'file', 'media', 'audio', 'video'];
    return messages.filter(msg => !attachmentTypes.includes(msg.msg_type));
  }

  // 提取消息文本
  extractText(msg) {
    if (!msg.content) return '';
    try {
      const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
      switch (msg.msg_type) {
        case 'text':
          return content.text || '';
        case 'post': {
          // 兼容多语言富文本
          const langContent = content.zh_cn || content.en_us || content.ja_jp || content;
          if (!langContent.content) return '';
          let text = '';
          langContent.content.forEach(row => {
            if (Array.isArray(row)) {
              row.forEach(item => {
                if (item.tag === 'text' && item.text) text += item.text;
                else if (item.tag === 'a' && item.text) text += item.text;
                else if (item.tag === 'at' && item.user_name) text += `@${item.user_name}`;
              });
            }
          });
          return text;
        }
        case 'interactive':
          return '[消息卡片]';
        case 'share_chat':
          return '[群名片]';
        case 'share_user':
          return '[个人名片]';
        case 'sticker':
          if (content.emoji_type) return `[表情: ${content.emoji_type}]`;
          return '[表情]';
        default:
          return `[${msg.msg_type}]`;
      }
    } catch {
      return '';
    }
  }

  // 获取发言人姓名（用户token可能无法调用contact API，做兼容处理）
  async getSenderName(senderId) {
    if (!senderId) return '未知';
    if (this._nameCache[senderId]) return this._nameCache[senderId];

    try {
      const token = await this.ensureToken();
      // 尝试用batch接口批量查询
      const resp = await axios.post(
        'https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id',
        { emails: [], mobiles: [], include_resigned: false },
        {
          params: { user_id_type: 'open_id' },
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }
      );
      // batch_get_id不一定返回名字，fallback
      this._nameCache[senderId] = senderId;
      return senderId;
    } catch {
      // Contact API权限不足时，尝试从消息中推断
      this._nameCache[senderId] = this._shortenId(senderId);
      return this._nameCache[senderId];
    }
  }

  // 缩短ID用于显示
  _shortenId(id) {
    if (!id) return '未知';
    if (id.startsWith('ou_')) return `用户${id.slice(-6)}`;
    return id;
  }

  // 批量获取所有发言人姓名
  async batchGetSenderNames(messages) {
    const senderIds = [...new Set(messages.map(m => m.sender_id).filter(Boolean))];
    const names = {};

    // 尝试一次性通过im消息中的sender信息获取名字
    for (const msg of messages) {
      if (msg.sender?.id?.open_id && msg.sender?.name) {
        names[msg.sender.id.open_id] = msg.sender.name;
        this._nameCache[msg.sender.id.open_id] = msg.sender.name;
      }
    }

    // 对还没拿到名字的，逐个查询
    const missing = senderIds.filter(id => !names[id]);
    if (missing.length > 0) {
      const promises = missing.map(async id => {
        if (!this._nameCache[id]) {
          names[id] = await this.getSenderName(id);
        } else {
          names[id] = this._nameCache[id];
        }
      });
      await Promise.all(promises);
    }

    return names;
  }

  // 格式化消息时间
  formatTime(msg) {
    const ts = msg.create_time;
    if (!ts) return '';
    const date = new Date(ts * 1000);
    return date.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  }

  // 解析消息为结构化数据（异步版，含名字查询）
  async parseMessage(msg) {
    const senderName = this._nameCache[msg.sender_id]
      || msg.sender?.name
      || await this.getSenderName(msg.sender_id);

    const result = {
      id: msg.message_id,
      chatId: msg.chat_id,
      senderId: msg.sender_id,
      senderName,
      time: this.formatTime(msg),
      timestamp: msg.create_time,
      msgType: msg.msg_type,
      text: this.extractText(msg),
      mentions: msg.mentions || [],
    };
    if (msg.msg_type === 'image') {
      try {
        const c = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        result.imageKey = c.image_key || '';
      } catch { result.imageKey = ''; }
    }
    if (msg.msg_type === 'file') {
      try {
        const c = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        result.fileKey = c.file_key || '';
        result.fileName = c.file_name || '未知文件';
      } catch { result.fileKey = ''; result.fileName = '未知文件'; }
    }
    return result;
  }

  // 同步解析消息（不含名字查询，用于AI摘要构建文本）
  parseMessageSync(msg) {
    const senderName = this._nameCache[msg.sender_id]
      || msg.sender?.name
      || this._shortenId(msg.sender_id);

    return {
      id: msg.message_id,
      chatId: msg.chat_id,
      senderId: msg.sender_id,
      senderName,
      time: this.formatTime(msg),
      timestamp: msg.create_time,
      msgType: msg.msg_type,
      text: this.extractText(msg),
    };
  }
}

module.exports = new LarkClient();

const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(customParseFormat);

/**
 * 解析日期字符串
 * 支持格式：YYYY-MM-DD, YYYY-MM-DD HH:MM, YYYY/MM/DD, YYYYMMDD 等
 * @param {string} dateStr
 * @returns {dayjs.Dayjs | null}
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  const formats = [
    'YYYY-MM-DD HH:mm',
    'YYYY-MM-DD',
    'YYYY/MM/DD HH:mm',
    'YYYY/MM/DD',
    'YYYYMMDD',
  ];

  for (const fmt of formats) {
    const d = dayjs(dateStr, fmt, true);
    if (d.isValid()) return d;
  }

  // fallback
  const d = dayjs(dateStr);
  return d.isValid() ? d : null;
}

/**
 * 校验参数
 * @param {Object} options - 命令选项
 * @returns {Object} { ok: boolean, error?: string }
 */
function validateParams(options) {
  const hasTimeRange = options.start || options.end;
  const hasLastDays = options.last;

  if (!hasTimeRange && !hasLastDays) {
    return { ok: false, error: '请指定时间范围：使用 -s/-e 指定起止时间，或 --last 指定天数' };
  }

  if (options.start && !parseDate(options.start)) {
    return { ok: false, error: `开始时间格式错误: ${options.start}，请使用 YYYY-MM-DD 或 YYYY-MM-DD HH:MM` };
  }

  if (options.end && !parseDate(options.end)) {
    return { ok: false, error: `结束时间格式错误: ${options.end}，请使用 YYYY-MM-DD 或 YYYY-MM-DD HH:MM` };
  }

  if (options.last && (isNaN(options.last) || options.last <= 0)) {
    return { ok: false, error: `--last 天数必须为正整数: ${options.last}` };
  }

  const validFormats = ['md', 'json', 'html', 'txt'];
  if (options.format && !validFormats.includes(options.format)) {
    return { ok: false, error: `不支持的输出格式: ${options.format}，支持: ${validFormats.join(', ')}` };
  }

  const validModes = ['summary', 'meeting', 'todo', 'topics'];
  if (options.aiMode && !validModes.includes(options.aiMode)) {
    return { ok: false, error: `不支持的AI模式: ${options.aiMode}，支持: ${validModes.join(', ')}` };
  }

  return { ok: true };
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * 睡眠
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  parseDate,
  validateParams,
  formatFileSize,
  sleep,
};

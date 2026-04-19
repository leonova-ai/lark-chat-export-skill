#!/usr/bin/env node
'use strict';

require('dotenv').config();

const { Command } = require('commander');
const chalk = require('chalk');
const dayjs = require('dayjs');
const cliProgress = require('cli-progress');

const larkClient = require('./src/lark-client');
const formatter = require('./src/formatter');
const aiSummary = require('./src/ai-summary');
const { parseDate, validateParams } = require('./src/utils');

const program = new Command();

program
  .name('lark-chat-export')
  .description('飞书聊天记录导出+AI整理工具 — 无需管理员权限，一键导出任意飞书聊天记录')
  .version('1.0.0');

program
  .argument('<chat_id>', '飞书群ID(oc_xxx)或用户open_id(ou_xxx)')
  .option('-s, --start <time>', '导出开始时间，格式：YYYY-MM-DD 或 YYYY-MM-DD HH:MM')
  .option('-e, --end <time>', '导出结束时间，格式：YYYY-MM-DD 或 YYYY-MM-DD HH:MM，默认当前时间')
  .option('--last <days>', '导出最近N天的聊天记录，和-s/-e二选一', parseInt)
  .option('-k, --keyword <keyword>', '只导出包含指定关键词的消息')
  .option('--sender <sender>', '只导出指定发言人（用户ID或姓名）的消息')
  .option('--at-me', '只导出@我的消息', false)
  .option('-f, --format <format>', '导出格式：md/json/html/txt', 'md')
  .option('--ai-summary', '是否调用AI生成聊天摘要', false)
  .option('--ai-mode <mode>', 'AI整理模式：summary/meeting/todo/topics', 'summary')
  .option('-o, --output <path>', '输出文件路径')
  .option('--no-attachment', '忽略附件/图片/文件消息', false)
  .action(async (chatId, options) => {
    try {
      // 1. 参数校验
      const validation = validateParams(options);
      if (!validation.ok) {
        console.error(chalk.red(`❌ 参数错误: ${validation.error}`));
        process.exit(1);
      }

      // 2. 解析时间
      let startTime, endTime;
      if (options.last) {
        endTime = dayjs();
        startTime = endTime.subtract(options.last, 'day');
      } else {
        startTime = parseDate(options.start);
        endTime = options.end ? parseDate(options.end) : dayjs();
      }

      if (!startTime) {
        console.error(chalk.red('❌ 请指定时间范围：使用 -s/-e 或 --last'));
        process.exit(1);
      }

      // 3. AI服务检查
      if (options.aiSummary && !aiSummary.isAvailable()) {
        console.error(chalk.red('❌ 未配置AI服务，请设置 ARK_API_KEY / KIMI_API_KEY / OPENAI_API_KEY 环境变量'));
        process.exit(1);
      }

      // 4. 打印任务信息
      console.log(chalk.cyan('\n🚀 飞书聊天记录导出工具'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(chalk.gray(`会话ID:   ${chatId}`));
      console.log(chalk.gray(`时间范围: ${startTime.format('YYYY-MM-DD HH:mm')} ~ ${endTime.format('YYYY-MM-DD HH:mm')}`));
      console.log(chalk.gray(`输出格式: ${options.format.toUpperCase()}`));
      if (options.keyword) console.log(chalk.gray(`关键词:   ${options.keyword}`));
      if (options.sender) console.log(chalk.gray(`发言人:   ${options.sender}`));
      if (options.atMe) console.log(chalk.gray(`仅@我的:  是`));
      if (!options.attachment) console.log(chalk.gray(`过滤附件: 是`));
      if (options.aiSummary) console.log(chalk.gray(`AI整理:   ${options.aiMode}`));
      console.log('');

      // 5. 拉取消息
      console.log(chalk.yellow('📥 正在拉取消息...'));
      const bar = new cliProgress.SingleBar({
        format: chalk.cyan('  {bar}') + ' {percentage}% | {value}条',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
      }, cliProgress.Presets.shades_classic);

      bar.start(100, 0);
      const allMessages = await larkClient.fetchAllMessages(
        chatId,
        startTime.toISOString(),
        endTime.toISOString(),
        (progress) => {
          bar.update(Math.round(progress * 100));
        }
      );
      bar.stop();

      if (allMessages.length === 0) {
        console.log(chalk.yellow('\n⚠️  该时间段内没有消息记录。'));
        process.exit(0);
      }

      console.log(chalk.green(`✅ 共拉取 ${allMessages.length} 条消息`));

      // 6. 过滤消息
      let filtered = allMessages;

      if (options.keyword) {
        const before = filtered.length;
        filtered = larkClient.filterByKeyword(filtered, options.keyword);
        console.log(chalk.gray(`  关键词过滤: ${before} → ${filtered.length} 条`));
      }

      if (options.sender) {
        const before = filtered.length;
        filtered = await larkClient.filterBySender(filtered, options.sender);
        console.log(chalk.gray(`  发言人过滤: ${before} → ${filtered.length} 条`));
      }

      if (options.atMe) {
        const before = filtered.length;
        filtered = await larkClient.filterAtMe(filtered);
        console.log(chalk.gray(`  @我的消息:  ${before} → ${filtered.length} 条`));
      }

      // --no-attachment: commander会将--no-X的选项设为attachment=false（表示不要附件）
      // 所以 options.attachment === false 表示用户选了 --no-attachment
      if (options.attachment === false) {
        const before = filtered.length;
        filtered = larkClient.filterNoAttachment(filtered);
        console.log(chalk.gray(`  过滤附件:   ${before} → ${filtered.length} 条`));
      }

      if (filtered.length === 0) {
        console.log(chalk.yellow('\n⚠️  过滤后没有匹配的消息。'));
        process.exit(0);
      }

      console.log(chalk.green(`📝 最终导出 ${filtered.length} 条消息\n`));

      // 7. 格式化输出
      console.log(chalk.yellow('📝 正在生成导出文件...'));
      const outputContent = await formatter.format(filtered, options.format);

      // 8. AI整理（可选）
      let aiContent = '';
      if (options.aiSummary) {
        console.log(chalk.yellow('🤖 正在调用AI整理...'));
        try {
          aiContent = await aiSummary.generate(outputContent, options.aiMode);
          console.log(chalk.green('✅ AI整理完成'));
        } catch (err) {
          console.log(chalk.red(`⚠️  AI整理失败: ${err.message}`));
          console.log(chalk.gray('   导出文件仍会正常保存，仅缺少AI摘要部分'));
        }
      }

      // 9. 写入文件
      const outputPath = options.output || formatter.getDefaultFilename(chatId, options.format);
      await formatter.writeFile(outputPath, outputContent, aiContent, options.format);

      console.log(chalk.green(`\n🎉 导出完成！`));
      console.log(chalk.white(`   文件: ${outputPath}`));
      if (aiContent) {
        const aiOutputPath = outputPath.replace(/\.\w+$/, '') + '_summary.md';
        console.log(chalk.white(`   摘要: ${aiOutputPath}`));
      }

      // 10. 输出文件大小
      const fs = require('fs');
      try {
        const stat = fs.statSync(outputPath);
        console.log(chalk.gray(`   大小: ${(stat.size / 1024).toFixed(1)} KB`));
      } catch { /* ignore */ }

    } catch (err) {
      console.error(chalk.red(`\n❌ 导出失败: ${err.message}`));
      if (process.env.DEBUG) {
        console.error(chalk.gray(err.stack));
      }
      process.exit(1);
    }
  });

program.parse();

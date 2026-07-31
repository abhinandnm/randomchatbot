const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const queue = require('./queue');
const session = require('./session');
const admin = require('./admin');

// Lightweight HTTP server for Render Web Service health checks
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Mallu Chat Telegram Bot is Live & Active!\n');
}).listen(PORT, () => {
  console.log(`🌐 Health check server listening on port ${PORT}`);
});
const {
  getMainMenuKeyboard,
  getActiveChatKeyboard,
  getSearchingKeyboard,
  getAdminKeyboard
} = require('./keyboards');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;

// Track all unique user IDs for broadcast
const registeredUsers = new Set();

if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
  console.error('\n❌ ERROR: BOT_TOKEN is missing or invalid in .env file!');
  console.error('Please open .env and paste your Telegram Bot Token from @BotFather.\n');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

/**
 * Middleware to track user IDs and check bans
 */
bot.use(async (ctx, next) => {
  if (ctx.from) {
    registeredUsers.add(ctx.from.id);
  }
  return next();
});

/**
 * Helper to check if caller is Admin
 */
const isAdmin = (ctx) => {
  if (!ADMIN_ID) return false;
  return ctx.from && ctx.from.id === ADMIN_ID;
};

/**
 * START Command
 */
bot.start(async (ctx) => {
  const banCheck = admin.isBanned(ctx.from.id);
  if (banCheck.banned) {
    const timeText = banCheck.remainingHours ? ` (Remaining: ${banCheck.remainingHours} hours)` : '';
    return ctx.reply(`🚫 You are restricted from using Mallu Chat${timeText}.\nReason: ${banCheck.reason}`);
  }

  const welcomeMessage = 
    `🌴 *Welcome to Mallu Match!* 🌴\n\n` +
    `Connect anonymously with random Malayalis & people around the world for 1-on-1 text and media chat.\n\n` +
    `✨ *Features:*\n` +
    `• Instant anonymous matching\n` +
    `• Share text, photos, voice notes, stickers & GIFs\n` +
    `• Skip anytime with ⏭ Next Partner\n\n` +
    `Tap *🔍 Find Partner* below to start chatting!`;

  return ctx.replyWithMarkdownV2(
    welcomeMessage.replace(/([!.-])/g, '\\$1'),
    getMainMenuKeyboard()
  );
});

/**
 * HELP Command & Rules
 */
const sendHelp = async (ctx) => {
  const helpText = 
    `ℹ️ *Mallu Match Rules & Help*\n\n` +
    `• Be respectful and polite to your chat partner.\n` +
    `• No spamming, harassment, or unlawful content.\n` +
    `• Never share financial or personal identity info with strangers.\n\n` +
    `📌 *Bot Commands:*\n` +
    `/find - Search for a new partner\n` +
    `/next - Skip to next partner\n` +
    `/stop - End current chat\n` +
    `/report - Report current partner for abuse\n` +
    `/help - View help & guidelines`;

  return ctx.replyWithMarkdownV2(
    helpText.replace(/([!.-])/g, '\\$1'),
    session.isInChat(ctx.from.id) ? getActiveChatKeyboard() : getMainMenuKeyboard()
  );
};

bot.help(sendHelp);
bot.hears('ℹ️ Rules & Help', sendHelp);

/**
 * SEARCH / FIND PARTNER Logic
 */
const startSearch = async (ctx) => {
  const userId = ctx.from.id;

  // Check ban status
  const banCheck = admin.isBanned(userId);
  if (banCheck.banned) {
    const timeText = banCheck.remainingHours ? ` (Remaining: ${banCheck.remainingHours} hours)` : '';
    return ctx.reply(`🚫 You are restricted from starting a chat${timeText}.\nReason: ${banCheck.reason}`);
  }

  // Check if user is already in a chat
  if (session.isInChat(userId)) {
    return ctx.reply('⚠️ You are already in a chat! Tap "⏭ Next Partner" or "⏹ End Chat" first.', getActiveChatKeyboard());
  }

  // Check if user is already waiting in queue
  if (queue.isInQueue(userId)) {
    return ctx.reply('⏳ You are already in the waiting list. Searching for a partner...', getSearchingKeyboard());
  }

  await ctx.reply('🔍 *Searching for a random partner...*', {
    parse_mode: 'Markdown',
    ...getSearchingKeyboard()
  });

  // Attempt to match
  const result = queue.addToQueue(userId);

  if (result.matched) {
    const partnerId = result.partnerId;
    session.createSession(userId, partnerId);

    const matchMessage = 
      `🎉 *Partner Connected!*\n\n` +
      `Say Hi! Be friendly and respectful.\n` +
      `Use the buttons below to skip or leave anytime.`;

    // Notify current user
    await bot.telegram.sendMessage(userId, matchMessage, {
      parse_mode: 'Markdown',
      ...getActiveChatKeyboard()
    }).catch(() => {});

    // Notify matched partner
    await bot.telegram.sendMessage(partnerId, matchMessage, {
      parse_mode: 'Markdown',
      ...getActiveChatKeyboard()
    }).catch(() => {});
  }
};

bot.command(['find', 'search'], startSearch);
bot.hears('🔍 Find Partner', startSearch);

/**
 * CANCEL SEARCH Logic
 */
const cancelSearch = async (ctx) => {
  const userId = ctx.from.id;

  if (queue.isInQueue(userId)) {
    queue.removeFromQueue(userId);
    return ctx.reply('❌ Search cancelled.', getMainMenuKeyboard());
  }

  if (session.isInChat(userId)) {
    return ctx.reply('⚠️ You are currently in a chat. Use "⏹ End Chat" to leave.', getActiveChatKeyboard());
  }

  return ctx.reply('Main Menu:', getMainMenuKeyboard());
};

bot.hears('❌ Cancel Search', cancelSearch);

/**
 * END CHAT / STOP Command Logic
 */
const stopChat = async (ctx) => {
  const userId = ctx.from.id;

  if (queue.isInQueue(userId)) {
    queue.removeFromQueue(userId);
    return ctx.reply('❌ Search cancelled.', getMainMenuKeyboard());
  }

  if (!session.isInChat(userId)) {
    return ctx.reply('⚠️ You are not in an active chat.', getMainMenuKeyboard());
  }

  const partnerId = session.endSession(userId);

  // Notify user
  await ctx.reply('⏹ You ended the chat.', getMainMenuKeyboard());

  // Notify partner
  if (partnerId) {
    await bot.telegram.sendMessage(partnerId, '⏹ Your chat partner has disconnected.', getMainMenuKeyboard()).catch(() => {});
  }
};

bot.command(['stop', 'leave'], stopChat);
bot.hears('⏹ End Chat', stopChat);

/**
 * NEXT PARTNER Command Logic
 */
const nextPartner = async (ctx) => {
  const userId = ctx.from.id;

  if (session.isInChat(userId)) {
    const partnerId = session.endSession(userId);
    await ctx.reply('⏭ You skipped the current chat.', getMainMenuKeyboard());
    if (partnerId) {
      await bot.telegram.sendMessage(partnerId, '⏭ Your partner skipped the chat.', getMainMenuKeyboard()).catch(() => {});
    }
  }

  // Immediately start searching for next partner
  return startSearch(ctx);
};

bot.command('next', nextPartner);
bot.hears('⏭ Next Partner', nextPartner);

/**
 * REPORT PARTNER Logic (Sends live alert to Admin)
 */
const reportPartner = async (ctx) => {
  const userId = ctx.from.id;

  if (!session.isInChat(userId)) {
    return ctx.reply('⚠️ You are not in an active chat to report anyone.', getMainMenuKeyboard());
  }

  const partnerId = session.endSession(userId);
  await ctx.reply('🚨 Partner reported and blocked from this session. Searching for a new partner...', getSearchingKeyboard());

  if (partnerId) {
    await bot.telegram.sendMessage(partnerId, '⏹ Chat ended by user.', getMainMenuKeyboard()).catch(() => {});
  }

  // Send Live Alert to Admin if ADMIN_ID is set
  if (ADMIN_ID) {
    const alertMsg = 
      `🚨 *LIVE REPORT ALERT!*\n\n` +
      `👤 *Reporter ID:* \`${userId}\`\n` +
      `🚫 *Reported User ID:* \`${partnerId}\`\n` +
      `⏰ *Time:* ${new Date().toISOString()}\n\n` +
      `⚡ *Quick Admin Actions:*\n` +
      `• Perm Ban: \`/ban ${partnerId} Reported by user\`\n` +
      `• Restrict 24h: \`/restrict ${partnerId} 24 Abuse\`\n` +
      `• Kick Chat: \`/kick ${partnerId}\``;

    await bot.telegram.sendMessage(ADMIN_ID, alertMsg, { parse_mode: 'Markdown' }).catch((err) => {
      console.error('Failed to send admin report alert:', err.message);
    });
  }

  // Re-queue user
  return startSearch(ctx);
};

bot.command('report', reportPartner);
bot.hears('🚨 Report Partner', reportPartner);

/* ==========================================================================
   ADMIN PANEL & MODERATION SYSTEM (Restricted to ADMIN_ID)
   ========================================================================== */

/**
 * /admin - Open Admin Control Menu
 */
bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx)) return; // Silently ignore non-admins

  return ctx.reply('🎛 *Mallu Chat Admin Panel*', {
    parse_mode: 'Markdown',
    ...getAdminKeyboard()
  });
});

bot.hears('❌ Close Admin', async (ctx) => {
  if (!isAdmin(ctx)) return;
  return ctx.reply('Admin panel closed.', getMainMenuKeyboard());
});

/**
 * Admin Stats Button / Handler
 */
const handleAdminStats = async (ctx) => {
  if (!isAdmin(ctx)) return;

  const waiting = queue.getQueueLength();
  const activePairs = session.getActiveChatPairsCount();
  const totalMatches = session.getTotalMatchesCount();
  const totalUsers = registeredUsers.size;
  const bannedCount = admin.getBannedList().length;

  const text = 
    `📊 *ADMIN SYSTEM STATS*\n\n` +
    `👥 *Total Bot Users:* ${totalUsers}\n` +
    `⏳ *Waiting Queue:* ${waiting}\n` +
    `💬 *Active Ongoing Pairs:* ${activePairs}\n` +
    `🎉 *Total Matches Created:* ${totalMatches}\n` +
    `🚫 *Active Bans/Restrictions:* ${bannedCount}`;

  return ctx.replyWithMarkdownV2(text.replace(/([!.-])/g, '\\$1'), getAdminKeyboard());
};

bot.hears('📊 Admin Stats', handleAdminStats);

/**
 * Admin Ban List Button
 */
bot.hears('🚫 Ban List', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const list = admin.getBannedList();
  if (list.length === 0) {
    return ctx.reply('✅ No users are currently banned or restricted.', getAdminKeyboard());
  }

  let text = `🚫 *ACTIVE BANS & RESTRICTIONS (${list.length})*\n\n`;
  for (const b of list) {
    const typeLabel = b.type === 'perm' ? 'Permanent Ban' : `Restricted (${b.remainingHours}h remaining)`;
    text += `• User ID: \`${b.userId}\` | Type: ${typeLabel}\n  Reason: ${b.reason}\n\n`;
  }

  return ctx.replyWithMarkdown(text, getAdminKeyboard());
});

/**
 * /ban <user_id> [reason] - Permanently ban a user
 */
bot.command('ban', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 1) {
    return ctx.reply('⚠️ Usage: /ban <user_id> [reason]\nExample: /ban 12345678 Spamming');
  }

  const targetId = Number(args[0]);
  const reason = args.slice(1).join(' ') || 'Permanent ban by admin';

  if (isNaN(targetId)) {
    return ctx.reply('❌ Invalid User ID.');
  }

  // End active chat if user is in one
  if (session.isInChat(targetId)) {
    const partnerId = session.endSession(targetId);
    if (partnerId) {
      await bot.telegram.sendMessage(partnerId, '⏹ Chat ended by system administrator.', getMainMenuKeyboard()).catch(() => {});
    }
  }
  queue.removeFromQueue(targetId);

  // Apply ban
  admin.banUser(targetId, reason);

  await bot.telegram.sendMessage(targetId, `🚫 You have been permanently banned from Mallu Chat.\nReason: ${reason}`).catch(() => {});
  return ctx.reply(`✅ User \`${targetId}\` permanently banned.`, { parse_mode: 'Markdown' });
});

/**
 * /restrict <user_id> <hours> [reason] - Temporarily restrict a user
 */
bot.command('restrict', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply('⚠️ Usage: /restrict <user_id> <hours> [reason]\nExample: /restrict 12345678 24 Abusive behavior');
  }

  const targetId = Number(args[0]);
  const hours = Number(args[1]);
  const reason = args.slice(2).join(' ') || 'Temporary restriction by admin';

  if (isNaN(targetId) || isNaN(hours) || hours <= 0) {
    return ctx.reply('❌ Invalid User ID or Hours.');
  }

  // End active chat if user is in one
  if (session.isInChat(targetId)) {
    const partnerId = session.endSession(targetId);
    if (partnerId) {
      await bot.telegram.sendMessage(partnerId, '⏹ Chat ended by system administrator.', getMainMenuKeyboard()).catch(() => {});
    }
  }
  queue.removeFromQueue(targetId);

  // Apply temporary restriction
  admin.restrictUser(targetId, hours, reason);

  await bot.telegram.sendMessage(targetId, `🚫 You have been restricted from Mallu Chat for ${hours} hours.\nReason: ${reason}`).catch(() => {});
  return ctx.reply(`✅ User \`${targetId}\` restricted for ${hours} hours.`, { parse_mode: 'Markdown' });
});

/**
 * /unban <user_id> - Unban / lift restriction
 */
bot.command('unban', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 1) {
    return ctx.reply('⚠️ Usage: /unban <user_id>');
  }

  const targetId = Number(args[0]);
  if (isNaN(targetId)) {
    return ctx.reply('❌ Invalid User ID.');
  }

  const success = admin.unbanUser(targetId);
  if (success) {
    await bot.telegram.sendMessage(targetId, '✅ Your ban/restriction has been lifted. You can now use Mallu Chat!').catch(() => {});
    return ctx.reply(`✅ User \`${targetId}\` unbanned successfully.`, { parse_mode: 'Markdown' });
  }

  return ctx.reply(`⚠️ User \`${targetId}\` was not found in ban list.`, { parse_mode: 'Markdown' });
});

/**
 * /kick <user_id> - Forcefully disconnect active chat session for a user
 */
bot.command('kick', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 1) {
    return ctx.reply('⚠️ Usage: /kick <user_id>');
  }

  const targetId = Number(args[0]);
  if (isNaN(targetId)) {
    return ctx.reply('❌ Invalid User ID.');
  }

  if (session.isInChat(targetId)) {
    const partnerId = session.endSession(targetId);
    await bot.telegram.sendMessage(targetId, '⏹ Chat ended by admin.', getMainMenuKeyboard()).catch(() => {});
    if (partnerId) {
      await bot.telegram.sendMessage(partnerId, '⏹ Chat ended by admin.', getMainMenuKeyboard()).catch(() => {});
    }
    return ctx.reply(`✅ Active chat session for user \`${targetId}\` kicked.`, { parse_mode: 'Markdown' });
  }

  if (queue.isInQueue(targetId)) {
    queue.removeFromQueue(targetId);
    return ctx.reply(`✅ User \`${targetId}\` removed from waiting queue.`, { parse_mode: 'Markdown' });
  }

  return ctx.reply(`⚠️ User \`${targetId}\` is not in an active chat or queue.`);
});

/**
 * /broadcast <message> - Broadcast announcement to all users
 */
const broadcastMessage = async (ctx, text) => {
  if (!isAdmin(ctx)) return;

  if (!text) {
    return ctx.reply('⚠️ Usage: /broadcast <message>\nOr click "📢 Broadcast Message" and send your text.');
  }

  let successCount = 0;
  let failCount = 0;

  await ctx.reply(`📢 Starting broadcast to ${registeredUsers.size} users...`);

  for (const uid of registeredUsers) {
    try {
      await bot.telegram.sendMessage(uid, `📢 *ANNOUNCEMENT*\n\n${text}`, { parse_mode: 'Markdown' });
      successCount++;
    } catch (err) {
      failCount++;
    }
  }

  return ctx.reply(`✅ Broadcast completed!\n\nSuccessful: ${successCount}\nFailed: ${failCount}`);
};

bot.command('broadcast', async (ctx) => {
  const text = ctx.message.text.split(' ').slice(1).join(' ');
  return broadcastMessage(ctx, text);
});

bot.hears('📢 Broadcast Message', async (ctx) => {
  if (!isAdmin(ctx)) return;
  return ctx.reply('📢 To broadcast an announcement, use command:\n`/broadcast <your message text here>`', { parse_mode: 'Markdown' });
});

/**
 * MESSAGE RELAYING ENGINE
 * Relays all incoming text, photos, audio, voice notes, stickers, videos, and documents to active partner
 */
bot.on('message', async (ctx) => {
  const userId = ctx.from.id;

  // Check ban status
  const banCheck = admin.isBanned(userId);
  if (banCheck.banned) {
    const timeText = banCheck.remainingHours ? ` (Remaining: ${banCheck.remainingHours} hours)` : '';
    return ctx.reply(`🚫 You are restricted from sending messages${timeText}.\nReason: ${banCheck.reason}`);
  }

  // If user is waiting in queue
  if (queue.isInQueue(userId)) {
    return ctx.reply('⏳ Please wait, searching for a chat partner...', getSearchingKeyboard());
  }

  // If user is not in an active chat session
  if (!session.isInChat(userId)) {
    return ctx.reply('👇 Tap "🔍 Find Partner" below to start chatting!', getMainMenuKeyboard());
  }

  const partnerId = session.getPartner(userId);
  if (!partnerId) {
    session.endSession(userId);
    return ctx.reply('⚠️ Session expired or partner disconnected.', getMainMenuKeyboard());
  }

  // Safely relay/copy message anonymously to partner
  try {
    await ctx.copyMessage(partnerId);
  } catch (err) {
    console.error(`Failed to deliver message from ${userId} to ${partnerId}:`, err.message);
    session.endSession(userId);
    await ctx.reply('❌ Partner is unavailable or has left Telegram. Chat ended.', getMainMenuKeyboard());
    await bot.telegram.sendMessage(partnerId, '⏹ Chat ended.', getMainMenuKeyboard()).catch(() => {});
  }
});

// Launch bot
console.log('⏳ Connecting to Telegram API...');
bot.launch().then(() => {
  console.log('🚀 Mallu Match Telegram Bot is up and running successfully!');
  if (ADMIN_ID) {
    console.log(`🛡️ Admin Panel enabled for Admin Telegram ID: ${ADMIN_ID}`);
  } else {
    console.log('⚠️ ADMIN_ID not set in .env! Admin commands will be disabled until ADMIN_ID is provided.');
  }
  console.log('Press Ctrl+C to stop.');
}).catch((err) => {
  console.error('❌ Failed to launch Telegram Bot:', err.message);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

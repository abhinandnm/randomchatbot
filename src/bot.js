// 1. Immediately bind HTTP port for Render health checks
const http = require('http');
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Mallu Chat Telegram Bot is Live & Active!\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Health check server bound successfully on 0.0.0.0:${PORT}`);
});

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const queue = require('./queue');
const session = require('./session');
const admin = require('./admin');
const aiPartner = require('./ai_partner');
const {
  getMainMenuKeyboard,
  getActiveChatKeyboard,
  getSearchingKeyboard,
  getAdminKeyboard,
  getShareToUnlockKeyboard
} = require('./keyboards');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;

// Persistent User State Files
const UNLOCKED_FILE = path.join(__dirname, '..', 'unlocked_users.json');

// Helper to load IDs from JSON file
const loadSetFromFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return new Set(data);
    }
  } catch (err) {
    console.error(`Failed to load ${filePath}:`, err.message);
  }
  return new Set();
};

// Helper to save IDs to JSON file
const saveSetToFile = (filePath, setInstance) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(Array.from(setInstance), null, 2), 'utf8');
  } catch (err) {
    console.error(`Failed to save ${filePath}:`, err.message);
  }
};

// Persistent & Active Tracking Sets
const registeredUsers = new Set();
const unlockedShareUsers = loadSetFromFile(UNLOCKED_FILE);
const shareClickedUsers = new Set();

let botUsername = 'MalluMatchBot';

if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
  console.error('\n❌ ERROR: BOT_TOKEN is missing or invalid in .env file!');
  console.error('Please open .env and paste your Telegram Bot Token from @BotFather.\n');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Global Error Catching for Telegraf
bot.catch((err, ctx) => {
  console.error(`❌ Telegraf Error for ${ctx.updateType}:`, err);
  ctx.reply('⚠️ An unexpected error occurred. Please try sending /start again.').catch(() => {});
});

/**
 * Middleware to track user IDs
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
 * START Command - Direct Share & Verify Gate
 */
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const banCheck = admin.isBanned(userId);
    if (banCheck.banned) {
      const timeText = banCheck.remainingHours ? ` (Remaining: ${banCheck.remainingHours} hours)` : '';
      return ctx.reply(`🚫 You are restricted from using Mallu Chat${timeText}.\nReason: ${banCheck.reason}`);
    }

    // Reset share lock when user triggers /start (e.g. after clearing chat/restarting bot)
    unlockedShareUsers.delete(userId);
    shareClickedUsers.delete(userId);
    saveSetToFile(UNLOCKED_FILE, unlockedShareUsers);

    const sharePromptText = 
      `🌴 *WELCOME TO MALLU CHAT!* 🌴\n\n` +
      `📢 *SHARE TO UNLOCK CHAT*\n` +
      `To keep Mallu Chat active and growing, please **share this bot link to 2 Telegram groups or friends** to unlock random chatting!\n\n` +
      `1️⃣ Tap **📲 Share to 2 Groups** below.\n` +
      `2️⃣ Tap **✅ Verify & Start Chatting** to begin!`;

    return ctx.replyWithMarkdown(sharePromptText, getShareToUnlockKeyboard());
  } catch (err) {
    console.error('Error in bot.start:', err);
    return ctx.reply('👋 Welcome to Mallu Match! Tap /start to begin.');
  }
});

/**
 * Click Share Action Callback - Tracks share button tap
 */
bot.action('click_share', async (ctx) => {
  const userId = ctx.from.id;
  shareClickedUsers.add(userId);
  await ctx.answerCbQuery('📲 Opening Telegram Share...');

  const shareText = encodeURIComponent(`🌴 Join Mallu Chat - #1 Anonymous Random Chat Bot for Malayalis! Connect 100% anonymously for text & photo chat: https://t.me/${botUsername}`);
  const shareUrl = `https://t.me/share/url?url=${shareText}`;

  const text = 
    `📲 *STEP 1 COMPLETE: SHARE TO 2 GROUPS*\n\n` +
    `Tap **↗️ Open Telegram Group Picker** below to send the bot link to 2 groups/friends, then click **✅ Verify & Start Chatting**!`;

  return ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.url('↗️ Open Telegram Group Picker', shareUrl)],
      [Markup.button.callback('✅ Verify & Start Chatting', 'verify_shares')]
    ])
  });
});

/**
 * Verify Shares Callback - Strictly checks if user tapped Share button first
 */
bot.action('verify_shares', async (ctx) => {
  const userId = ctx.from.id;

  // STRICT SECURITY CHECK: Did the user tap the Share button first?
  if (!shareClickedUsers.has(userId)) {
    await ctx.answerCbQuery('⚠️ Access Denied! Please tap Share to 2 Groups first!', { show_alert: true });
    return ctx.reply(
      '⚠️ *ACCESS DENIED*\n\nYou MUST tap **📲 Share to 2 Groups to Unlock Chat** first before clicking verify!',
      {
        parse_mode: 'Markdown',
        ...getShareToUnlockKeyboard()
      }
    );
  }

  unlockedShareUsers.add(userId);
  saveSetToFile(UNLOCKED_FILE, unlockedShareUsers);
  await ctx.answerCbQuery('🎉 Chat Unlocked!');
  await ctx.editMessageText('🎉 *SHARE VERIFIED! CHAT UNLOCKED!*\n\nThank you for sharing! You can now start matching with random partners.', { parse_mode: 'Markdown' });
  return ctx.reply('👇 Tap *🔍 Find Partner* below to start chatting!', getMainMenuKeyboard());
});

/**
 * TERMS OF SERVICE Command & Action
 */
const sendTerms = async (ctx) => {
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  const termsText = 
    `📜 *MALLU MATCH - TERMS OF SERVICE & PRIVACY POLICY*\n\n` +
    `By accessing or using Mallu Match Telegram Bot, you agree to comply with the following Terms of Service:\n\n` +
    `1. *Age Limit (18+)*: You must be at least 18 years of age to use this bot.\n\n` +
    `2. *Zero Tolerance Policy*: Any transmission of CSAM, non-consensual content, hate speech, threats, fraud, phishing links, or harassment is strictly prohibited.\n\n` +
    `3. *Moderation & Enforcement*: Violations will result in an immediate, permanent ban of your Telegram User ID without warning and reporting to authorities when applicable.\n\n` +
    `4. *User Privacy*: Messages are anonymously relayed between matched users. Do not share personal identity details, phone numbers, or passwords with strangers.\n\n` +
    `5. *Reporting*: Use the "🚨 Report Partner" button anytime to report abusive users to the moderation team.`;

  return ctx.replyWithMarkdown(termsText);
};

bot.command('terms', sendTerms);
bot.action('show_terms', sendTerms);

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
    `/terms - View Terms of Service\n` +
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

  // Check Share-to-Unlock requirement
  if (!unlockedShareUsers.has(userId)) {
    return ctx.reply(
      '📢 *UNLOCK CHAT REQUIRED*\n\nPlease share this bot link to 2 Telegram groups or friends to unlock random chatting!',
      {
        parse_mode: 'Markdown',
        ...getShareToUnlockKeyboard()
      }
    );
  }

  // Check ban status
  const banCheck = admin.isBanned(userId);
  if (banCheck.banned) {
    const timeText = banCheck.remainingHours ? ` (Remaining: ${banCheck.remainingHours} hours)` : '';
    return ctx.reply(`🚫 You are restricted from starting a chat${timeText}.\nReason: ${banCheck.reason}`);
  }

  // Check if user is already in a chat or AI chat
  if (session.isInChat(userId) || aiPartner.isAIChat(userId)) {
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

  // Attempt to match with a real human first
  const result = queue.addToQueue(userId);

  if (result.matched) {
    // REAL HUMAN MATCH FOUND!
    const partnerId = result.partnerId;

    // If partner was chatting with AI, end their AI chat session first
    if (aiPartner.isAIChat(partnerId)) {
      aiPartner.endAISession(partnerId);
    }

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
  } else {
    // NO HUMAN USERS WAITING
    if (aiPartner.isAIEnabled()) {
      // AI BOT IS ENABLED BY ADMIN: START AI STRANGER CHAT
      const persona = aiPartner.startAISession(userId);

      const matchMessage = 
        `🎉 *Partner Connected!*\n\n` +
        `Say Hi! Be friendly and respectful.\n` +
        `Use the buttons below to skip or leave anytime.`;

      await ctx.reply(matchMessage, {
        parse_mode: 'Markdown',
        ...getActiveChatKeyboard()
      });

      // Simulate typing delay for AI greeting
      setTimeout(async () => {
        if (aiPartner.isAIChat(userId)) {
          await ctx.sendChatAction('typing').catch(() => {});
          setTimeout(async () => {
            if (aiPartner.isAIChat(userId)) {
              await ctx.reply(persona.greeting).catch(() => {});
            }
          }, 1000);
        }
      }, 800);
    } else {
      // AI BOT IS DISABLED BY ADMIN: USER STAYS IN QUEUE
      // Do nothing extra; user is already added to queue
    }
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

  if (session.isInChat(userId) || aiPartner.isAIChat(userId)) {
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

  // End AI session if in AI chat
  if (aiPartner.isAIChat(userId)) {
    aiPartner.endAISession(userId);
    return ctx.reply('⏹ You ended the chat.', getMainMenuKeyboard());
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

  if (aiPartner.isAIChat(userId)) {
    aiPartner.endAISession(userId);
    await ctx.reply('⏭ You skipped the current chat.', getMainMenuKeyboard());
  } else if (session.isInChat(userId)) {
    const partnerId = session.endSession(userId);
    await ctx.reply('⏭ You skipped the current chat.', getMainMenuKeyboard());
    if (partnerId) {
      await bot.telegram.sendMessage(partnerId, '⏭ Your partner skipped the chat.', getMainMenuKeyboard()).catch(() => {});
    }
  }

  // Immediately start searching for next partner (picks fresh AI persona or real user)
  return startSearch(ctx);
};

bot.command('next', nextPartner);
bot.hears('⏭ Next Partner', nextPartner);

/**
 * REPORT PARTNER Logic (Sends live alert to Admin)
 */
const reportPartner = async (ctx) => {
  const userId = ctx.from.id;

  if (aiPartner.isAIChat(userId)) {
    aiPartner.endAISession(userId);
    await ctx.reply('🚨 Partner reported. Searching for a new partner...', getSearchingKeyboard());
    return startSearch(ctx);
  }

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
    ...getAdminKeyboard(aiPartner.isAIEnabled())
  });
});

bot.hears('❌ Close Admin', async (ctx) => {
  if (!isAdmin(ctx)) return;
  return ctx.reply('Admin panel closed.', getMainMenuKeyboard());
});

/**
 * Toggle AI Bot Handler
 */
const toggleAIBotHandler = async (ctx) => {
  if (!isAdmin(ctx)) return;

  const currentStatus = aiPartner.isAIEnabled();
  const newStatus = !currentStatus;
  aiPartner.setAIEnabled(newStatus);

  const statusText = newStatus ? '✅ *AI Companion Bot ENABLED!* Users will chat with AI when 0 humans are online.' : '🛑 *AI Companion Bot DISABLED!* Users will wait in queue until real humans join.';

  return ctx.reply(statusText, {
    parse_mode: 'Markdown',
    ...getAdminKeyboard(newStatus)
  });
};

bot.command('aibot', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const args = ctx.message.text.split(' ').slice(1);
  if (args[0] === 'on') {
    aiPartner.setAIEnabled(true);
    return ctx.reply('✅ AI Bot Companion ENABLED.', getAdminKeyboard(true));
  } else if (args[0] === 'off') {
    aiPartner.setAIEnabled(false);
    return ctx.reply('🛑 AI Bot Companion DISABLED.', getAdminKeyboard(false));
  }
  return toggleAIBotHandler(ctx);
});

bot.hears(['🤖 AI Bot: ON (Click to Disable)', '🤖 AI Bot: OFF (Click to Enable)'], toggleAIBotHandler);

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
  const aiStatusText = aiPartner.isAIEnabled() ? '🟢 ON' : '🔴 OFF';

  const text = 
    `📊 *ADMIN SYSTEM STATS*\n\n` +
    `🤖 *AI Companion Status:* ${aiStatusText}\n` +
    `👥 *Total Bot Users:* ${totalUsers}\n` +
    `⏳ *Waiting Queue:* ${waiting}\n` +
    `💬 *Active Ongoing Pairs:* ${activePairs}\n` +
    `🎉 *Total Matches Created:* ${totalMatches}\n` +
    `🚫 *Active Bans/Restrictions:* ${bannedCount}`;

  return ctx.replyWithMarkdownV2(text.replace(/([!.-])/g, '\\$1'), getAdminKeyboard(aiPartner.isAIEnabled()));
};

bot.hears('📊 Admin Stats', handleAdminStats);

/**
 * Admin Ban List Button
 */
bot.hears('🚫 Ban List', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const list = admin.getBannedList();
  if (list.length === 0) {
    return ctx.reply('✅ No users are currently banned or restricted.', getAdminKeyboard(aiPartner.isAIEnabled()));
  }

  let text = `🚫 *ACTIVE BANS & RESTRICTIONS (${list.length})*\n\n`;
  for (const b of list) {
    const typeLabel = b.type === 'perm' ? 'Permanent Ban' : `Restricted (${b.remainingHours}h remaining)`;
    text += `• User ID: \`${b.userId}\` | Type: ${typeLabel}\n  Reason: ${b.reason}\n\n`;
  }

  return ctx.replyWithMarkdown(text, getAdminKeyboard(aiPartner.isAIEnabled()));
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
  if (aiPartner.isAIChat(targetId)) {
    aiPartner.endAISession(targetId);
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
  if (aiPartner.isAIChat(targetId)) {
    aiPartner.endAISession(targetId);
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

  if (aiPartner.isAIChat(targetId)) {
    aiPartner.endAISession(targetId);
    await bot.telegram.sendMessage(targetId, '⏹ Chat ended by admin.', getMainMenuKeyboard()).catch(() => {});
    return ctx.reply(`✅ AI chat session for user \`${targetId}\` kicked.`, { parse_mode: 'Markdown' });
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
 * MESSAGE RELAYING & AI CHAT ENGINE
 */
bot.on('message', async (ctx) => {
  const userId = ctx.from.id;

  // Check Share-to-Unlock requirement
  if (!unlockedShareUsers.has(userId)) {
    return ctx.reply(
      '📢 *UNLOCK CHAT REQUIRED*\n\nPlease share this bot link to 2 Telegram groups or friends to unlock random chatting!',
      {
        parse_mode: 'Markdown',
        ...getShareToUnlockKeyboard()
      }
    );
  }

  // Check ban status
  const banCheck = admin.isBanned(userId);
  if (banCheck.banned) {
    const timeText = banCheck.remainingHours ? ` (Remaining: ${banCheck.remainingHours} hours)` : '';
    return ctx.reply(`🚫 You are restricted from sending messages${timeText}.\nReason: ${banCheck.reason}`);
  }

  // Anti-Link & Anti-Phishing Filter for safety
  if (ctx.message && ctx.message.text) {
    const text = ctx.message.text.toLowerCase();
    if (text.includes('http://') || text.includes('https://') || text.includes('t.me/') || text.includes('bit.ly')) {
      return ctx.reply('⚠️ For user safety, sending external web links or Telegram channel invites is not allowed in anonymous chat.');
    }
  }

  // AI CHAT RESPONDER
  if (aiPartner.isAIChat(userId)) {
    await ctx.sendChatAction('typing').catch(() => {});
    setTimeout(async () => {
      if (aiPartner.isAIChat(userId)) {
        const responseText = aiPartner.generateResponse(userId, ctx.message ? ctx.message.text : '');
        await ctx.reply(responseText).catch(() => {});
      }
    }, 1200);
    return;
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

  // Safely relay/copy message anonymously to real human partner
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

  // Dynamically fetch bot's active Telegram username
  bot.telegram.getMe().then((me) => {
    botUsername = me.username;
    console.log(`🤖 Active Bot Username: @${botUsername}`);
  }).catch(() => {});

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

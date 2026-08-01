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

// Parse Multi-Bot Tokens from BOT_TOKENS (comma separated) or single BOT_TOKEN
const rawTokens = process.env.BOT_TOKENS || process.env.BOT_TOKEN || '';
const BOT_TOKENS = rawTokens.split(',').map(t => t.trim()).filter(Boolean);
const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;

if (BOT_TOKENS.length === 0 || BOT_TOKENS[0] === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
  console.error('\n❌ ERROR: BOT_TOKEN or BOT_TOKENS is missing or invalid in .env file!');
  console.error('Please open .env and paste your Telegram Bot Token from @BotFather.\n');
  process.exit(1);
}

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

// Map of userId -> Telegraf Bot Instance (Multi-Bot Support)
const userBotMap = new Map();

// Helper to send message to any user via their connected bot instance
const sendMessageToUser = async (targetId, text, extra = {}) => {
  const targetBot = userBotMap.get(targetId) || primaryBot;
  return targetBot.telegram.sendMessage(targetId, text, extra);
};

// Helper to copy message to any user via their connected bot instance
const copyMessageToUser = async (targetId, fromChatId, messageId, extra = {}) => {
  const targetBot = userBotMap.get(targetId) || primaryBot;
  return targetBot.telegram.copyMessage(targetId, fromChatId, messageId, extra);
};

// Array of all initialized bot instances
const botInstances = [];
let primaryBot = null;

// Initialize Telegraf instance for each token
for (const token of BOT_TOKENS) {
  const bot = new Telegraf(token);
  botInstances.push(bot);
  if (!primaryBot) primaryBot = bot;

  // Global Error Catching for Telegraf
  bot.catch((err, ctx) => {
    console.error(`❌ Telegraf Error on bot for ${ctx.updateType}:`, err.message);
    ctx.reply('⚠️ An unexpected error occurred. Please try sending /start again.').catch(() => {});
  });

  // Middleware to track user IDs and connected bot instance
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      registeredUsers.add(ctx.from.id);
      userBotMap.set(ctx.from.id, bot);
    }
    return next();
  });

  setupBotHandlers(bot);
}

/**
 * Helper to check if caller is Admin
 */
const isAdmin = (ctx) => {
  if (!ADMIN_ID) return false;
  return ctx.from && ctx.from.id === ADMIN_ID;
};

/**
 * Setup all command and message handlers for a bot instance
 */
function setupBotHandlers(bot) {
  /**
   * START Command - Direct Share & Verify Gate
   */
  bot.start(async (ctx) => {
    try {
      const userId = ctx.from.id;
      userBotMap.set(userId, bot);

      const banCheck = admin.isBanned(userId);
      if (banCheck.banned) {
        const timeText = banCheck.remainingHours ? ` (Remaining: ${banCheck.remainingHours} hours)` : '';
        return ctx.reply(`🚫 You are restricted from using Mallu Chat${timeText}.\nReason: ${banCheck.reason}`);
      }

      // Reset share lock when user triggers /start (e.g. after clearing chat/restarting bot)
      unlockedShareUsers.delete(userId);
      shareClickedUsers.delete(userId);
      saveSetToFile(UNLOCKED_FILE, unlockedShareUsers);

      const me = await bot.telegram.getMe().catch(() => ({ first_name: 'Mallu Chat', username: 'MalluMatchBot' }));
      const activeUsername = me.username || 'MalluMatchBot';
      const activeName = (me.first_name || 'Mallu Chat').toUpperCase();

      const sharePromptText = 
        `✨ *WELCOME TO ${activeName}!* ✨\n\n` +
        `📢 *SHARE TO UNLOCK CHAT*\n` +
        `To keep ${me.first_name} active and growing, please **share this bot link to 2 Telegram groups or friends** to unlock random chatting!\n\n` +
        `1️⃣ Tap **📲 Share to 2 Groups** below.\n` +
        `2️⃣ Tap **✅ Verify & Start Chatting** to begin!`;

      return ctx.replyWithMarkdown(sharePromptText, getShareToUnlockKeyboard(activeUsername));
    } catch (err) {
      console.error('Error in bot.start:', err.message);
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

    const me = await bot.telegram.getMe().catch(() => ({ username: 'MalluMatchBot' }));
    const activeUsername = me.username || 'MalluMatchBot';

    const shareText = encodeURIComponent(`🌴 Join Mallu Chat - #1 Anonymous Random Chat Bot for Malayalis! Connect 100% anonymously for text & photo chat: https://t.me/${activeUsername}`);
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

    if (!shareClickedUsers.has(userId)) {
      await ctx.answerCbQuery('⚠️ Access Denied! Please tap Share to 2 Groups first!', { show_alert: true });
      const me = await bot.telegram.getMe().catch(() => ({ username: 'MalluMatchBot' }));
      const activeUsername = me.username || 'MalluMatchBot';
      return ctx.reply(
        '⚠️ *ACCESS DENIED*\n\nYou MUST tap **📲 Share to 2 Groups to Unlock Chat** first before clicking verify!',
        {
          parse_mode: 'Markdown',
          ...getShareToUnlockKeyboard(activeUsername)
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
      const me = await bot.telegram.getMe().catch(() => ({ username: 'MalluMatchBot' }));
      const activeUsername = me.username || 'MalluMatchBot';
      return ctx.reply(
        '📢 *UNLOCK CHAT REQUIRED*\n\nPlease share this bot link to 2 Telegram groups or friends to unlock random chatting!',
        {
          parse_mode: 'Markdown',
          ...getShareToUnlockKeyboard(activeUsername)
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

    // Attempt to match with a real human first (across ALL bots)
    const result = queue.addToQueue(userId);

    if (result.matched) {
      // REAL HUMAN MATCH FOUND!
      const partnerId = result.partnerId;

      if (aiPartner.isAIChat(partnerId)) {
        aiPartner.endAISession(partnerId);
      }

      session.createSession(userId, partnerId);

      const matchMessage = 
        `🎉 *Partner Connected!*\n\n` +
        `Say Hi! Be friendly and respectful.\n` +
        `Use the buttons below to skip or leave anytime.`;

      // Notify current user and matched partner across bots
      await sendMessageToUser(userId, matchMessage, { parse_mode: 'Markdown', ...getActiveChatKeyboard() }).catch(() => {});
      await sendMessageToUser(partnerId, matchMessage, { parse_mode: 'Markdown', ...getActiveChatKeyboard() }).catch(() => {});
    } else {
      // NO HUMAN USERS WAITING
      if (aiPartner.isAIEnabled()) {
        const persona = aiPartner.startAISession(userId);

        const matchMessage = 
          `🎉 *Partner Connected!*\n\n` +
          `Say Hi! Be friendly and respectful.\n` +
          `Use the buttons below to skip or leave anytime.`;

        await ctx.reply(matchMessage, {
          parse_mode: 'Markdown',
          ...getActiveChatKeyboard()
        });

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

    if (aiPartner.isAIChat(userId)) {
      aiPartner.endAISession(userId);
      return ctx.reply('⏹ You ended the chat.', getMainMenuKeyboard());
    }

    if (!session.isInChat(userId)) {
      return ctx.reply('⚠️ You are not in an active chat.', getMainMenuKeyboard());
    }

    const partnerId = session.endSession(userId);

    await ctx.reply('⏹ You ended the chat.', getMainMenuKeyboard());
    if (partnerId) {
      await sendMessageToUser(partnerId, '⏹ Your chat partner has disconnected.', getMainMenuKeyboard()).catch(() => {});
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
        await sendMessageToUser(partnerId, '⏭ Your partner skipped the chat.', getMainMenuKeyboard()).catch(() => {});
      }
    }

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
      await sendMessageToUser(partnerId, '⏹ Chat ended by user.', getMainMenuKeyboard()).catch(() => {});
    }

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

      await sendMessageToUser(ADMIN_ID, alertMsg, { parse_mode: 'Markdown' }).catch(() => {});
    }

    return startSearch(ctx);
  };

  bot.command('report', reportPartner);
  bot.hears('🚨 Report Partner', reportPartner);

  /* ADMIN HANDLERS */
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx)) return;
    return ctx.reply('🎛 *Mallu Chat Admin Panel*', {
      parse_mode: 'Markdown',
      ...getAdminKeyboard(aiPartner.isAIEnabled())
    });
  });

  bot.hears('❌ Close Admin', async (ctx) => {
    if (!isAdmin(ctx)) return;
    return ctx.reply('Admin panel closed.', getMainMenuKeyboard());
  });

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
    const newStatus = !aiPartner.isAIEnabled();
    aiPartner.setAIEnabled(newStatus);
    return ctx.reply(`AI Companion Bot status changed: ${newStatus ? 'ENABLED' : 'DISABLED'}`, getAdminKeyboard(newStatus));
  });

  bot.hears(['🤖 AI Bot: ON (Click to Disable)', '🤖 AI Bot: OFF (Click to Enable)'], async (ctx) => {
    if (!isAdmin(ctx)) return;
    const newStatus = !aiPartner.isAIEnabled();
    aiPartner.setAIEnabled(newStatus);
    return ctx.reply(`AI Companion Bot status changed: ${newStatus ? 'ENABLED' : 'DISABLED'}`, getAdminKeyboard(newStatus));
  });

  bot.hears('📊 Admin Stats', async (ctx) => {
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
      `🤖 *Connected Bot Instances:* ${botInstances.length}\n` +
      `👥 *Total Bot Users:* ${totalUsers}\n` +
      `⏳ *Waiting Queue:* ${waiting}\n` +
      `💬 *Active Ongoing Pairs:* ${activePairs}\n` +
      `🎉 *Total Matches Created:* ${totalMatches}\n` +
      `🚫 *Active Bans/Restrictions:* ${bannedCount}`;

    return ctx.replyWithMarkdownV2(text.replace(/([!.-])/g, '\\$1'), getAdminKeyboard(aiPartner.isAIEnabled()));
  });

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

  bot.command('ban', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 1) return ctx.reply('⚠️ Usage: /ban <user_id> [reason]');
    const targetId = Number(args[0]);
    const reason = args.slice(1).join(' ') || 'Permanent ban by admin';
    if (isNaN(targetId)) return ctx.reply('❌ Invalid User ID.');

    if (session.isInChat(targetId)) {
      const partnerId = session.endSession(targetId);
      if (partnerId) {
        await sendMessageToUser(partnerId, '⏹ Chat ended by system administrator.', getMainMenuKeyboard()).catch(() => {});
      }
    }
    if (aiPartner.isAIChat(targetId)) aiPartner.endAISession(targetId);
    queue.removeFromQueue(targetId);

    admin.banUser(targetId, reason);
    await sendMessageToUser(targetId, `🚫 You have been permanently banned from Mallu Chat.\nReason: ${reason}`).catch(() => {});
    return ctx.reply(`✅ User \`${targetId}\` permanently banned.`, { parse_mode: 'Markdown' });
  });

  bot.command('restrict', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) return ctx.reply('⚠️ Usage: /restrict <user_id> <hours> [reason]');
    const targetId = Number(args[0]);
    const hours = Number(args[1]);
    const reason = args.slice(2).join(' ') || 'Temporary restriction by admin';
    if (isNaN(targetId) || isNaN(hours) || hours <= 0) return ctx.reply('❌ Invalid User ID or Hours.');

    if (session.isInChat(targetId)) {
      const partnerId = session.endSession(targetId);
      if (partnerId) {
        await sendMessageToUser(partnerId, '⏹ Chat ended by system administrator.', getMainMenuKeyboard()).catch(() => {});
      }
    }
    if (aiPartner.isAIChat(targetId)) aiPartner.endAISession(targetId);
    queue.removeFromQueue(targetId);

    admin.restrictUser(targetId, hours, reason);
    await sendMessageToUser(targetId, `🚫 You have been restricted from Mallu Chat for ${hours} hours.\nReason: ${reason}`).catch(() => {});
    return ctx.reply(`✅ User \`${targetId}\` restricted for ${hours} hours.`, { parse_mode: 'Markdown' });
  });

  bot.command('unban', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 1) return ctx.reply('⚠️ Usage: /unban <user_id>');
    const targetId = Number(args[0]);
    if (isNaN(targetId)) return ctx.reply('❌ Invalid User ID.');

    const success = admin.unbanUser(targetId);
    if (success) {
      await sendMessageToUser(targetId, '✅ Your ban/restriction has been lifted. You can now use Mallu Chat!').catch(() => {});
      return ctx.reply(`✅ User \`${targetId}\` unbanned successfully.`, { parse_mode: 'Markdown' });
    }
    return ctx.reply(`⚠️ User \`${targetId}\` was not found in ban list.`);
  });

  bot.command('kick', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 1) return ctx.reply('⚠️ Usage: /kick <user_id>');
    const targetId = Number(args[0]);
    if (isNaN(targetId)) return ctx.reply('❌ Invalid User ID.');

    if (session.isInChat(targetId)) {
      const partnerId = session.endSession(targetId);
      await sendMessageToUser(targetId, '⏹ Chat ended by admin.', getMainMenuKeyboard()).catch(() => {});
      if (partnerId) {
        await sendMessageToUser(partnerId, '⏹ Chat ended by admin.', getMainMenuKeyboard()).catch(() => {});
      }
      return ctx.reply(`✅ Active chat session for user \`${targetId}\` kicked.`, { parse_mode: 'Markdown' });
    }
    if (aiPartner.isAIChat(targetId)) {
      aiPartner.endAISession(targetId);
      await sendMessageToUser(targetId, '⏹ Chat ended by admin.', getMainMenuKeyboard()).catch(() => {});
      return ctx.reply(`✅ AI chat session for user \`${targetId}\` kicked.`, { parse_mode: 'Markdown' });
    }
    if (queue.isInQueue(targetId)) {
      queue.removeFromQueue(targetId);
      return ctx.reply(`✅ User \`${targetId}\` removed from waiting queue.`, { parse_mode: 'Markdown' });
    }
    return ctx.reply(`⚠️ User \`${targetId}\` is not in an active chat or queue.`);
  });

  bot.command('broadcast', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply('⚠️ Usage: /broadcast <message>');

    let successCount = 0;
    let failCount = 0;
    await ctx.reply(`📢 Starting broadcast to ${registeredUsers.size} users across all bot instances...`);

    for (const uid of registeredUsers) {
      try {
        await sendMessageToUser(uid, `📢 *ANNOUNCEMENT*\n\n${text}`, { parse_mode: 'Markdown' });
        successCount++;
      } catch (err) {
        failCount++;
      }
    }
    return ctx.reply(`✅ Broadcast completed!\n\nSuccessful: ${successCount}\nFailed: ${failCount}`);
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

    if (!unlockedShareUsers.has(userId)) {
      const me = await bot.telegram.getMe().catch(() => ({ username: 'MalluMatchBot' }));
      const activeUsername = me.username || 'MalluMatchBot';
      return ctx.reply(
        '📢 *UNLOCK CHAT REQUIRED*\n\nPlease share this bot link to 2 Telegram groups or friends to unlock random chatting!',
        {
          parse_mode: 'Markdown',
          ...getShareToUnlockKeyboard(activeUsername)
        }
      );
    }

    const banCheck = admin.isBanned(userId);
    if (banCheck.banned) {
      const timeText = banCheck.remainingHours ? ` (Remaining: ${banCheck.remainingHours} hours)` : '';
      return ctx.reply(`🚫 You are restricted from sending messages${timeText}.\nReason: ${banCheck.reason}`);
    }

    if (ctx.message && ctx.message.text) {
      const text = ctx.message.text.toLowerCase();
      if (text.includes('http://') || text.includes('https://') || text.includes('t.me/') || text.includes('bit.ly')) {
        return ctx.reply('⚠️ For user safety, sending external web links or Telegram channel invites is not allowed in anonymous chat.');
      }
    }

    if (aiPartner.isAIChat(userId)) {
      console.log(`💬 [AI CHAT LOG] User ${userId}: ${ctx.message.text || '[Media]'}`);
      await ctx.sendChatAction('typing').catch(() => {});
      setTimeout(async () => {
        if (aiPartner.isAIChat(userId)) {
          const responseText = aiPartner.generateResponse(userId, ctx.message ? ctx.message.text : '');
          await ctx.reply(responseText).catch(() => {});
        }
      }, 1200);
      return;
    }

    if (queue.isInQueue(userId)) {
      return ctx.reply('⏳ Please wait, searching for a chat partner...', getSearchingKeyboard());
    }

    if (!session.isInChat(userId)) {
      return ctx.reply('👇 Tap "🔍 Find Partner" below to start chatting!', getMainMenuKeyboard());
    }

    const partnerId = session.getPartner(userId);
    if (!partnerId) {
      session.endSession(userId);
      return ctx.reply('⚠️ Session expired or partner disconnected.', getMainMenuKeyboard());
    }

    const msgContent = ctx.message.text ? ctx.message.text : '[Media/Attachment]';
    console.log(`💬 [CHAT LOG] User ${userId} -> Partner ${partnerId}: ${msgContent}`);

    // Relaying message to partner across bots
    try {
      await copyMessageToUser(partnerId, userId, ctx.message.message_id);
    } catch (err) {
      console.error(`Failed to deliver message from ${userId} to ${partnerId}:`, err.message);
      session.endSession(userId);
      await ctx.reply('❌ Partner is unavailable or has left Telegram. Chat ended.', getMainMenuKeyboard());
      await sendMessageToUser(partnerId, '⏹ Chat ended.', getMainMenuKeyboard()).catch(() => {});
    }
  });
}

// Launch all bot instances
console.log(`⏳ Launching ${botInstances.length} Telegram Bot instances...`);
Promise.all(botInstances.map(b => b.launch())).then(() => {
  console.log(`🚀 ${botInstances.length} Telegram Bot Instance(s) up and running successfully!`);
  if (ADMIN_ID) {
    console.log(`🛡️ Admin Panel enabled for Admin Telegram ID: ${ADMIN_ID}`);
  }
  console.log('Press Ctrl+C to stop.');
}).catch((err) => {
  console.error('❌ Failed to launch Telegram Bot(s):', err.message);
});

// Enable graceful stop
process.once('SIGINT', () => botInstances.forEach(b => b.stop('SIGINT')));
process.once('SIGTERM', () => botInstances.forEach(b => b.stop('SIGTERM')));

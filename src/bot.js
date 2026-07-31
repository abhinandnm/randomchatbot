require('dotenv').config();
const { Telegraf } = require('telegraf');
const queue = require('./queue');
const session = require('./session');
const {
  getMainMenuKeyboard,
  getActiveChatKeyboard,
  getSearchingKeyboard
} = require('./keyboards');

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
  console.error('\n❌ ERROR: BOT_TOKEN is missing or invalid in .env file!');
  console.error('Please open .env and paste your Telegram Bot Token from @BotFather.\n');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

/**
 * START Command
 */
bot.start(async (ctx) => {
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
 * REPORT PARTNER Logic
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

  // Re-queue user
  return startSearch(ctx);
};

bot.command('report', reportPartner);
bot.hears('🚨 Report Partner', reportPartner);

/**
 * MESSAGE RELAYING ENGINE
 * Relays all incoming text, photos, audio, voice notes, stickers, videos, and documents to active partner
 */
bot.on('message', async (ctx) => {
  const userId = ctx.from.id;

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
    // Partner likely blocked the bot or deleted chat
    session.endSession(userId);
    await ctx.reply('❌ Partner is unavailable or has left Telegram. Chat ended.', getMainMenuKeyboard());
    await bot.telegram.sendMessage(partnerId, '⏹ Chat ended.', getMainMenuKeyboard()).catch(() => {});
  }
});

// Launch bot
console.log('⏳ Connecting to Telegram API...');
bot.launch().then(() => {
  console.log('🚀 Mallu Match Telegram Bot is up and running successfully!');
  console.log('Press Ctrl+C to stop.');
}).catch((err) => {
  console.error('❌ Failed to launch Telegram Bot:', err.message);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

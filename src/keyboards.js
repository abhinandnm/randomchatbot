const { Markup } = require('telegraf');

// Keyboards for Mallu Match Telegram Bot

/**
 * Main Menu Keyboard displayed when not in an active chat
 */
const getMainMenuKeyboard = () => {
  return Markup.keyboard([
    ['🔍 Find Partner'],
    ['ℹ️ Rules & Help']
  ]).resize();
};

/**
 * Active Chat Keyboard displayed while chatting with a random partner
 */
const getActiveChatKeyboard = () => {
  return Markup.keyboard([
    ['⏭ Next Partner', '⏹ End Chat'],
    ['🚨 Report Partner']
  ]).resize();
};

/**
 * Searching Keyboard displayed while waiting in queue
 */
const getSearchingKeyboard = () => {
  return Markup.keyboard([
    ['❌ Cancel Search']
  ]).resize();
};

/**
 * Admin Panel Keyboard for owner/admin
 */
const getAdminKeyboard = (aiStatus = true) => {
  const aiButtonText = aiStatus ? '🤖 AI Bot: ON (Click to Disable)' : '🤖 AI Bot: OFF (Click to Enable)';
  return Markup.keyboard([
    ['📊 Admin Stats', '🚫 Ban List'],
    [aiButtonText],
    ['📢 Broadcast Message', '❌ Close Admin']
  ]).resize();
};

/**
 * 18+ Age Gate Inline Keyboard
 */
const get18PlusVerificationKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ I am 18+ & Agree to Terms', 'verify_18')],
    [Markup.button.callback('📄 Read Terms of Service', 'show_terms')],
    [Markup.button.callback('❌ Exit (Under 18)', 'reject_18')]
  ]);
};

/**
 * Share Step 1 Keyboard (Shows Share to 2 Groups button first)
 */
const getShareStep1Keyboard = (botUsername = 'MalluMatchBot') => {
  const shareText = encodeURIComponent(`🌴 Join Mallu Chat - #1 Anonymous Random Chat Bot for Malayalis! Connect 100% anonymously for text & photo chat: https://t.me/${botUsername}`);
  const shareUrl = `https://t.me/share/url?url=${shareText}`;

  return Markup.inlineKeyboard([
    [Markup.button.url('📲 Share to 2 Groups to Unlock Chat', shareUrl)],
    [Markup.button.callback('▶️ I Have Shared (Verify Now)', 'show_verify_button')]
  ]);
};

/**
 * Share Step 2 Keyboard (Shows Verify button after user returns from contacts picker)
 */
const getShareStep2Keyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Verify & Start Finding Partner', 'verify_shares')]
  ]);
};

module.exports = {
  getMainMenuKeyboard,
  getActiveChatKeyboard,
  getSearchingKeyboard,
  getAdminKeyboard,
  get18PlusVerificationKeyboard,
  getShareStep1Keyboard,
  getShareStep2Keyboard
};

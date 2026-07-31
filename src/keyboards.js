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
const getAdminKeyboard = () => {
  return Markup.keyboard([
    ['📊 Admin Stats', '🚫 Ban List'],
    ['📢 Broadcast Message', '❌ Close Admin']
  ]).resize();
};

module.exports = {
  getMainMenuKeyboard,
  getActiveChatKeyboard,
  getSearchingKeyboard,
  getAdminKeyboard
};

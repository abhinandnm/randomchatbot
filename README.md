# 🌴 Mallu Match - Telegram Random Chat Bot

A high-performance, anonymous random text & media chat Telegram bot for **Mallu Match**.

---

## ⚡ Features
- 🔍 **Instant Random Matchmaking**: Pairs waiting users 1-on-1 in FIFO order.
- 💬 **Full Media Relaying**: Relays text messages, photos, voice notes, stickers, GIFs, audio, video, and documents.
- ⏭ **Next Partner / Skip**: Skip to a new partner anytime with one tap.
- ⏹ **End Chat**: Leave current chat cleanly and safely.
- 📊 **Live Stats**: Check waiting queue length, active pairs, and total matches.
- 🚨 **Report & Safety**: Block/report abusive partners instantly.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)

### 2. Setup & Configuration

1. Clone or navigate to the project directory:
   ```bash
   cd c:\Users\naduv\OneDrive\Desktop\m
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your Environment Variables:
   - Open the `.env` file in the project root.
   - Replace `YOUR_TELEGRAM_BOT_TOKEN_HERE` with your actual token from `@BotFather`:
     ```env
     BOT_TOKEN=7891234567:AAHxxxxxxxxxxxxxxxxxxxx
     ```

4. Run the Bot locally:
   ```bash
   npm start
   ```
   Or for auto-reloading development mode:
   ```bash
   npm run dev
   ```

---

## 🎯 Telegram Search & BotFather Setup Best Practices

To get maximum traffic from Telegram Search:

1. **Bot Display Name** (`/setname` in BotFather):
   `Mallu Match | Kerala Random Chat 🌴`
2. **Bot Username**:
   `@MalluMatchBot` or `@MalluRandomChatBot`
3. **Bot Description** (`/setdescription` in BotFather):
   *Connect anonymously with random people in Kerala & worldwide. Safe, fast 1-on-1 random text & media chat.*
4. **Bot About Info** (`/setabouttext` in BotFather):
   *Official Mallu Match Telegram Bot 💬*

---

## ☁️ How to Deploy 24/7 (Free Hosting Options)

You can run your bot 24/7 on free cloud services:

1. **Render.com** (Free Background Worker)
   - Push code to GitHub.
   - Create a **Background Worker** on Render.
   - Set environment variable `BOT_TOKEN` in Render settings.
2. **Railway.app / Koyeb**
   - Connect repository and deploy as a Node background service.
3. **VPS (Ubuntu / Linux)**
   - Use `pm2` to keep the bot running continuously:
     ```bash
     npm install -g pm2
     pm2 start src/bot.js --name "mallu-match-bot"
     pm2 save
     pm2 startup
     ```

---

## 🛠 Project Structure

```text
├── src/
│   ├── bot.js         # Main Telegraf bot initialization & message relay engine
│   ├── queue.js       # Matchmaking queue logic (FIFO)
│   ├── session.js     # Active user pair & chat session manager
│   └── keyboards.js   # Telegram reply keyboard templates
├── .env               # Bot secret environment file
├── .env.example       # Template environment file
├── package.json       # Dependencies & NPM scripts
└── README.md          # Documentation
```

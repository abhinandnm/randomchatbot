const fs = require('fs');
const path = require('path');

const BANS_FILE = path.join(__dirname, '..', 'bans.json');

class AdminManager {
  constructor() {
    this.bans = new Map(); // userId -> { type: 'perm' | 'temp', expiresAt?: number, reason: string }
    this.loadBans();
  }

  /**
   * Load bans from bans.json if it exists
   */
  loadBans() {
    try {
      if (fs.existsSync(BANS_FILE)) {
        const data = fs.readFileSync(BANS_FILE, 'utf8');
        const parsed = JSON.parse(data);
        for (const [userId, banInfo] of Object.entries(parsed)) {
          this.bans.set(Number(userId), banInfo);
        }
      }
    } catch (err) {
      console.error('Failed to load bans.json:', err.message);
    }
  }

  /**
   * Save bans to bans.json file
   */
  saveBans() {
    try {
      const obj = {};
      for (const [userId, banInfo] of this.bans.entries()) {
        obj[userId] = banInfo;
      }
      fs.writeFileSync(BANS_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save bans.json:', err.message);
    }
  }

  /**
   * Check if a user is currently banned or restricted
   * @param {number|string} userId 
   * @returns {{ banned: boolean, reason?: string, remainingHours?: number }}
   */
  isBanned(userId) {
    const id = Number(userId);
    if (!this.bans.has(id)) {
      return { banned: false };
    }

    const banInfo = this.bans.get(id);

    // If temporary restriction, check expiration
    if (banInfo.type === 'temp') {
      const now = Date.now();
      if (now > banInfo.expiresAt) {
        // Restriction expired! Auto-unban
        this.bans.delete(id);
        this.saveBans();
        return { banned: false };
      }

      const remainingHours = Math.ceil((banInfo.expiresAt - now) / (1000 * 60 * 60));
      return {
        banned: true,
        type: 'temp',
        reason: banInfo.reason || 'Violation of chat rules',
        remainingHours
      };
    }

    // Permanent ban
    return {
      banned: true,
      type: 'perm',
      reason: banInfo.reason || 'Violation of chat rules'
    };
  }

  /**
   * Permanently ban a user
   * @param {number|string} userId 
   * @param {string} reason 
   */
  banUser(userId, reason = 'Permanent ban by admin') {
    const id = Number(userId);
    this.bans.set(id, {
      type: 'perm',
      reason,
      bannedAt: Date.now()
    });
    this.saveBans();
  }

  /**
   * Temporarily restrict a user for X hours
   * @param {number|string} userId 
   * @param {number} hours 
   * @param {string} reason 
   */
  restrictUser(userId, hours, reason = 'Temporary restriction by admin') {
    const id = Number(userId);
    const expiresAt = Date.now() + hours * 60 * 60 * 1000;
    this.bans.set(id, {
      type: 'temp',
      expiresAt,
      hours,
      reason,
      bannedAt: Date.now()
    });
    this.saveBans();
  }

  /**
   * Unban a user
   * @param {number|string} userId 
   * @returns {boolean}
   */
  unbanUser(userId) {
    const id = Number(userId);
    if (this.bans.has(id)) {
      this.bans.delete(id);
      this.saveBans();
      return true;
    }
    return false;
  }

  /**
   * Get all active banned users
   * @returns {Array<{ userId: number, type: string, reason: string, remainingHours?: number }>}
   */
  getBannedList() {
    const list = [];
    for (const [userId] of this.bans.keys()) {
      const check = this.isBanned(userId);
      if (check.banned) {
        list.push({
          userId,
          type: check.type,
          reason: check.reason,
          remainingHours: check.remainingHours
        });
      }
    }
    return list;
  }
}

module.exports = new AdminManager();

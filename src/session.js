/**
 * Active Session Manager for Mallu Match Bot
 * Keeps track of paired users and active chat connections
 */
class SessionManager {
  constructor() {
    // Map of userId -> partnerId
    this.activeSessions = new Map();
    // Total matches created since server start
    this.totalMatches = 0;
  }

  /**
   * Connect two users in a 1-on-1 chat session
   * @param {number|string} user1 
   * @param {number|string} user2 
   */
  createSession(user1, user2) {
    this.activeSessions.set(user1, user2);
    this.activeSessions.set(user2, user1);
    this.totalMatches++;
  }

  /**
   * Get the connected partner ID of a user
   * @param {number|string} userId 
   * @returns {number|string|null}
   */
  getPartner(userId) {
    return this.activeSessions.get(userId) || null;
  }

  /**
   * Check if a user is currently in an active chat
   * @param {number|string} userId 
   * @returns {boolean}
   */
  isInChat(userId) {
    return this.activeSessions.has(userId);
  }

  /**
   * End session for a user and their connected partner
   * @param {number|string} userId 
   * @returns {number|string|null} Returns the disconnected partner ID
   */
  endSession(userId) {
    const partnerId = this.activeSessions.get(userId);
    if (partnerId) {
      this.activeSessions.delete(userId);
      this.activeSessions.delete(partnerId);
      return partnerId;
    }
    return null;
  }

  /**
   * Get current active ongoing chat count (pairs)
   * @returns {number}
   */
  getActiveChatPairsCount() {
    return Math.floor(this.activeSessions.size / 2);
  }

  /**
   * Get total matches created count
   * @returns {number}
   */
  getTotalMatchesCount() {
    return this.totalMatches;
  }
}

module.exports = new SessionManager();

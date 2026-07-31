/**
 * Matchmaking Queue Manager for Mallu Match Bot
 */
class MatchQueue {
  constructor() {
    this.queue = [];
  }

  /**
   * Add a user to the waiting queue or match them immediately if someone is waiting
   * @param {number|string} userId 
   * @returns {{ matched: boolean, partnerId?: number|string }}
   */
  addToQueue(userId) {
    // Remove if user is somehow already in queue to prevent self-matching
    this.removeFromQueue(userId);

    if (this.queue.length > 0) {
      const partnerId = this.queue.shift();
      return { matched: true, partnerId };
    }

    this.queue.push(userId);
    return { matched: false };
  }

  /**
   * Remove user from waiting queue
   * @param {number|string} userId 
   * @returns {boolean}
   */
  removeFromQueue(userId) {
    const index = this.queue.indexOf(userId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if user is currently waiting in queue
   * @param {number|string} userId 
   * @returns {boolean}
   */
  isInQueue(userId) {
    return this.queue.includes(userId);
  }

  /**
   * Get total count of waiting users
   * @returns {number}
   */
  getQueueLength() {
    return this.queue.length;
  }
}

module.exports = new MatchQueue();

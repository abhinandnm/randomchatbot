/**
 * AI Companion / Simulated Partner Generator for Mallu Chat
 * Provides instant friendly chat responses with rotating personalities when no human users are waiting.
 */

const PERSONALITIES = [
  {
    name: 'Rahul (Kochi)',
    greeting: 'Hey! What’s up? Rahul here from Kochi 👋',
    topics: ['movies', 'tech', 'music', 'food'],
    responses: [
      'Nice! What do you usually do in your free time?',
      'Awesome! Seen any good Malayalam movies lately?',
      'Haha true! Kochi rainy weather has been crazy today 🌧',
      'That sounds really cool! Tell me more about it.',
      'Glad we got connected! Always fun meeting random Malayalis here ✨'
    ]
  },
  {
    name: 'Ananya (Trivandrum)',
    greeting: 'Hello! Ananya from Tvpm here ✨ How is your day going?',
    topics: ['books', 'travel', 'tea', 'music'],
    responses: [
      'Oh nice! Are you a tea or coffee person? ☕',
      'Haha I totally agree with you on that!',
      'I love listening to music while relaxing. Any song recommendations?',
      'That’s so interesting! I’m currently studying and taking a short study break.',
      'Nice talking to you! What part of Kerala are you from?'
    ]
  },
  {
    name: 'Arjun (Kozhikode)',
    greeting: 'Machane! Arjun here from Kozhikode ⚽ Biriyani & Football fan!',
    topics: ['football', 'food', 'travel', 'sports'],
    responses: [
      'Machane! Have you tried Kozhikode Biriyani? Best in the world! 🍗',
      'Haha epic! Who is your favorite football team?',
      'Nice one bro! What are your plans for the weekend?',
      'Totally! Nothing beats chilling with good food and good music.',
      'Super machane! Glad to connect with you!'
    ]
  },
  {
    name: 'Meera (Thrissur)',
    greeting: 'Hey there! Meera from Thrissur 🎨 How are you doing today?',
    topics: ['art', 'photography', 'culture', 'nature'],
    responses: [
      'Hey! Thrissur Pooram vibes are always amazing 🎉 Have you ever visited Thrissur?',
      'That’s really nice! I love photography and creative hobbies.',
      'Haha true! Kerala monsoons are aesthetic for photos 📸',
      'Wonderful! What kind of music or movies do you like?',
      'It’s great chatting with friendly people here!'
    ]
  }
];

class AIPartnerManager {
  constructor() {
    // Map of userId -> { personaIndex: number, stepIndex: number }
    this.userAISessions = new Map();
    // Admin toggle for AI bot companion fallback (default: true)
    this.aiEnabled = true;
  }

  /**
   * Enable or disable AI bot fallback
   * @param {boolean} status 
   */
  setAIEnabled(status) {
    this.aiEnabled = Boolean(status);
  }

  /**
   * Check if AI bot fallback is enabled by admin
   * @returns {boolean}
   */
  isAIEnabled() {
    return this.aiEnabled;
  }

  /**
   * Start an AI chat session for a user with a fresh personality
   * @param {number|string} userId 
   * @returns {{ name: string, greeting: string }}
   */
  startAISession(userId) {
    // Pick a random personality index different from previous if possible
    let personaIndex = Math.floor(Math.random() * PERSONALITIES.length);
    const prevSession = this.userAISessions.get(userId);
    if (prevSession && PERSONALITIES.length > 1) {
      while (personaIndex === prevSession.personaIndex) {
        personaIndex = Math.floor(Math.random() * PERSONALITIES.length);
      }
    }

    this.userAISessions.set(userId, { personaIndex, stepIndex: 0 });
    return PERSONALITIES[personaIndex];
  }

  /**
   * Check if user is currently chatting with an AI partner
   * @param {number|string} userId 
   * @returns {boolean}
   */
  isAIChat(userId) {
    return this.userAISessions.has(userId);
  }

  /**
   * Generate an automated response for the user
   * @param {number|string} userId 
   * @param {string} userMessage 
   * @returns {string}
   */
  generateResponse(userId, userMessage) {
    const session = this.userAISessions.get(userId);
    if (!session) return 'Hey! How are you doing?';

    const persona = PERSONALITIES[session.personaIndex];
    const responses = persona.responses;

    const response = responses[session.stepIndex % responses.length];
    session.stepIndex++;

    return response;
  }

  /**
   * End AI session for a user
   * @param {number|string} userId 
   */
  endAISession(userId) {
    this.userAISessions.delete(userId);
  }
}

module.exports = new AIPartnerManager();

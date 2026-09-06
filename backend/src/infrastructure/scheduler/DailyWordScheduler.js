const cron = require('node-cron');

class DailyWordScheduler {
  constructor(wordRepo, challengeRepo) {
    this.wordRepo      = wordRepo;
    this.challengeRepo = challengeRepo;
  }

  start() {
    cron.schedule('15 18 * * *', () => this._publishDailyWord(), {
      timezone: 'UTC',
    });

    console.log('[Scheduler] Daily word scheduler started. Runs at 18:15 UTC (00:00 NPT).');

    this._publishDailyWord();
  }

  async _publishDailyWord() {
    try {
      const todayNPT = this._getTodayNPT();
      console.log(`[Scheduler] Publishing word for ${todayNPT}`);

      const existing = await this.challengeRepo.findByDate(todayNPT);
      if (existing) {
        console.log(`[Scheduler] Challenge for ${todayNPT} already exists — skipping.`);
        return;
      }

      const word = await this.wordRepo.findUnusedWord(30);
      if (!word) {
        console.error('[Scheduler] ERROR: No unused words available. Fallback: pick any word.');
        const fallback = await this.wordRepo.findRandom();
        if (!fallback) {
          console.error('[Scheduler] CRITICAL: Word list is empty!');
          return;
        }
        const fallbackDb = await this.wordRepo.ensureWordExists(fallback.wordText);
        await this.challengeRepo.create({ wordId: fallbackDb.wordId, challengeDate: todayNPT });
        console.log(`[Scheduler] Fallback word published: ${fallbackDb.wordText}`);
        return;
      }

      await this.challengeRepo.create({ wordId: word.wordId, challengeDate: todayNPT });
      console.log(`[Scheduler] Word published for ${todayNPT}: ${word.wordText}`);

    } catch (err) {
      console.error('[Scheduler] FAILED to publish daily word:', err.message);
    }
  }

  _getTodayNPT() {
    // Nepal Standard Time = UTC + 5:45
    const now     = new Date();
    const utcMs   = now.getTime() + now.getTimezoneOffset() * 60000;
    const nptMs   = utcMs + (5 * 60 + 45) * 60000;
    const nptDate = new Date(nptMs);
    return nptDate.toISOString().slice(0, 10);
  }
}

module.exports = DailyWordScheduler;

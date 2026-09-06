class GetLeaderboardUseCase {
  constructor(leaderboardRepo) {
    this.leaderboardRepo = leaderboardRepo;
  }

  async execute({ userId = null, limit = 20 }) {
    const top = await this.leaderboardRepo.getTopN(limit);

    let userRank = null;
    if (userId) {
      userRank = await this.leaderboardRepo.getUserRank(userId);
    }

    return { leaderboard: top, userRank };
  }
}

module.exports = GetLeaderboardUseCase;

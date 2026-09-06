const crypto = require('crypto');

class ResendVerificationUseCase {
  constructor(userRepo, emailService) {
    this.userRepo     = userRepo;
    this.emailService = emailService;
  }

  async execute({ userId }) {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    if (user.isVerified) {
      return { message: 'Email is already verified.' };
    }

    if (user.verificationExpires) {
      const tokenAge = (24 * 60 * 60 * 1000) - (new Date(user.verificationExpires).getTime() - Date.now());
      if (tokenAge < 60 * 1000) {
        throw Object.assign(
          new Error('Please wait at least 60 seconds before requesting a new verification email.'),
          { statusCode: 429 }
        );
      }
    }

    const verificationToken   = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.userRepo.updateVerification(userId, {
      isVerified:          false,
      verificationToken,
      verificationExpires,
    });

    await this.emailService.sendVerificationEmail(
      user.email,
      user.username,
      verificationToken
    );

    return { message: 'Verification email sent! Check your inbox.' };
  }
}

module.exports = ResendVerificationUseCase;

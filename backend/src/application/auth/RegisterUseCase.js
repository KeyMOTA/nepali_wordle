const crypto = require('crypto');

class RegisterUseCase {
  constructor(userRepo, bcryptService, jwtService, emailService) {
    this.userRepo      = userRepo;
    this.bcryptService = bcryptService;
    this.jwtService    = jwtService;
    this.emailService  = emailService;
  }

  async execute({ email, password, username }) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw Object.assign(new Error('Invalid email format'), { statusCode: 400 });
    }

    if (!password || password.length < 8) {
      throw Object.assign(new Error('Password must be at least 8 characters'), { statusCode: 400 });
    }

    if (!username || username.trim().length < 2) {
      throw Object.assign(new Error('Username must be at least 2 characters'), { statusCode: 400 });
    }

    const sanitizedUsername = username.trim().replace(/<[^>]*>/g, '');

    const existing = await this.userRepo.findByEmail(email.toLowerCase());
    if (existing) {
      throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
    }

    const passwordHash = await this.bcryptService.hash(password);

    const verificationToken   = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.userRepo.create({
      email:               email.toLowerCase(),
      passwordHash,
      username:            sanitizedUsername,
      verificationToken,
      verificationExpires,
    });

    this.emailService.sendVerificationEmail(
      user.email,
      user.username,
      verificationToken
    ).catch(err => {
      console.error('[RegisterUseCase] Email send failed:', err.message);
    });

    const token = this.jwtService.sign({ userId: user.userId, email: user.email });

    return {
      token,
      user: user.toPublic(),
      message: 'Account created! Please check your email to verify your account.',
    };
  }
}

module.exports = RegisterUseCase;

const EmailService = require('../src/infrastructure/email/EmailService');

describe('EmailService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('calls Resend API when RESEND_API_KEY is configured', async () => {
    process.env.RESEND_API_KEY = 'resend_key_123';
    const emailService = new EmailService();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'resend_msg_id' }),
    });

    await emailService.sendVerificationEmail('test@example.com', 'testuser', 'token123');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer resend_key_123',
        }),
      })
    );
  });

  test('falls back to Gmail OAuth2 HTTPS API when SMTP throws an error', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.SMTP_USER = 'user@gmail.com';
    process.env.SMTP_PASS = 'pass123';
    process.env.GMAIL_CLIENT_ID = 'client_id_123';
    process.env.GMAIL_CLIENT_SECRET = 'client_secret_123';
    process.env.GMAIL_REFRESH_TOKEN = 'refresh_token_123';

    const emailService = new EmailService();

    // Mock _getTransporter to simulate SMTP failure (e.g. Railway port 587 block)
    jest.spyOn(emailService, '_getTransporter').mockImplementation(async () => ({
      sendMail: jest.fn().mockRejectedValue(new Error('ETIMEDOUT: Connection to port 587 blocked')),
    }));

    // Mock fetch for Google OAuth2 token and Gmail send API
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'ya29.mock_access_token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'gmail_msg_123' }),
      });

    await emailService.sendVerificationEmail('user@example.com', 'testuser', 'token456');

    // Verify OAuth2 token request
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' })
    );

    // Verify Gmail REST API message send request
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer ya29.mock_access_token',
        }),
      })
    );
  });
});

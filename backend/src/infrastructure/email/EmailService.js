const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8888';
    this.fromAddress = process.env.SMTP_USER || process.env.GMAIL_USER || 'noreply@nepaliwordgame.com';
  }

  /**
   * Resolves the SMTP host to an IPv4 address to prevent IPv6 connection failures
   * on environments like Railway.
   */
  async _getTransporter() {
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);

    let resolvedHost = smtpHost;
    let tlsConfig = {};

    // If it's a hostname (contains alphabetic characters), resolve to IPv4
    if (/[a-zA-Z]/.test(smtpHost)) {
      try {
        const dns = require('dns').promises;
        const addresses = await dns.resolve4(smtpHost);
        if (addresses && addresses.length > 0) {
          // Select a random IPv4 address
          resolvedHost = addresses[Math.floor(Math.random() * addresses.length)];
          tlsConfig = { servername: smtpHost };
          console.log(`[Email] Resolved host ${smtpHost} to IPv4: ${resolvedHost}`);
        }
      } catch (dnsErr) {
        console.warn(`[Email] DNS resolution failed for ${smtpHost}, falling back to original hostname:`, dnsErr.message);
      }
    }

    return nodemailer.createTransport({
      host: resolvedHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: tlsConfig,
    });
  }

  /**
   * Send email using Google Gmail REST API (v1) over HTTPS (port 443) with OAuth2 credentials.
   * Bypasses port 587/25 outbound SMTP blocking on cloud platforms like Railway.
   * Endpoint: https://gmail.googleapis.com/gmail/v1/users/me/messages/send
   */
  async _sendViaGmailOAuth2(toEmail, subject, textContent, htmlContent) {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const userEmail = process.env.GMAIL_USER || process.env.SMTP_USER || this.fromAddress;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Gmail OAuth2 credentials missing (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)');
    }

    console.log('[Email] Fetching Google OAuth2 access token...');

    // 1. Obtain fresh access token from Google OAuth2 token endpoint
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || `Token exchange failed (HTTP ${tokenRes.status})`);
    }

    const accessToken = tokenData.access_token;

    // 2. Construct RFC 2822 MIME message
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

    const rawMessageLines = [
      `From: "Akshara" <${userEmail}>`,
      `To: ${toEmail}`,
      `Subject: ${utf8Subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(textContent).toString('base64'),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(htmlContent).toString('base64'),
      ``,
      `--${boundary}--`,
    ];

    const rawEmail = rawMessageLines.join('\r\n');
    const base64UrlEmail = Buffer.from(rawEmail)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 3. Send message via Gmail REST API v1 endpoint over HTTPS (port 443)
    console.log('[Email] Sending email via Gmail REST API (v1)...');
    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64UrlEmail }),
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok) {
      throw new Error(sendData.error?.message || `Gmail API error (HTTP ${sendRes.status})`);
    }

    console.log(`[Email] Email sent to ${toEmail} via Gmail REST API. Message ID: ${sendData.id}`);
    return sendData;
  }

  /**
   * Multi-tier Email Delivery Pipeline:
   * Tier 1: Resend HTTPS API (if RESEND_API_KEY configured)
   * Tier 2: Nodemailer Standard SMTP (if SMTP_USER and SMTP_PASS configured)
   * Tier 3: Gmail REST API (OAuth2 HTTPS port 443) (if GMAIL_CLIENT_ID / SECRET / REFRESH_TOKEN configured)
   */
  async sendEmail({ toEmail, subject, textContent, htmlContent }) {
    // Tier 1: Resend HTTPS API
    if (process.env.RESEND_API_KEY) {
      try {
        console.log('[Email] Attempting send via Resend HTTPS API...');
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `"Akshara" <${fromEmail}>`,
            to: [toEmail],
            subject,
            html: htmlContent,
            text: textContent,
          }),
        });

        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.message || `HTTP ${response.status}`);
        }
        console.log(`[Email] Email sent to ${toEmail} via Resend. ID: ${resData.id}`);
        return;
      } catch (err) {
        console.warn(`[Email] Resend API failed: ${err.message}. Falling back...`);
      }
    }

    // Tier 2: Standard SMTP
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        console.log('[Email] Attempting send via Standard SMTP...');
        const transporter = await this._getTransporter();
        await transporter.sendMail({
          from: `"Akshara" <${this.fromAddress}>`,
          to: toEmail,
          subject,
          text: textContent,
          html: htmlContent,
        });
        console.log(`[Email] Email sent to ${toEmail} via Standard SMTP`);
        return;
      } catch (err) {
        console.warn(`[Email] Standard SMTP transport failed: ${err.message}. Falling back to Gmail OAuth2 REST API...`);
      }
    }

    // Tier 3: Gmail REST API (OAuth2 HTTPS port 443) - Ultimate Fallback
    if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
      try {
        console.log('[Email] Attempting send via Gmail REST API (OAuth2 HTTPS)...');
        await this._sendViaGmailOAuth2(toEmail, subject, textContent, htmlContent);
        return;
      } catch (err) {
        console.error(`[Email] Gmail REST API (OAuth2) failed: ${err.message}`);
      }
    }

    console.error(`[Email] All email delivery methods failed or no valid credentials configured for ${toEmail}`);
  }

  /**
   * Send email verification link
   * @param {string} toEmail
   * @param {string} username
   * @param {string} verificationToken
   */
  async sendVerificationEmail(toEmail, username, verificationToken) {
    const verifyUrl = `${this.frontendUrl}/?verify=${verificationToken}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#181c27;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6c5ce7,#00b894);padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">अक्षरा</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:0.15em;text-transform:uppercase;">AKSHARA</p>
    </div>
    
    <!-- Body -->
    <div style="padding:32px 28px;">
      <h2 style="color:#f0f2ff;font-size:22px;margin:0 0 12px;">Verify Your Email ✉️</h2>
      <p style="color:#8892b0;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Welcome, <strong style="color:#f0f2ff;">${username}</strong>! Click the button below to verify your email address and start playing.
      </p>
      
      <!-- CTA Button -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${verifyUrl}" 
           style="display:inline-block;background:#6c5ce7;color:#fff;text-decoration:none;padding:14px 40px;border-radius:14px;font-weight:600;font-size:16px;box-shadow:0 0 20px rgba(108,92,231,0.35);">
          Verify Email Address
        </a>
      </div>
      
      <p style="color:#4a5278;font-size:13px;line-height:1.5;margin:0 0 16px;">
        Or copy and paste this link into your browser:
      </p>
      <div style="background:#0f1117;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;word-break:break-all;">
        <a href="${verifyUrl}" style="color:#6c5ce7;font-size:13px;text-decoration:none;">${verifyUrl}</a>
      </div>
      
      <p style="color:#4a5278;font-size:12px;margin:24px 0 0;line-height:1.5;">
        This link expires in <strong style="color:#8892b0;">24 hours</strong>. If you didn't create an account, you can safely ignore this email.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="padding:20px 28px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
      <p style="color:#4a5278;font-size:11px;margin:0;">
        © 2026 Akshara — Tribhuvan University / Texas International College
      </p>
    </div>
  </div>
</body>
</html>`;

    const textContent = `
Verify Your Email — Akshara

Welcome, ${username}! Click the link below to verify your email address:

${verifyUrl}

This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
`;

    await this.sendEmail({
      toEmail,
      subject: '✉️ Verify your email — Akshara',
      textContent,
      htmlContent,
    });
  }
}

module.exports = EmailService;

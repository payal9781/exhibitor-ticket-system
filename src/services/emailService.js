const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false, // ← Allow self-signed certs
    },
  });
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetUrl, userName) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Password Reset Request - Planora',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - Planora</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #334155;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f8fafc;
          }
          .container {
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .header {
            background: linear-gradient(135deg, #C73A33 0%, #E5534B 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.025em;
          }
          .header p {
            margin: 10px 0 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .content {
            padding: 40px;
          }
          .greeting {
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 20px;
          }
          .button-container {
            text-align: center;
            margin: 35px 0;
          }
          .button {
            display: inline-block;
            background-color: #C73A33;
            color: white !important;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 700;
            font-size: 16px;
            transition: background-color 0.2s;
          }
          .link-box {
            background-color: #f1f5f9;
            padding: 16px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            word-break: break-all;
            color: #475569;
            margin: 20px 0;
            border: 1px solid #e2e8f0;
          }
          .warning {
            background-color: #fff7ed;
            border-left: 4px solid #f97316;
            color: #9a3412;
            padding: 16px;
            border-radius: 4px;
            margin: 25px 0;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            padding: 30px;
            color: #94a3b8;
            font-size: 13px;
          }
          .divider {
            height: 1px;
            background-color: #e2e8f0;
            margin: 30px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Planora</h1>
            <p>Password Reset Request</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${userName},</p>
            
            <p>We received a request to reset your password for your Planora account. If you didn't make this request, you can safely ignore this email.</p>
            
            <p>To set a new password, click the button below:</p>
            
            <div class="button-container">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
              <strong>Security Notice:</strong> This link will expire in 10 minutes for your protection. After that, you'll need to submit a new request.
            </div>
            
            <p>If the button doesn't work, copy and paste this URL into your browser:</p>
            <div class="link-box">${resetUrl}</div>
            
            <div class="divider"></div>
            
            <p>Best regards,<br><strong>The Planora Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated message, please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} Planora. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
};

// Send welcome email with credentials
const sendWelcomeEmail = async (name, email, rawPassword) => {
  // Validate SMTP config
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('CRITICAL: SMTP configuration is missing in .env file!');
    console.log('Current SMTP Env:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      secure: process.env.SMTP_SECURE
    });
    return false; // Return false instead of throwing to avoid crashing the app
  }

  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Welcome to Planora - Your Account Details',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Planora</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #334155;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f8fafc;
          }
          .container {
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .header {
            background: linear-gradient(135deg, #C73A33 0%, #E5534B 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.025em;
          }
          .content {
            padding: 40px;
          }
          .greeting {
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 20px;
          }
          .credentials {
            background-color: #f1f5f9;
            padding: 24px;
            border-radius: 12px;
            margin: 30px 0;
            border-left: 4px solid #C73A33;
          }
          .credentials-title {
            font-weight: 700;
            color: #475569;
            margin-bottom: 12px;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.05em;
          }
          .credential-item {
            margin-bottom: 8px;
            font-family: monospace;
            font-size: 16px;
          }
          .button-container {
            text-align: center;
            margin-top: 30px;
          }
          .button {
            display: inline-block;
            background-color: #C73A33;
            color: white !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 700;
            transition: background-color 0.2s;
          }
          .footer {
            text-align: center;
            padding: 30px;
            color: #94a3b8;
            font-size: 13px;
          }
          .divider {
            height: 1px;
            background-color: #e2e8f0;
            margin: 30px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Planora</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${name},</p>
            
            <p>Welcome to Planora! Your account has been successfully created. We're thrilled to have you join our community of elite event organizers.</p>
            
            <p>You can now start managing your events, exhibitors, and attendees with our powerful tools.</p>
            
            <div class="credentials">
              <div class="credentials-title">Your Login Credentials</div>
              <div class="credential-item"><strong>Email:</strong> ${email}</div>
              <div class="credential-item"><strong>Password:</strong> ${rawPassword}</div>
            </div>
            
            <p>For security reasons, we recommend that you change your password after your first login.</p>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || '#'}/login" class="button">Log In to Dashboard</a>
            </div>
            
            <div class="divider"></div>
            
            <p>If you have any questions or need assistance, our support team is always here to help.</p>
            
            <p>Best regards,<br><strong>The Planora Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Planora. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    console.log(`Attempting to send welcome email to: ${email} using ${process.env.SMTP_HOST}`);
    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', info.messageId);
    console.log('SMTP Response:', info.response);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};

const sendCustomEmail = async (to, subject, htmlContent, recipientName = 'User') => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('CRITICAL: SMTP configuration is missing in .env file!');
    return { success: false, message: 'SMTP not configured' };
  }

  if (!to || !to.trim()) {
    return { success: false, message: 'No email address' };
  }

  const transporter = createTransporter();
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: to.trim(),
    subject: subject || 'Notification from Planora',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject || 'Planora Notification'}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc; }
          .container { margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #C73A33 0%, #E5534B 100%); color: white; padding: 32px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
          .content { padding: 32px; }
          .greeting { font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 16px; }
          .footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Planora</h1></div>
          <div class="content">
            <p class="greeting">Hello ${recipientName},</p>
            ${htmlContent}
            <p style="margin-top: 24px;">Best regards,<br><strong>The Planora Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated message from Planora Admin.</p>
            <p>&copy; ${new Date().getFullYear()} Planora. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending custom email:', error);
    return { success: false, message: error.message };
  }
};

// Organizer self-registration: account pending admin approval
const sendOrganizerRegistrationPendingEmail = async (name, email, organizationName) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('CRITICAL: SMTP configuration is missing in .env file!');
    return false;
  }

  const transporter = createTransporter();
  const loginUrl = `${process.env.FRONTEND_URL || '#'}/login`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Planora — Organizer registration received',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registration Received - Planora</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; background-color: #f8fafc; }
          .container { margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #C73A33 0%, #E5534B 100%); color: white; padding: 36px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 26px; font-weight: 800; }
          .content { padding: 36px; }
          .greeting { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; }
          .info-box { background-color: #fff7ed; border-left: 4px solid #f97316; padding: 16px; border-radius: 4px; margin: 24px 0; color: #9a3412; font-size: 14px; }
          .detail { margin: 8px 0; font-size: 15px; }
          .footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Planora</h1></div>
          <div class="content">
            <p class="greeting">Hello ${name},</p>
            <p>Thank you for registering as an organizer on Planora. We have received your application.</p>
            <div class="detail"><strong>Organization:</strong> ${organizationName || '—'}</div>
            <div class="detail"><strong>Email:</strong> ${email}</div>
            <div class="info-box">
              <strong>Pending approval:</strong> Your account is currently inactive. A super admin will review and activate your account. You will receive another email when you can sign in.
            </div>
            <p>Once approved, you can log in here: <a href="${loginUrl}">${loginUrl}</a></p>
            <p>Best regards,<br><strong>The Planora Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} Planora. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Organizer pending registration email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending organizer pending registration email:', error);
    return false;
  }
};

// Organizer account approved / activated by admin
const sendOrganizerAccountApprovedEmail = async (name, email) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('CRITICAL: SMTP configuration is missing in .env file!');
    return false;
  }

  const transporter = createTransporter();
  const loginUrl = `${process.env.FRONTEND_URL || '#'}/login`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Planora — Your organizer account is now active',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Approved - Planora</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; background-color: #f8fafc; }
          .container { margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #C73A33 0%, #E5534B 100%); color: white; padding: 36px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 26px; font-weight: 800; }
          .content { padding: 36px; }
          .greeting { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; }
          .success-box { background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 4px; margin: 24px 0; color: #166534; font-size: 14px; }
          .button { display: inline-block; background-color: #C73A33; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; margin-top: 16px; }
          .footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>Planora</h1></div>
          <div class="content">
            <p class="greeting">Hello ${name},</p>
            <div class="success-box">
              <strong>Good news!</strong> Your organizer account has been approved and activated. You can now sign in to Planora.
            </div>
            <p>Use the email address you registered with and your password to access your dashboard.</p>
            <p style="text-align: center;"><a href="${loginUrl}" class="button">Log in to Planora</a></p>
            <p>Best regards,<br><strong>The Planora Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} Planora. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Organizer account approved email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending organizer account approved email:', error);
    return false;
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendOrganizerRegistrationPendingEmail,
  sendOrganizerAccountApprovedEmail,
  testEmailConfig,
  sendCustomEmail,
};
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
        <title>Password Reset</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Planora</h1>
          <h2>Password Reset Request</h2>
        </div>
        
        <div class="content">
          <p>Hello ${userName},</p>
          
          <p>We received a request to reset your password for your Planora account. If you didn't make this request, you can safely ignore this email.</p>
          
          <p>To reset your password, click the button below:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">${resetUrl}</p>
          
          <div class="warning">
            <strong>Important:</strong> This link will expire in 10 minutes for security reasons. If you need to reset your password after this time, please request a new reset link.
          </div>
          
          <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>
          
          <p>Best regards,<br>The Planora Team</p>
        </div>
        
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>If you need help, please contact our support team.</p>
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

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  testEmailConfig
};
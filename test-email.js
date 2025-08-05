// Test script for email configuration
require('dotenv').config();
const emailService = require('./src/services/emailService');

async function testEmail() {
  console.log('Testing email configuration...');
  console.log('SMTP Settings:');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('User:', process.env.SMTP_USER);
  console.log('Secure:', process.env.SMTP_SECURE);
  console.log('Pass length:', process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 'Not set');
  
  // Test email config
  const configValid = await emailService.testEmailConfig();
  if (!configValid) {
    console.log('❌ Email configuration is invalid');
    return;
  }
  
  console.log('✅ Email configuration is valid');
  
  // Test sending email (uncomment to test actual email sending)
  try {
    await emailService.sendPasswordResetEmail(
      'augmentobusiness@gmail.com', 
      'http://localhost:5173/reset-password/test-token',
      'Test User'
    );
    console.log('✅ Test email sent successfully');
  } catch (error) {
    console.log('❌ Failed to send test email:', error.message);
    console.log('Full error:', error);
  }
}

testEmail();
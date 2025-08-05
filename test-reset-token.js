// Test script to generate a valid reset token for testing
require('dotenv').config();
const connectDB = require('./src/config/database');
const Organizer = require('./src/models/Organizer');
const Superadmin = require('./src/models/Superadmin');
const crypto = require('crypto');

async function generateTestResetToken() {
  console.log('Connecting to database...');
  await connectDB();
  
  try {
    // Try to find an existing organizer or superadmin
    let user = await Organizer.findOne({});
    let userType = 'organizer';
    
    if (!user) {
      user = await Superadmin.findOne({});
      userType = 'superadmin';
    }
    
    if (!user) {
      console.log('❌ No users found in database');
      console.log('Please create a user first or check your database connection');
      return;
    }
    
    console.log(`✅ Found ${userType}:`, user.email);
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour from now
    
    // Update user with reset token
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();
    
    console.log('✅ Reset token generated successfully!');
    console.log('User Email:', user.email);
    console.log('Reset Token:', resetToken);
    console.log('Expires At:', new Date(resetTokenExpiry).toISOString());
    console.log('');
    console.log('🔗 Test URL:');
    console.log(`http://localhost:5173/reset-password/${resetToken}`);
    console.log('');
    console.log('⚡ API Test Command:');
    console.log(`Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/verify-reset-token" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"token":"${resetToken}"}'`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    process.exit(0);
  }
}

generateTestResetToken();
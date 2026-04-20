const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  OTP_SECRET: process.env.OTP_SECRET,
  NODE_ENV: process.env.NODE_ENV || 'development'
};
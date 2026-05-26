const mongoose = require('mongoose');

const otpSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'default',
      unique: true,
    },
    bypassOtpEnabled: {
      type: Boolean,
      default: true,
    },
    bypassOtp: {
      type: String,
      default: '2345',
    },
    bypassNumbers: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.OtpSettings || mongoose.model('OtpSettings', otpSettingsSchema);

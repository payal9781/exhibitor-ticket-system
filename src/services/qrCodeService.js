const QRCode = require('qrcode');
const asyncHandler = require('../utils/asyncHandler');

const generateQRCode = asyncHandler(async (data) => {
  try {
    return await QRCode.toDataURL(data);
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
});

module.exports = { generateQRCode };
const QRCode = require('qrcode'); // Assume installed
const generateQR = async (data) => {
  try {
    return await QRCode.toDataURL(JSON.stringify(data));
  } catch (err) {
    throw new Error('QR generation failed');
  }
};
module.exports = generateQR;
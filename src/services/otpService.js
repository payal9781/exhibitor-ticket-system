const axios = require('axios');
const otpService = async (mobile, otp) => {
  const bypassNumbers = ['9316755406', '9876543210', '1234567890']; // Add your 3 numbers here
  if (bypassNumbers.includes(mobile)) {
    console.log(`:construction: Bypassing OTP for test number: ${mobile}`);
    return true; // Simulate success
  }
  const apiKey = process.env.FACTOR_KEY;
  const templateName = process.env.FACTOR_TEMPLATE_NAME;
  const url = `https://2factor.in/API/V1/${apiKey}/SMS/${mobile}/${otp}/${templateName}`;
  try {
    const response = await axios.get(url);
    if (response.data.Status === 'Success') {
      console.log(':white_check_mark: OTP sent successfully');
      return true;
    } else {
      console.error(':x: Failed to send OTP:', response.data);
      return false;
    }
  } catch (err) {
    console.error(':x: Error sending OTP via 2Factor:', err.message);
    return false;
  }
};
module.exports = otpService;
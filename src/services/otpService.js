const axios = require('axios');
const otpService = async (mobile, otp) => {
    // const bypassNumbers = process.env.bypassNumber;
    // if (bypassNumbers.includes(mobile)) {
    //     console.log(`:construction: Bypassing OTP for test number: ${mobile}`);
    //     return true; // Simulate success
    // }
    const apiKey = process.env.FACTOR_KEY;
    const templateName = process.env.FACTOR_TEMPLATE_NAME;
    // const url = `https://2factor.in/API/V1/${apiKey}/SMS/${mobile}/${otp}/${templateName}`;
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
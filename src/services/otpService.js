const axios = require('axios');
const { models } = require('./../models/z-index');

class OTPService {
    constructor() {
        // SMS Provider Configuration
        this.smsApiKey = process.env.SMS_API_KEY;
        this.smsSender = process.env.SMS_SENDER;
        this.smsRoute = process.env.SMS_ROUTE;
        this.smsBaseUrl = process.env.SMS_BASE_URL;
        
        // OTP Configuration
        this.otpExpiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
        this.bypassOTP = process.env.BYPASS_OTP || '2345';
        this.settingsCache = null;
        
        // Load bypass numbers
        this.bypassNumbers = [];
        this.refreshBypassNumbers();
    }

    async getSettings() {
        if (this.settingsCache) {
            return this.settingsCache;
        }

        let settings = await models.OtpSettings.findOne({ key: 'default' });

        if (!settings) {
            settings = await models.OtpSettings.create({
                key: 'default',
                bypassOtpEnabled: true,
                bypassOtp: this.bypassOTP,
            });
        }

        this.settingsCache = {
            bypassOtpEnabled: settings.bypassOtpEnabled,
            bypassOtp: settings.bypassOtp || this.bypassOTP,
            bypassNumbers: settings.bypassNumbers || [],
        };

        return this.settingsCache;
    }

    async updateSettings(updates) {
        const settings = await models.OtpSettings.findOneAndUpdate(
            { key: 'default' },
            {
                $set: updates,
                $setOnInsert: {
                    key: 'default',
                },
            },
            { new: true, upsert: true }
        );

        this.settingsCache = {
            bypassOtpEnabled: settings.bypassOtpEnabled,
            bypassOtp: settings.bypassOtp || this.bypassOTP,
            bypassNumbers: settings.bypassNumbers || [],
        };

        return this.settingsCache;
    }

    clearSettingsCache() {
        this.settingsCache = null;
    }

    refreshBypassNumbers() {
        if (process.env.BYPASS_NUMBERS) {
            try {
                this.bypassNumbers = process.env.BYPASS_NUMBERS.split(',')
                    .map(num => num.trim())
                    .filter(num => num.length > 0);
                console.log('Loaded bypass numbers:', this.bypassNumbers);
            } catch (error) {
                console.error('Error parsing BYPASS_NUMBERS:', error);
            }
        }
    }

    _isNumberInBypassList(mobileNo) {
        const normalizedNumber = mobileNo.toString().trim();
        // Check exact match, and also check if the number ends with the bypass number (for country code handling)
        return this.bypassNumbers.includes(normalizedNumber) || 
               this.bypassNumbers.some(num => normalizedNumber.endsWith(num));
    }

    async _sendSMS(mobileNo, otpValue) {
        // Cleaning number for SMS gateway (ensuring it has 91 if it's 10 digits)
        let cleanMobile = mobileNo.toString().replace(/\D/g, '');
        if (cleanMobile.length === 10) {
            cleanMobile = '91' + cleanMobile;
        }

        const message = `Your OTP for GBS is ${otpValue}. This password would be valid for 5 minutes only.\nFLASHB`;
        const encodedMessage = encodeURIComponent(message);
        
        const url = `${this.smsBaseUrl}?apikey=${this.smsApiKey}&route=${this.smsRoute}&sender=${this.smsSender}&mobileno=${cleanMobile}&text=${encodedMessage}`;
        
        console.log("[OTP] SMS API URL:", url.replace(this.smsApiKey, 'HIDDEN'));
        
        try {
            const response = await axios.get(url);
            console.log("[OTP] SMS API Response:", response.data);
            
            if (response.data.status === 'success') {
                return {
                    success: true,
                    message: 'SMS sent successfully',
                    data: response.data
                };
            } else {
                return {
                    success: false,
                    message: response.data.message || 'Failed to send SMS'
                };
            }
        } catch (error) {
            console.error('[OTP] Error sending SMS:', error.message);
            return {
                success: false,
                message: `Failed to send SMS: ${error.message}`
            };
        }
    }

    async sendOTP(mobileNo) {
        try {
            const normalizedMobileNo = mobileNo.toString().trim();
            console.log(`[OTP] Processing sendOTP for number: ${normalizedMobileNo}`);
            
            // Refresh in case env changed
            this.refreshBypassNumbers();

            // Check if number is in bypass list
            if (this._isNumberInBypassList(normalizedMobileNo)) {
                console.log(`[OTP] Bypassing OTP for ${normalizedMobileNo}`);
                
                // Delete any existing unused OTPs for this number
                await models.Otp.deleteMany({ 
                    mobileNo: normalizedMobileNo, 
                    isUsed: false,
                    expiresAt: { $gt: new Date() } 
                });

                const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60000);
                const sessionId = `BYPASS-${Date.now()}`;
                
                await models.Otp.create({
                    mobileNo: normalizedMobileNo,
                    sessionId,
                    expiresAt
                });
                
                return {
                    success: true,
                    message: 'OTP bypass enabled for this number',
                    data: {
                        sessionId,
                        expiresAt
                    }
                };
            }
            
            // Delete existing unused OTPs
            await models.Otp.deleteMany({ 
                mobileNo: normalizedMobileNo, 
                isUsed: false,
                expiresAt: { $gt: new Date() } 
            });

            // Generate OTP (4-digit as per GBS message usually, though GBS says 5 mins but 4 digits in Math.floor(1000 + ...))
            const otpValue = Math.floor(1000 + Math.random() * 9000).toString();
            const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60000);
            const sessionId = `SMS-${Date.now()}`;

            // Store OTP record first (as per user's snippet logic)
            const otpRecord = await models.Otp.create({
                mobileNo: normalizedMobileNo,
                otp: otpValue,
                sessionId,
                expiresAt,
                isSent: false
            });

            // Send SMS
            const smsResult = await this._sendSMS(normalizedMobileNo, otpValue);
            
            if (smsResult.success) {
                otpRecord.isSent = true;
                await otpRecord.save();
                
                return {
                    success: true,
                    message: 'OTP sent successfully',
                    data: {
                        sessionId,
                        expiresAt
                    }
                };
            } else {
                // If SMS fails, we still have the record but it's marked as not sent
                console.error(`[OTP] SMS sending failed: ${smsResult.message}`);
                return {
                    success: false,
                    message: smsResult.message
                };
            }
        } catch (error) {
            console.error('[OTP] Error in sendOTP:', error);
            return {
                success: false,
                message: `Failed to send OTP: ${error.message}`
            };
        }
    }
    
    async verifyOTP(mobileNo, otpCode) {
        try {
            const normalizedMobileNo = mobileNo.toString().trim();
            const normalizedOTPCode = otpCode.toString().trim();
            
            console.log(`[OTP] Processing verifyOTP for number: ${normalizedMobileNo}, code: ${normalizedOTPCode}`);
    
            const otpRecord = await models.Otp.findOne({
                mobileNo: normalizedMobileNo,
                isUsed: false,
                expiresAt: { $gt: new Date() }
            }).sort({ createdAt: -1 });
    
            if (!otpRecord) {
                console.log(`[OTP] No valid OTP record found for ${normalizedMobileNo}`);
                return {
                    success: false,
                    message: 'OTP expired or not found'
                };
            }

            const settings = await this.getSettings();

            // Global bypass OTP — works even when a real OTP was sent
            if (settings.bypassOtpEnabled && normalizedOTPCode === settings.bypassOtp) {
                console.log(`[OTP] Global bypass OTP accepted for ${normalizedMobileNo}`);
                otpRecord.isUsed = true;
                await otpRecord.save();
                return {
                    success: true,
                    message: 'OTP verified successfully'
                };
            }
    
            // Bypass OTP verification:
            if (otpRecord.sessionId.startsWith('BYPASS-')) {
                console.log(`[OTP] Processing bypass verification for ${normalizedMobileNo}`);
                
                if (normalizedOTPCode === settings.bypassOtp) {
                    otpRecord.isUsed = true;
                    await otpRecord.save();
                    return {
                        success: true,
                        message: 'OTP bypass verification successful'
                    };
                } else {
                    return {
                        success: false,
                        message: 'Invalid bypass OTP'
                    };
                }
            }
    
            // Normal OTP verification
            if (otpRecord.otp === normalizedOTPCode) {
                otpRecord.isUsed = true;
                await otpRecord.save();
                return {
                    success: true,
                    message: 'OTP verified successfully'
                };
            } else {
                return {
                    success: false,
                    message: 'Invalid OTP'
                };
            }
        } catch (error) {
            console.error('[OTP] Error in verifyOTP:', error);
            return {
                success: false,
                message: 'Internal error during verification'
            };
        }
    }

    async resendOTP(mobileNo) {
        try {
            const normalizedMobileNo = mobileNo.toString().trim();
            console.log(`[OTP] Processing resendOTP for number: ${normalizedMobileNo}`);
            
            await models.Otp.deleteMany({ 
                mobileNo: normalizedMobileNo, 
                isUsed: false,
                expiresAt: { $gt: new Date() } 
            });
          
            return this.sendOTP(normalizedMobileNo);
        } catch (error) {
            console.error('[OTP] Error in resendOTP:', error);
            return {
                success: false,
                message: 'Failed to resend OTP'
            };
        }
    }
}

module.exports = new OTPService();
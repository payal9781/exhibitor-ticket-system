const express = require('express');
const router = express.Router();
const { register, login, loginApp, logout, sendOtp, verifyOtp, forgotPassword, verifyResetToken, resetPassword, getProfile, updateProfile, changePassword } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware.js');
const validator = require('../utils/validator');
const { register: registerValidator, login: loginValidator, loginApp: loginAppValidator, forgotPassword: forgotPasswordValidator, verifyResetToken: verifyResetTokenValidator, resetPassword: resetPasswordValidator } = require('../validators/authValidator');

router.post('/register', validator(registerValidator), register);
router.post('/login', validator(loginValidator), login);
router.post('/login-app', validator(loginAppValidator), loginApp);
router.post('/logout', authMiddleware(), logout);
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/forgot-password', validator(forgotPasswordValidator), forgotPassword);
router.post('/verify-reset-token', validator(verifyResetTokenValidator), verifyResetToken);
router.get('/verify-reset-token/:token', verifyResetToken);
router.get('/reset-password/:token', verifyResetToken); // Alternative route for frontend compatibility
// router.post('/reset-password', validator(resetPasswordValidator), resetPassword);

// Profile management routes
router.post('/profile', authMiddleware(['organizer', 'superAdmin']), getProfile);
router.post('/update-profile', authMiddleware(['organizer', 'superAdmin']), updateProfile);
router.post('/change-password', authMiddleware(['organizer', 'superAdmin']), changePassword);

module.exports = router;
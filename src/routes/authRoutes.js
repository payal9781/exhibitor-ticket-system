const express = require('express');
const router = express.Router();
const { register, login, loginApp, logout, sendOtp, verifyOtp, forgotPassword, verifyResetToken, resetPassword } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware.js');
const validator = require('../utils/validator');
const { register: registerValidator, login: loginValidator, loginApp: loginAppValidator } = require('../validators/authValidator');

router.post('/register', validator(registerValidator), register);
router.post('/login', validator(loginValidator), login);
router.post('/login-app', validator(loginAppValidator), loginApp);
router.post('/logout', authMiddleware(), logout);
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);

module.exports = router;
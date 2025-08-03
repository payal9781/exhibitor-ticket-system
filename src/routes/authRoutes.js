const express = require('express');
const router = express.Router();
const { register, login, logout } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware.js');
const validator = require('../utils/validator');
const { register: registerValidator, login: loginValidator } = require('../validators/authValidator');

router.post('/register', validator(registerValidator), register);
router.post('/login', validator(loginValidator), login);
router.post('/logout', authMiddleware(), logout);

module.exports = router;
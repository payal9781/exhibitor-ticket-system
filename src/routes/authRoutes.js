const express = require('express');
const router = express.Router();
const { register, login, logout } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware.js');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authMiddleware(), logout);

module.exports = router;
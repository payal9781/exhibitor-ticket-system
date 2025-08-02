const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { markAttendance } = require('../controllers/attendanceController');

router.post('/mark', authMiddleware(['organizer']), markAttendance);

module.exports = router;
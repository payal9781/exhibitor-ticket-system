const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  markAttendance, 
  getAttendanceRecords, 
  getAttendanceStatistics,
  checkInUser,
  checkOutUser
} = require('../controllers/attendanceController');

// Original route
router.post('/mark', authMiddleware(['organizer']), markAttendance);

// New comprehensive routes
router.post('/records', authMiddleware(['organizer', 'superAdmin']), getAttendanceRecords);
router.post('/statistics', authMiddleware(['organizer', 'superAdmin']), getAttendanceStatistics);
router.post('/check-in', authMiddleware(['organizer', 'superAdmin']), checkInUser);
router.post('/check-out', authMiddleware(['organizer', 'superAdmin']), checkOutUser);

module.exports = router;
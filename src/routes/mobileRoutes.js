const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  getTotalConnections,
  getEventConnections,
  getAttendedEvents,
  recordScan,
  getScanStatistics
} = require('../controllers/mobileController');

// Mobile app routes for exhibitors and visitors
router.post('/total-connections', authMiddleware(['exhibitor', 'visitor']), getTotalConnections);
router.post('/event-connections', authMiddleware(['exhibitor', 'visitor']), getEventConnections);
router.post('/attended-events', authMiddleware(['exhibitor', 'visitor']), getAttendedEvents);
router.post('/record-scan', authMiddleware(['exhibitor', 'visitor']), recordScan);
router.post('/scan-statistics', authMiddleware(['exhibitor', 'visitor']), getScanStatistics);

module.exports = router;
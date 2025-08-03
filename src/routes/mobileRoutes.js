const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  getTotalConnections,
  getEventConnections,
  getAttendedEvents,
  recordScan,
  getScanStatistics,
  getScannedUserSlots,
  sendMeetingRequest,
  getPendingMeetingRequests,
  respondToMeetingRequest,
  getConfirmedMeetings,
  toggleSlotVisibility,
  getMySlotStatus
} = require('../controllers/mobileController');

// Mobile app routes for exhibitors and visitors

// Connection and scanning routes
router.post('/total-connections', authMiddleware(['exhibitor', 'visitor']), getTotalConnections);
router.post('/event-connections', authMiddleware(['exhibitor', 'visitor']), getEventConnections);
router.post('/attended-events', authMiddleware(['exhibitor', 'visitor']), getAttendedEvents);
router.post('/record-scan', authMiddleware(['exhibitor', 'visitor']), recordScan);
router.post('/scan-statistics', authMiddleware(['exhibitor', 'visitor']), getScanStatistics);

// Slot and meeting management routes
router.post('/scanned-user-slots', authMiddleware(['exhibitor', 'visitor']), getScannedUserSlots);
router.post('/send-meeting-request', authMiddleware(['exhibitor', 'visitor']), sendMeetingRequest);
router.post('/pending-meeting-requests', authMiddleware(['exhibitor', 'visitor']), getPendingMeetingRequests);
router.post('/respond-meeting-request', authMiddleware(['exhibitor', 'visitor']), respondToMeetingRequest);
router.post('/confirmed-meetings', authMiddleware(['exhibitor', 'visitor']), getConfirmedMeetings);
router.post('/toggle-slot-visibility', authMiddleware(['exhibitor', 'visitor']), toggleSlotVisibility);
router.post('/my-slot-status', authMiddleware(['exhibitor', 'visitor']), getMySlotStatus);

module.exports = router;
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  getTotalConnections,
  getEventConnections,
  getMyRegisteredEvents,
  getAttendedEvents,
  recordScan,
  getScanStatistics,
  getScannedUserSlots,
  sendMeetingRequest,
  getPendingMeetingRequests,
  respondToMeetingRequest,
  getConfirmedMeetings,
  getMobileDashboard,
  getMyProfile,
  updateMyProfile,
  toggleSlotVisibility,
  getMySlotStatus,
  getSchedules
} = require('../controllers/mobileController');

// Mobile app routes for exhibitors and visitors

// Dashboard route
router.post('/dashboard', authMiddleware(['exhibitor', 'visitor']), getMobileDashboard);

// Connection and scanning routes
router.post('/total-connections', authMiddleware(['exhibitor', 'visitor']), getTotalConnections);
router.post('/event-connections', authMiddleware(['exhibitor', 'visitor']), getEventConnections);
router.post('/my-registered-events', authMiddleware(['exhibitor', 'visitor']), getMyRegisteredEvents);
router.post('/attended-events', authMiddleware(['exhibitor', 'visitor']), getAttendedEvents);
router.post('/record-scan', authMiddleware(['exhibitor', 'visitor']), recordScan);
router.post('/scan-statistics', authMiddleware(['exhibitor', 'visitor']), getScanStatistics);

// Profile management routes
router.post('/my-profile', authMiddleware(['exhibitor', 'visitor']), getMyProfile);
router.post('/update-profile', authMiddleware(['exhibitor', 'visitor']), updateMyProfile);

router.post('/get-schedules', authMiddleware(['exhibitor', 'visitor']), getSchedules);
// Slot and meeting management routes
router.post('/scanned-user-slots', authMiddleware(['exhibitor', 'visitor']), getScannedUserSlots);
router.post('/send-meeting-request', authMiddleware(['exhibitor', 'visitor']), sendMeetingRequest);
router.post('/pending-meeting-requests', authMiddleware(['exhibitor', 'visitor']), getPendingMeetingRequests);
router.post('/respond-meeting-request', authMiddleware(['exhibitor', 'visitor']), respondToMeetingRequest);
router.post('/confirmed-meetings', authMiddleware(['exhibitor', 'visitor']), getConfirmedMeetings);
router.post('/toggle-slot-visibility', authMiddleware(['exhibitor', 'visitor']), toggleSlotVisibility);
router.post('/my-slot-status', authMiddleware(['exhibitor', 'visitor']), getMySlotStatus);

module.exports = router;
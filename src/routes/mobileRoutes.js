const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  getTotalConnections,
  getEventConnections,
  getMyRegisteredEvents,
  getAttendedEvents,
  getEventAnalytics,
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
  getSchedules,
  getAllMeetings,
  getAllUsersForEvent,
  getScans,
} = require('../controllers/mobileController');
const constants = require('../config/constants');

const { createLead,
    getLeads,
    updateLead,
    deleteLead } = require('../controllers/leadController');
// Import sponsor functionality from event controller
const { getSponsors } = require('../controllers/eventController');

// Import category functionality from category controller
const { getCategories } = require('../controllers/categoryController');

// Mobile app routes for exhibitors and visitors

// Dashboard route
router.post('/dashboard', authMiddleware(['exhibitor', 'visitor']), getMobileDashboard);
router.post('/analytics', authMiddleware, getEventAnalytics);
// Connection and scanning routes
router.post('/total-connections', authMiddleware(['exhibitor', 'visitor']), getTotalConnections);
router.post('/total-connections', authMiddleware(['exhibitor', 'visitor']), getEventAnalytics);
router.post('/event-connections', authMiddleware(['exhibitor', 'visitor']), getEventConnections);
router.post('/my-registered-events', authMiddleware(['exhibitor', 'visitor']), getMyRegisteredEvents);
router.post('/attended-events', authMiddleware(['exhibitor', 'visitor']), getAttendedEvents);
router.post('/record-scan', authMiddleware(['exhibitor', 'visitor']), recordScan);
router.post('/scan-statistics', authMiddleware(['exhibitor', 'visitor']), getScanStatistics);

// Profile management routes
router.post('/my-profile', authMiddleware(['exhibitor', 'visitor']), getMyProfile);
const upload = require('../config/multerConfig').upload;
router.post('/update-profile', authMiddleware(['exhibitor', 'visitor']), upload(constants.PROFILE_PATH).single("profileImage"),updateMyProfile);

router.post('/get-schedules', authMiddleware(['exhibitor', 'visitor']), getSchedules);
router.post('/get-all-connections-for-event', authMiddleware(['exhibitor', 'visitor']), getAllUsersForEvent);

// Event-related routes
router.post('/get-sponsors', authMiddleware(['exhibitor', 'visitor']), getSponsors);
router.post('/get-categories', authMiddleware(['exhibitor', 'visitor']), getCategories);

// Slot and meeting management routes
router.post('/scanned-user-slots', authMiddleware(['exhibitor', 'visitor']), getScannedUserSlots);
router.post('/send-meeting-request', authMiddleware(['exhibitor', 'visitor']), sendMeetingRequest);
router.post('/pending-meeting-requests', authMiddleware(['exhibitor', 'visitor']), getPendingMeetingRequests);
router.post('/respond-meeting-request', authMiddleware(['exhibitor', 'visitor']), respondToMeetingRequest);
router.post('/confirmed-meetings', authMiddleware(['exhibitor', 'visitor']), getConfirmedMeetings);
router.post('/toggle-slot-visibility', authMiddleware(['exhibitor', 'visitor']), toggleSlotVisibility);
router.post('/my-slot-status', authMiddleware(['exhibitor', 'visitor']), getMySlotStatus);
router.post('/get-all-meetings', authMiddleware(['exhibitor', 'visitor']), getAllMeetings);
router.post('/get-scanuser-eventwise', authMiddleware(['exhibitor', 'visitor']), getScans);

//leads
router.post('/get-leads', authMiddleware(['exhibitor','visitor']), getLeads);
router.post('/create-lead', authMiddleware(['exhibitor','visitor']), createLead);
router.post('/update-lead', authMiddleware(['exhibitor','visitor']), updateLead);
router.post('/delete-lead', authMiddleware(['exhibitor','visitor']), deleteLead);
module.exports = router;
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  getMyProfile,
  updateMyProfile,
  getMyEvents,
  getMyEventStats,
  getMyEventSlots,
  toggleMySlotVisibility,
  getMyEventMeetings,
  getMyPendingRequests,
  respondToMeetingRequest
} = require('../controllers/visitorController');

// Profile management
router.post('/profile', authMiddleware(['visitor']), getMyProfile);
router.post('/profile/update', authMiddleware(['visitor']), updateMyProfile);

// Event management
router.post('/events', authMiddleware(['visitor']), getMyEvents);
router.post('/events/stats', authMiddleware(['visitor']), getMyEventStats);

// Slot management
router.post('/slots', authMiddleware(['visitor']), getMyEventSlots);
router.post('/slots/toggle-visibility', authMiddleware(['visitor']), toggleMySlotVisibility);

// Meeting management
router.post('/meetings', authMiddleware(['visitor']), getMyEventMeetings);
router.post('/meetings/pending', authMiddleware(['visitor']), getMyPendingRequests);
router.post('/meetings/respond', authMiddleware(['visitor']), respondToMeetingRequest);

module.exports = router;
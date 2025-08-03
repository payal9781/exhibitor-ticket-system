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
} = require('../controllers/exhibitorController');

// Profile management
router.post('/profile', authMiddleware(['exhibitor']), getMyProfile);
router.post('/profile/update', authMiddleware(['exhibitor']), updateMyProfile);

// Event management
router.post('/events', authMiddleware(['exhibitor']), getMyEvents);
router.post('/events/stats', authMiddleware(['exhibitor']), getMyEventStats);

// Slot management
router.post('/slots', authMiddleware(['exhibitor']), getMyEventSlots);
router.post('/slots/toggle-visibility', authMiddleware(['exhibitor']), toggleMySlotVisibility);

// Meeting management
router.post('/meetings', authMiddleware(['exhibitor']), getMyEventMeetings);
router.post('/meetings/pending', authMiddleware(['exhibitor']), getMyPendingRequests);
router.post('/meetings/respond', authMiddleware(['exhibitor']), respondToMeetingRequest);

module.exports = router;
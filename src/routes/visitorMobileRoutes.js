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
  respondToMeetingRequest,
  updateProfileImage
} = require('../controllers/visitorController');
const constants = require('../config/constants');
const upload = require('../config/multerConfig').upload;
const { listIndustrySectorsForMobile } = require('../controllers/industrySectorController');

// Industry sectors (for profile selection)
router.post('/industry-sectors/list', authMiddleware(['visitor']), listIndustrySectorsForMobile);

// Profile management
router.post('/profile', authMiddleware(['visitor']), getMyProfile);
router.post('/profile/update', authMiddleware(['visitor']), updateMyProfile);
router.post('/profile/update-image', authMiddleware(['visitor']), upload(constants.PROFILE_PATH).single("profileImage"), updateProfileImage);

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
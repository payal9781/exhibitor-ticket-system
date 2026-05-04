const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  toggleShowSlots, 
  getUserSlots, 
  requestMeeting, 
  respondToMeeting,
  getUserMeetingsByDate,
  cancelMeeting,
  getAllMeetingsAdmin,
  getEventSlotBookings
} = require('../controllers/meetingController');

router.post('/toggle', authMiddleware(['exhibitor', 'visitor']), toggleShowSlots);
router.post('/slots', authMiddleware(['exhibitor', 'visitor']), getUserSlots);
router.post('/request', authMiddleware(['exhibitor', 'visitor']), requestMeeting);
router.post('/respond', authMiddleware(['exhibitor', 'visitor']), respondToMeeting);
router.post('/by-date', authMiddleware(['exhibitor', 'visitor']), getUserMeetingsByDate);
router.post('/cancel', authMiddleware(['exhibitor', 'visitor']), cancelMeeting);

// Admin routes
router.post('/admin/all', authMiddleware(['organizer', 'superAdmin']), getAllMeetingsAdmin);
router.post('/admin/event-bookings', authMiddleware(['organizer', 'superAdmin']), getEventSlotBookings);

module.exports = router;
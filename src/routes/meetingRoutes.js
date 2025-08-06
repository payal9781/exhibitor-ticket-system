const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  toggleShowSlots, 
  getUserSlots, 
  requestMeeting, 
  respondToMeeting,
  getUserMeetingsByDate,
  cancelMeeting
} = require('../controllers/meetingController');

router.post('/toggle', authMiddleware(['exhibitor', 'visitor']), toggleShowSlots);
router.post('/slots', authMiddleware(['exhibitor', 'visitor']), getUserSlots);
router.post('/request', authMiddleware(['exhibitor', 'visitor']), requestMeeting);
router.post('/respond', authMiddleware(['exhibitor', 'visitor']), respondToMeeting);
router.post('/by-date', authMiddleware(['exhibitor', 'visitor']), getUserMeetingsByDate);
router.post('/cancel', authMiddleware(['exhibitor', 'visitor']), cancelMeeting);

module.exports = router;
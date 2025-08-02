const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { toggleShowSlots, getUserSlots, requestMeeting, respondToMeeting } = require('../controllers/meetingController');

router.post('/toggle', authMiddleware(['exhibitor', 'visitor']), toggleShowSlots);
router.post('/slots', authMiddleware(['exhibitor', 'visitor']), getUserSlots);
router.post('/request', authMiddleware(['exhibitor', 'visitor']), requestMeeting);
router.post('/respond', authMiddleware(['exhibitor', 'visitor']), respondToMeeting);

module.exports = router;
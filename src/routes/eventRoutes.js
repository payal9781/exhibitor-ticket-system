const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { createEvent, getEvents, getEventById, updateEvent, deleteEvent, registerForEvent } = require('../controllers/eventController');
const uploadMiddleware = require('../middleware/uploadMiddleware');

router.post('/create', authMiddleware(['organizer', 'superAdmin']), uploadMiddleware('media'), createEvent);
router.post('/list', authMiddleware(['organizer', 'superAdmin', 'exhibitor', 'visitor']), getEvents);
router.post('/get', authMiddleware(['organizer', 'superAdmin', 'exhibitor', 'visitor']), getEventById);
router.post('/update', authMiddleware(['organizer', 'superAdmin']), updateEvent);
router.post('/delete', authMiddleware(['organizer', 'superAdmin']), deleteEvent);
router.post('/register', authMiddleware(['exhibitor', 'visitor', 'organizer', 'superAdmin']), registerForEvent);

module.exports = router;
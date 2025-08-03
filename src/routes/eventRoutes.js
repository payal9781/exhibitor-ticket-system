const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { createEvent, getEvents, getEventById, updateEvent, deleteEvent, registerForEvent, getEventStats } = require('../controllers/eventController');
const uploadMiddleware = require('../middleware/uploadMiddleware');

router.post('/create', authMiddleware(['organizer', 'superadmin']), uploadMiddleware('media'), createEvent);
router.post('/list', authMiddleware(['organizer', 'superadmin', 'exhibitor', 'visitor']), getEvents);
router.post('/get', authMiddleware(['organizer', 'superadmin', 'exhibitor', 'visitor']), getEventById);
router.post('/update', authMiddleware(['organizer', 'superadmin']), updateEvent);
router.post('/delete', authMiddleware(['organizer', 'superadmin']), deleteEvent);
router.post('/register', authMiddleware(['exhibitor', 'visitor', 'organizer', 'superadmin']), registerForEvent);
router.post('/stats', authMiddleware(['organizer', 'superAdmin']), getEventStats);

module.exports = router;
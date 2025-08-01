const { Router } = require('express');
const { createEvent, updateEvent, deleteEvent, getEvents } = require('../controllers/eventController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validator } = require('../utils/validator');
const { create: createEventValidator, update: updateEventValidator } = require('../validators/eventValidator');

const router = Router();

router.post('/', authMiddleware(['organizer', 'superadmin']), validator(createEventValidator), createEvent);
router.put('/:eventId', authMiddleware(['organizer', 'superadmin']), validator(updateEventValidator), updateEvent);
router.delete('/:eventId', authMiddleware(['organizer', 'superadmin']), deleteEvent);
router.get('/', authMiddleware(['organizer', 'superadmin', 'exhibitor', 'visitor']), getEvents);

module.exports = router;
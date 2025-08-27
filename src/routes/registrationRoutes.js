const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  getEventByRegistrationLink,
  registerExhibitorForEvent,
  registerVisitorForEvent,
  getEventRegistrationStats,
  getUpcomingEventsForRegistration,
  registerForMultipleEvents,
} = require('../controllers/registrationController');

// Public routes for event registration (no auth required)
router.get('/event/:registrationLink', getEventByRegistrationLink);
router.post('/event/:registrationLink/exhibitor', registerExhibitorForEvent);
router.post('/event/:registrationLink/visitor', registerVisitorForEvent);
router.get('/upcoming-events', getUpcomingEventsForRegistration);
router.post('/multiple-events', registerForMultipleEvents);

// Protected routes for organizers/admins
router.get('/stats/:eventId', authMiddleware(['organizer', 'superadmin']), getEventRegistrationStats);

module.exports = router;
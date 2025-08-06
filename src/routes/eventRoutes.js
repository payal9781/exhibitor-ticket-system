const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  createEvent, 
  getEvents, 
  getEventById, 
  updateEvent, 
  deleteEvent, 
  registerForEvent, 
  getEventStats,
  getUpcomingEvents,
  getAllParticipants,
  addParticipantToEvent,
  getEventParticipants,
  updateEventStatus,
  getEventStatusStats,
  getAvailableParticipants,
  addParticipantToEventComprehensive,
  addMultipleParticipantsToEvent,
  removeParticipantFromEvent,
  scanQRForAttendance,
  getAttendanceStats
} = require('../controllers/eventController');
const uploadMiddleware = require('../middleware/uploadMiddleware');

router.post('/create', authMiddleware(['organizer', 'superAdmin']), uploadMiddleware('media'), createEvent);
router.post('/list', authMiddleware(['organizer', 'superAdmin', 'exhibitor', 'visitor']), getEvents);
router.post('/get', authMiddleware(['organizer', 'superAdmin', 'exhibitor', 'visitor']), getEventById);
router.post('/update', authMiddleware(['organizer', 'superAdmin']), updateEvent);
router.post('/delete', authMiddleware(['organizer', 'superAdmin']), deleteEvent);
router.post('/register', authMiddleware(['exhibitor', 'visitor', 'organizer', 'superAdmin']), registerForEvent);
router.post('/stats', authMiddleware(['organizer', 'superAdmin']), getEventStats);
router.post('/upcoming', authMiddleware(['organizer', 'superAdmin']), getUpcomingEvents);
router.post('/all-participants', authMiddleware(['organizer', 'superAdmin']), getAllParticipants);
router.post('/add-participant', authMiddleware(['organizer', 'superAdmin']), addParticipantToEvent);
router.post('/participants', authMiddleware(['organizer', 'superAdmin']), getEventParticipants);
router.post('/update-status', authMiddleware(['organizer', 'superAdmin']), updateEventStatus);
router.post('/status-stats', authMiddleware(['organizer', 'superAdmin']), getEventStatusStats);

// New comprehensive participant management routes
router.post('/available-participants', authMiddleware(['organizer', 'superAdmin']), getAvailableParticipants);
router.post('/add-participant-comprehensive', authMiddleware(['organizer', 'superAdmin']), addParticipantToEventComprehensive);
router.post('/add-multiple-participants', authMiddleware(['organizer', 'superAdmin']), addMultipleParticipantsToEvent);
router.post('/remove-participant', authMiddleware(['organizer', 'superAdmin']), removeParticipantFromEvent);

// QR scanning for attendance
router.post('/scan-qr-attendance', authMiddleware(['organizer', 'superAdmin']), scanQRForAttendance);
router.post('/attendance-stats', authMiddleware(['organizer', 'superAdmin']), getAttendanceStats);

module.exports = router;
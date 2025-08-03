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

router.post('/create', authMiddleware(['organizer', 'superadmin']), uploadMiddleware('media'), createEvent);
router.post('/list', authMiddleware(['organizer', 'superadmin', 'exhibitor', 'visitor']), getEvents);
router.post('/get', authMiddleware(['organizer', 'superadmin', 'exhibitor', 'visitor']), getEventById);
router.post('/update', authMiddleware(['organizer', 'superadmin']), updateEvent);
router.post('/delete', authMiddleware(['organizer', 'superadmin']), deleteEvent);
router.post('/register', authMiddleware(['exhibitor', 'visitor', 'organizer', 'superadmin']), registerForEvent);
router.post('/stats', authMiddleware(['organizer', 'superAdmin']), getEventStats);
router.post('/upcoming', authMiddleware(['organizer', 'superadmin']), getUpcomingEvents);
router.post('/all-participants', authMiddleware(['organizer', 'superadmin']), getAllParticipants);
router.post('/add-participant', authMiddleware(['organizer', 'superadmin']), addParticipantToEvent);
router.post('/participants', authMiddleware(['organizer', 'superadmin']), getEventParticipants);
router.post('/update-status', authMiddleware(['organizer', 'superadmin']), updateEventStatus);
router.post('/status-stats', authMiddleware(['organizer', 'superadmin']), getEventStatusStats);

// New comprehensive participant management routes
router.post('/available-participants', authMiddleware(['organizer', 'superadmin']), getAvailableParticipants);
router.post('/add-participant-comprehensive', authMiddleware(['organizer', 'superadmin']), addParticipantToEventComprehensive);
router.post('/add-multiple-participants', authMiddleware(['organizer', 'superadmin']), addMultipleParticipantsToEvent);
router.post('/remove-participant', authMiddleware(['organizer', 'superadmin']), removeParticipantFromEvent);

// QR scanning for attendance
router.post('/scan-qr-attendance', authMiddleware(['organizer', 'superadmin']), scanQRForAttendance);
router.post('/attendance-stats', authMiddleware(['organizer', 'superadmin']), getAttendanceStats);

module.exports = router;
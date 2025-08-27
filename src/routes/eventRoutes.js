const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  createEvent,
  addOrUpdateSchedule,
  getSchedules,
  deleteSchedule,
  getEvents, 
  getEventById, 
  updateEvent, 
  deleteEvent, 
  registerForEvent, 
  registerByLink,
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
  getAttendanceStats,
  addSponsor,
  updateSponsor,
  removeSponsor,
  getSponsors
} = require('../controllers/eventController');
// const uploadMiddleware = require('../middleware/uploadMiddleware');
const constants = require('../config/constants');
const upload = require('../config/multerConfig').upload;
router.post('/create', authMiddleware(['organizer', 'superAdmin']),upload(constants.EVENT_BANNER_PATH).fields([{ name: 'banners', maxCount: 10 }]), createEvent);
router.post('/add-schedule', authMiddleware(['organizer', 'superAdmin']), addOrUpdateSchedule);
router.post('/get-schedules', authMiddleware(['organizer', 'superAdmin']), getSchedules);
router.post('/delete-schedule', authMiddleware(['organizer', 'superAdmin']), deleteSchedule);
router.post('/list', authMiddleware(['organizer', 'superAdmin', 'exhibitor', 'visitor']), getEvents);
router.post('/get', authMiddleware(['organizer', 'superAdmin', 'exhibitor', 'visitor']), getEventById);
router.post('/update', authMiddleware(['organizer', 'superAdmin']),upload(constants.EVENT_BANNER_PATH).fields([{ name: 'banners', maxCount: 10 }]), updateEvent);
router.post('/delete', authMiddleware(['organizer', 'superAdmin']), deleteEvent);
router.post('/register', authMiddleware(['exhibitor', 'visitor', 'organizer', 'superAdmin']), registerForEvent);
router.post('/registration/event/:registrationLink/:type', registerByLink);
router.post('/stats', authMiddleware(['organizer', 'superAdmin']), getEventStats);
router.post('/upcoming', authMiddleware(['organizer', 'superAdmin']), getUpcomingEvents);
router.post('/all-participants', authMiddleware(['organizer', 'superAdmin']), getAllParticipants);
router.post('/add-participant', authMiddleware(['organizer', 'superAdmin']), addParticipantToEvent);
router.post('/participants', authMiddleware(['organizer', 'superAdmin']), getEventParticipants);
router.post('/update-status', authMiddleware(['organizer', 'superAdmin']), updateEventStatus);
router.post('/status-stats', authMiddleware(['organizer', 'superAdmin']), getEventStatusStats);
router.post('/available-participants', authMiddleware(['organizer', 'superAdmin']), getAvailableParticipants);
router.post('/add-participant-comprehensive', authMiddleware(['organizer', 'superAdmin']), addParticipantToEventComprehensive);
router.post('/add-multiple-participants', authMiddleware(['organizer', 'superAdmin']), addMultipleParticipantsToEvent);
router.post('/remove-participant', authMiddleware(['organizer', 'superAdmin']), removeParticipantFromEvent);
router.post('/scan-qr-attendance', authMiddleware(['organizer', 'superAdmin']), scanQRForAttendance);
router.post('/attendance-stats', authMiddleware(['organizer', 'superAdmin']), getAttendanceStats);
router.post('/add-sponsor', authMiddleware(['organizer', 'superAdmin']), addSponsor);
router.post('/update-sponsor', authMiddleware(['organizer', 'superAdmin']), updateSponsor);
router.post('/remove-sponsor', authMiddleware(['organizer', 'superAdmin']), removeSponsor);
router.post('/get-sponsors', authMiddleware(['organizer', 'superAdmin', 'exhibitor', 'visitor']), getSponsors);

module.exports = router;
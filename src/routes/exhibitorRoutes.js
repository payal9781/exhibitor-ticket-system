const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  createExhibitor, 
  getExhibitors, 
  getExhibitorById, 
  updateExhibitor, 
  deleteExhibitor,
  getOrganizersEventWise,
  getEventsOrganizerWise,
  getParticipantsEventWise,
  getUserDetails,
  getExhibitorStats,
  getAvailableBooths,
  checkInExhibitor,
  checkOutExhibitor,
  getExhibitorsWithAttendance
} = require('../controllers/exhibitorController');

router.post('/create', authMiddleware(['organizer', 'superAdmin']), createExhibitor);
router.post('/list', authMiddleware(['organizer', 'superAdmin']), getExhibitors);
router.post('/get', authMiddleware(['organizer', 'superAdmin']), getExhibitorById);
router.post('/update', authMiddleware(['organizer', 'superAdmin']), updateExhibitor);
router.post('/delete', authMiddleware(['organizer', 'superAdmin']), deleteExhibitor);
router.post('/organizers-event-wise', authMiddleware(['organizer', 'superAdmin']), getOrganizersEventWise);
router.post('/events-organizer-wise', authMiddleware(['organizer', 'superAdmin']), getEventsOrganizerWise);
router.post('/participants-event-wise', authMiddleware(['organizer', 'superAdmin']), getParticipantsEventWise);
router.post('/user-details', authMiddleware(['organizer', 'superAdmin']), getUserDetails);
router.post('/stats', authMiddleware(['organizer', 'superAdmin']), getExhibitorStats);
router.post('/available-booths', authMiddleware(['organizer', 'superAdmin']), getAvailableBooths);
router.post('/check-in', authMiddleware(['organizer', 'superAdmin']), checkInExhibitor);
router.post('/check-out', authMiddleware(['organizer', 'superAdmin']), checkOutExhibitor);
router.post('/list-with-attendance', authMiddleware(['organizer', 'superAdmin']), getExhibitorsWithAttendance);

module.exports = router;
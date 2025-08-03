const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  createVisitor, 
  getVisitors, 
  getVisitorById, 
  updateVisitor, 
  deleteVisitor, 
  getOrganizersEventWise, 
  getEventsOrganizerWise, 
  getParticipantsEventWise, 
  getUserDetails,
  getVisitorStats,
  checkInVisitor,
  checkOutVisitor,
  bulkCheckIn
} = require('../controllers/visitorController');

router.post('/create', authMiddleware(['organizer', 'superAdmin']), createVisitor);
router.post('/list', authMiddleware(['organizer', 'superAdmin']), getVisitors);
router.post('/get', authMiddleware(['organizer', 'superAdmin']), getVisitorById);
router.post('/update', authMiddleware(['organizer', 'superAdmin']), updateVisitor);
router.post('/delete', authMiddleware(['organizer', 'superAdmin']), deleteVisitor);
router.post('/organizers-event-wise', authMiddleware(['exhibitor', 'visitor']), getOrganizersEventWise);
router.post('/events-organizer-wise', authMiddleware(['exhibitor', 'visitor']), getEventsOrganizerWise);
router.post('/participants-event-wise', authMiddleware(['exhibitor', 'visitor']), getParticipantsEventWise);
router.post('/user-details', authMiddleware(['exhibitor', 'visitor']), getUserDetails);
router.post('/stats', authMiddleware(['organizer', 'superAdmin']), getVisitorStats);
router.post('/check-in', authMiddleware(['organizer', 'superAdmin']), checkInVisitor);
router.post('/check-out', authMiddleware(['organizer', 'superAdmin']), checkOutVisitor);
router.post('/bulk-check-in', authMiddleware(['organizer', 'superAdmin']), bulkCheckIn);

module.exports = router;
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  getOrganizerDashboardStats, 
  getSuperAdminDashboardStats, 
  getRecentActivity,
  getOrganizerAttendeeOverview
} = require('../controllers/dashboardController');

// Dashboard stats routes - Support both GET (for backward compatibility) and POST (for filters)
router.get('/organizer-stats', authMiddleware(['organizer']), getOrganizerDashboardStats);
router.post('/organizer-stats', authMiddleware(['organizer']), getOrganizerDashboardStats);
router.get('/super-admin-stats', authMiddleware(['superAdmin']), getSuperAdminDashboardStats);
router.post('/super-admin-stats', authMiddleware(['superAdmin']), getSuperAdminDashboardStats);
router.get('/recent-activity', authMiddleware(['organizer', 'superAdmin']), getRecentActivity);
router.post('/recent-activity', authMiddleware(['organizer', 'superAdmin']), getRecentActivity);
router.get('/attendee-overview', authMiddleware(['organizer']), getOrganizerAttendeeOverview);

module.exports = router;
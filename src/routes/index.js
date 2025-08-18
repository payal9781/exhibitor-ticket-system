const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/events', require('./eventRoutes'));
router.use('/organizers', require('./organizerRoutes'));
router.use('/exhibitors', require('./exhibitorRoutes'));
router.use('/visitors', require('./visitorRoutes'));
router.use('/attendance', require('./attendanceRoutes'));
router.use('/meetings', require('./meetingRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/superadmin', require('./superadminRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/mobile', require('./mobileRoutes'));
router.use('/registration', require('./registrationRoutes'));
router.use('/card', require('./cardsRoutes'));

// Mobile App APIs
router.use('/exhibitor-mobile', require('./exhibitorMobileRoutes'));
router.use('/visitor-mobile', require('./visitorMobileRoutes'));

module.exports = router;
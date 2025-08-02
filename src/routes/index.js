const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/events', require('./eventRoutes'));
router.use('/organizers', require('./organizerRoutes'));
router.use('/exhibitors', require('./exhibitorRoutes'));
router.use('/visitors', require('./visitorRoutes'));
router.use('/attendance', require('./attendanceRoutes'));
router.use('/meetings', require('./meetingRoutes'));

module.exports = router;
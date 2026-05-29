const { Router } = require('express');
const { getAllUsers } = require('../controllers/superadminController');
const {
  listOtps,
  getOtpSettings,
  updateOtpSettings,
  getOtpStats,
  deleteOtp,
  deleteAllOtps,
} = require('../controllers/otpManagementController');
const {
  previewRecipients,
  sendNotification,
  getNotificationHistory,
  getEventsForFilter,
} = require('../controllers/notificationManagementController');
const authMiddleware = require('../middleware/authMiddleware');

const router = Router();

router.get('/users', authMiddleware(['superadmin']), getAllUsers);

router.post('/otp/list', authMiddleware(['superAdmin']), listOtps);
router.get('/otp/settings', authMiddleware(['superAdmin']), getOtpSettings);
router.post('/otp/settings', authMiddleware(['superAdmin']), updateOtpSettings);
router.post('/otp/stats', authMiddleware(['superAdmin']), getOtpStats);
router.post('/otp/delete', authMiddleware(['superAdmin']), deleteOtp);
router.post('/otp/delete-all', authMiddleware(['superAdmin']), deleteAllOtps);

router.post('/notifications/preview', authMiddleware(['superAdmin']), previewRecipients);
router.post('/notifications/send', authMiddleware(['superAdmin']), sendNotification);
router.post('/notifications/history', authMiddleware(['superAdmin']), getNotificationHistory);
router.post('/notifications/events', authMiddleware(['superAdmin']), getEventsForFilter);

module.exports = router;

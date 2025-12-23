const { Router } = require('express');
const {
  registerForEvent,
  scanQRCode,
  markAttendance,
  getUserList,
  getUserDetails,
  createUser,
  updateUser,
  deleteUser,
  getUsers,
  getUser,
  getUserStats,
  changeUserStatus,
  changeUserRole,
  resetPassword,
  bulkUpdateUserStatus,
  exportUsers
} = require('../controllers/userController');
const authMiddleware  = require('../middleware/authMiddleware');
const validator  = require('../utils/validator');
const { registerEvent, scanQR, markAttendance: markAttendanceValidator, createUser: createUserValidator, updateUser: updateUserValidator } = require('../validators/userValidator');
const createUploadMiddleware  = require('../middleware/uploadMiddleware');

const router = Router();
const upload = createUploadMiddleware('user');

// Original routes
router.post('/register-event', authMiddleware(['exhibitor', 'visitor']), validator(registerEvent), registerForEvent);
router.post('/scan-qr', authMiddleware(['exhibitor', 'visitor']), validator(scanQR), scanQRCode);
router.post('/mark-attendance', authMiddleware(['organizer']), validator(markAttendanceValidator), markAttendance);
router.get('/list', authMiddleware(['exhibitor', 'visitor', 'organizer', 'superAdmin']), getUserList);
router.get('/:role/:userId', authMiddleware(['exhibitor', 'visitor', 'organizer', 'superAdmin']), getUserDetails);
router.post('/create', authMiddleware(['organizer', 'superAdmin']), upload, validator(createUserValidator), createUser);
router.put('/:role/:userId', authMiddleware(['organizer', 'superAdmin']), upload, validator(updateUserValidator), updateUser);
router.delete('/:role/:userId', authMiddleware(['organizer', 'superAdmin']), deleteUser);

// User Management routes (POST endpoints for frontend compatibility)
router.post('/list', authMiddleware(['organizer', 'superAdmin']), getUsers);
router.post('/get', authMiddleware(['organizer', 'superAdmin']), getUser);
router.post('/stats', authMiddleware(['organizer', 'superAdmin']), getUserStats);
router.post('/change-status', authMiddleware(['organizer', 'superAdmin']), changeUserStatus);
router.post('/change-role', authMiddleware(['superAdmin']), changeUserRole);
router.post('/reset-password', authMiddleware(['organizer', 'superAdmin']), resetPassword);
router.post('/bulk-update-status', authMiddleware(['organizer', 'superAdmin']), bulkUpdateUserStatus);
router.post('/export', authMiddleware(['organizer', 'superAdmin']), exportUsers);

module.exports = router;
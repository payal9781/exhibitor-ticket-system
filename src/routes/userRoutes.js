const { Router } = require('express');
const {
  registerForEvent,
  scanQRCode,
  markAttendance,
  getUserList,
  getUserDetails,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/userController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validator } = require('../utils/validator');
const { registerEvent, scanQR, markAttendance: markAttendanceValidator, createUser: createUserValidator, updateUser: updateUserValidator } = require('../validators/userValidator');
const { createUploadMiddleware } = require('../middleware/uploadMiddleware');

const router = Router();
const upload = createUploadMiddleware('user');

router.post('/register-event', authMiddleware(['exhibitor', 'visitor']), validator(registerEvent), registerForEvent);
router.post('/scan-qr', authMiddleware(['exhibitor', 'visitor']), validator(scanQR), scanQRCode);
router.post('/mark-attendance', authMiddleware(['organizer']), validator(markAttendanceValidator), markAttendance);
router.get('/list', authMiddleware(['exhibitor', 'visitor', 'organizer', 'superadmin']), getUserList);
router.get('/:role/:userId', authMiddleware(['exhibitor', 'visitor', 'organizer', 'superadmin']), getUserDetails);
router.post('/create', authMiddleware(['organizer', 'superadmin']), upload, validator(createUserValidator), createUser);
router.put('/:role/:userId', authMiddleware(['organizer', 'superadmin']), upload, validator(updateUserValidator), updateUser);
router.delete('/:role/:userId', authMiddleware(['organizer', 'superadmin']), deleteUser);

module.exports = router;
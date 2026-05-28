// src/routes/roomReferralRoutes.js
const { Router } = require('express');
const router = Router();

const authMiddleware = require('../middleware/authMiddleware');
const validator = require('../utils/validator');
const controller = require('../controllers/roomReferralController');
const val = require('../validators/roomReferralValidator');
const createUploadMiddleware = require('../middleware/uploadMiddleware');

const upload = createUploadMiddleware('banner');

// ==========================================
// ADMIN ENDPOINTS (superAdmin & organizer)
// ==========================================

router.post(
  '/createRoom',
  authMiddleware(['organizer', 'superAdmin']),
  upload,
  validator(val.createRoom),
  controller.createRoom
);

router.put(
  '/rooms/:roomId',
  authMiddleware(['organizer', 'superAdmin']),
  upload,
  validator(val.updateRoom),
  controller.updateRoom
);

router.post(
  '/rooms/delete/:roomId', // Using POST for compatibility or fallback, let's register both POST and DELETE
  authMiddleware(['organizer', 'superAdmin']),
  controller.deleteRoom
);
router.delete(
  '/rooms/:roomId',
  authMiddleware(['organizer', 'superAdmin']),
  controller.deleteRoom
);

router.post(
  '/createRound',
  authMiddleware(['organizer', 'superAdmin']),
  validator(val.createRound),
  controller.createRound
);

router.put(
  '/rounds/:roundId',
  authMiddleware(['organizer', 'superAdmin']),
  validator(val.updateRound),
  controller.updateRound
);

router.post(
  '/rounds/delete/:roundId',
  authMiddleware(['organizer', 'superAdmin']),
  controller.deleteRound
);
router.delete(
  '/rounds/:roundId',
  authMiddleware(['organizer', 'superAdmin']),
  controller.deleteRound
);

router.post(
  '/addUsersToRound',
  authMiddleware(['organizer', 'superAdmin']),
  validator(val.addUsersToRound),
  controller.addUsersToRound
);

router.post(
  '/addUsersToRoundByFilter',
  authMiddleware(['organizer', 'superAdmin']),
  validator(val.addUsersToRoundByFilter),
  controller.addUsersToRoundByFilter
);

router.post(
  '/rounds/removeUser',
  authMiddleware(['organizer', 'superAdmin']),
  controller.removeUserFromRound
);

router.get(
  '/getRoomDetails/:roomId',
  authMiddleware(['organizer', 'superAdmin', 'exhibitor', 'visitor']),
  controller.getRoomDetails
);

router.post(
  '/listRooms',
  authMiddleware(['organizer', 'superAdmin']),
  controller.listRooms
);

router.get(
  '/exportRoomReferralsToExcel/:roomId',
  authMiddleware(['organizer', 'superAdmin']),
  controller.exportRoomReferralsToExcel
);

// ==========================================
// MOBILE ENDPOINTS (exhibitor & visitor)
// ==========================================

router.get(
  '/mobile/getMyRooms',
  authMiddleware(['exhibitor', 'visitor']),
  controller.getMyRooms
);

router.get(
  '/mobile/getMyRoundsByRoom/:roomId',
  authMiddleware(['exhibitor', 'visitor']),
  controller.getMyRoundsByRoom
);

router.post(
  '/mobile/createRoundReferral',
  authMiddleware(['exhibitor', 'visitor']),
  validator(val.createRoundReferral),
  controller.createRoundReferral
);

router.get(
  '/mobile/getMyRoundReferralStats',
  authMiddleware(['exhibitor', 'visitor']),
  controller.getMyRoundReferralStats
);

router.get(
  '/mobile/getMyRoundReferrals',
  authMiddleware(['exhibitor', 'visitor']),
  controller.getMyRoundReferrals
);

module.exports = router;

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  createOrganizer, 
  getOrganizers, 
  getOrganizerById, 
  updateOrganizer, 
  deleteOrganizer,
  getOrganizerStats,
  changeOrganizerStatus,
  updateSubscription
} = require('../controllers/organizerController');

router.post('/create', authMiddleware(['superAdmin']), createOrganizer);
router.post('/list', authMiddleware(['superAdmin']), getOrganizers);
router.post('/get', authMiddleware(['superAdmin']), getOrganizerById);
router.post('/update', authMiddleware(['superAdmin']), updateOrganizer);
router.post('/delete', authMiddleware(['superAdmin']), deleteOrganizer);
router.post('/stats', authMiddleware(['superAdmin']), getOrganizerStats);
router.post('/change-status', authMiddleware(['superAdmin']), changeOrganizerStatus);
router.post('/update-subscription', authMiddleware(['superAdmin']), updateSubscription);

module.exports = router;
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  createOrganizer, 
  getOrganizers, 
  getOrganizerById, 
  updateOrganizer, 
  deleteOrganizer,
  getOrganizerStats
} = require('../controllers/organizerController');

router.post('/create', authMiddleware(['superAdmin']), createOrganizer);
router.post('/list', authMiddleware(['superAdmin']), getOrganizers);
router.post('/get', authMiddleware(['superAdmin']), getOrganizerById);
router.post('/update', authMiddleware(['superAdmin']), updateOrganizer);
router.post('/delete', authMiddleware(['superAdmin']), deleteOrganizer);
router.post('/stats', authMiddleware(['superAdmin']), getOrganizerStats);


module.exports = router;
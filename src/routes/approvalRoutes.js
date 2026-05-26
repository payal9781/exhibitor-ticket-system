const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getPendingApprovals,
  approveRequest,
  getApprovalHistory,
} = require('../controllers/approvalManagementController');

router.post('/pending', authMiddleware(['organizer', 'superAdmin']), getPendingApprovals);
router.post('/approve', authMiddleware(['organizer', 'superAdmin']), approveRequest);
router.post('/history', authMiddleware(['organizer', 'superAdmin']), getApprovalHistory);

module.exports = router;

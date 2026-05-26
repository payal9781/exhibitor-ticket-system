const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getPendingApprovals,
  getApprovedRequests,
  getRejectedRequests,
  approveRequest,
  rejectRequest,
  getApprovalHistory,
} = require('../controllers/approvalManagementController');

router.post('/pending', authMiddleware(['organizer', 'superAdmin']), getPendingApprovals);
router.post('/approved', authMiddleware(['organizer', 'superAdmin']), getApprovedRequests);
router.post('/rejected', authMiddleware(['organizer', 'superAdmin']), getRejectedRequests);
router.post('/approve', authMiddleware(['organizer', 'superAdmin']), approveRequest);
router.post('/reject', authMiddleware(['organizer', 'superAdmin']), rejectRequest);
router.post('/history', authMiddleware(['organizer', 'superAdmin']), getApprovalHistory);

module.exports = router;

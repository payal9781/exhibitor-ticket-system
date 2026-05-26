const approvalService = require('../services/approvalService');

const getPendingApprovals = async (req, res) => {
  try {
    const { eventId, userType, page, limit } = req.body;
    const data = await approvalService.getPendingApprovals(req.user, {
      eventId,
      userType,
      page: page || 1,
      limit: limit || 20,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getPendingApprovals error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch pending approvals' });
  }
};

const approveRequest = async (req, res) => {
  try {
    const { eventId, userId, userType } = req.body;
    if (!eventId || !userId || !userType) {
      return res.status(400).json({ success: false, message: 'eventId, userId, and userType are required' });
    }

    const result = await approvalService.processApproval(req.user, { eventId, userId, userType });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('approveRequest error:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to approve request' });
  }
};

const getApprovalHistory = async (req, res) => {
  try {
    const { page, limit, eventId } = req.body;
    const data = await approvalService.getApprovalHistory(req.user, {
      page: page || 1,
      limit: limit || 10,
      eventId,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('getApprovalHistory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch approval history' });
  }
};

module.exports = {
  getPendingApprovals,
  approveRequest,
  getApprovalHistory,
};

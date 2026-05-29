const asyncHandler = require('express-async-handler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { models } = require('../models/z-index');
const otpService = require('../services/otpService');

const getOtpStatus = (record) => {
  if (record.isUsed) return 'used';
  if (new Date(record.expiresAt) <= new Date()) return 'expired';
  return 'active';
};

const getOtpSettings = asyncHandler(async (_req, res) => {
  const settings = await otpService.getSettings();
  successResponse(res, settings);
});

const updateOtpSettings = asyncHandler(async (req, res) => {
  const { bypassOtpEnabled, bypassOtp } = req.body;

  if (bypassOtp !== undefined) {
    const normalizedBypassOtp = String(bypassOtp).trim();
    if (!/^\d{4,6}$/.test(normalizedBypassOtp)) {
      return errorResponse(res, 'Bypass OTP must be 4 to 6 digits', 400);
    }
  }

  const settings = await otpService.updateSettings({
    ...(bypassOtpEnabled !== undefined && { bypassOtpEnabled: Boolean(bypassOtpEnabled) }),
    ...(bypassOtp !== undefined && { bypassOtp: String(bypassOtp).trim() }),
  });

  successResponse(res, settings);
});

const getOtpStats = asyncHandler(async (_req, res) => {
  const now = new Date();

  const [total, active, used, expired, sentToday] = await Promise.all([
    models.Otp.countDocuments({}),
    models.Otp.countDocuments({
      isUsed: false,
      expiresAt: { $gt: now },
    }),
    models.Otp.countDocuments({ isUsed: true }),
    models.Otp.countDocuments({
      isUsed: false,
      expiresAt: { $lte: now },
    }),
    models.Otp.countDocuments({
      createdAt: {
        $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      },
      isSent: true,
    }),
  ]);

  successResponse(res, {
    total,
    active,
    used,
    expired,
    sentToday,
  });
});

const listOtps = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 10, status = 'all' } = req.body;
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const now = new Date();

  const query = {};

  if (search && search.trim()) {
    query.mobileNo = { $regex: search.trim(), $options: 'i' };
  }

  if (status === 'active') {
    query.isUsed = false;
    query.expiresAt = { $gt: now };
  } else if (status === 'used') {
    query.isUsed = true;
  } else if (status === 'expired') {
    query.isUsed = false;
    query.expiresAt = { $lte: now };
  }

  const skip = (parsedPage - 1) * parsedLimit;
  const total = await models.Otp.countDocuments(query);

  const records = await models.Otp.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parsedLimit)
    .lean();

  const otps = records.map((record) => ({
    ...record,
    status: getOtpStatus(record),
    isBypassSession: record.sessionId?.startsWith('BYPASS-') || false,
  }));

  successResponse(res, {
    otps,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  });
});

const deleteOtp = asyncHandler(async (req, res) => {
  const { id } = req.body;
  if (!id) return errorResponse(res, 'OTP id is required', 400);

  const deleted = await models.Otp.findByIdAndDelete(id);
  if (!deleted) return errorResponse(res, 'OTP not found', 404);

  successResponse(res, { message: 'OTP deleted successfully' });
});

const deleteAllOtps = asyncHandler(async (_req, res) => {
  const result = await models.Otp.deleteMany({});
  successResponse(res, {
    message: 'All OTP records deleted successfully',
    deletedCount: result.deletedCount || 0,
  });
});

module.exports = {
  listOtps,
  getOtpSettings,
  updateOtpSettings,
  getOtpStats,
  deleteOtp,
  deleteAllOtps,
};

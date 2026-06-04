const asyncHandler = require('express-async-handler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { models } = require('../models/z-index');
const notificationBroadcastService = require('../services/notificationBroadcastService');

const VALID_AUDIENCE = ['exhibitor', 'visitor', 'organizer'];
const VALID_CHANNELS = ['email', 'push', 'both'];

const previewRecipients = asyncHandler(async (req, res) => {
  const { audienceTypes = [], eventId, recipientMode, selectedRecipients } = req.body;

  if (recipientMode === 'selected') {
    if (!Array.isArray(selectedRecipients) || !selectedRecipients.length) {
      return errorResponse(res, 'Select at least one recipient', 400);
    }
  } else if (!Array.isArray(audienceTypes) || !audienceTypes.length) {
    return errorResponse(res, 'Select at least one audience type', 400);
  } else {
    const invalidTypes = audienceTypes.filter((t) => !VALID_AUDIENCE.includes(t));
    if (invalidTypes.length) {
      return errorResponse(res, 'Invalid audience type', 400);
    }
  }

  try {
    const preview = await notificationBroadcastService.previewRecipients({
      audienceTypes,
      eventId: eventId || null,
      recipientMode,
      selectedRecipients,
    });
    successResponse(res, preview);
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
});

const searchRecipients = asyncHandler(async (req, res) => {
  const { userType, search = '', eventId, page = 1, limit = 20 } = req.body;

  if (!VALID_AUDIENCE.includes(userType)) {
    return errorResponse(res, 'Invalid user type', 400);
  }

  try {
    const result = await notificationBroadcastService.searchRecipients({
      userType,
      search,
      eventId: eventId || null,
      page,
      limit,
    });
    successResponse(res, result);
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
});

const sendNotification = asyncHandler(async (req, res) => {
  const {
    channel,
    audienceTypes = [],
    eventId,
    recipientMode,
    selectedRecipients,
    title,
    body,
    emailSubject,
    emailBody,
  } = req.body;

  if (!VALID_CHANNELS.includes(channel)) {
    return errorResponse(res, 'Invalid channel. Use email, push, or both', 400);
  }

  if (recipientMode === 'selected') {
    if (!Array.isArray(selectedRecipients) || !selectedRecipients.length) {
      return errorResponse(res, 'Select at least one recipient', 400);
    }
  } else {
    if (!Array.isArray(audienceTypes) || !audienceTypes.length) {
      return errorResponse(res, 'Select at least one audience type', 400);
    }
    const invalidTypes = audienceTypes.filter((t) => !VALID_AUDIENCE.includes(t));
    if (invalidTypes.length) {
      return errorResponse(res, 'Invalid audience type', 400);
    }
  }

  if (!title?.trim()) {
    return errorResponse(res, 'Title is required', 400);
  }

  try {
    const result = await notificationBroadcastService.sendBroadcast({
      channel,
      audienceTypes,
      eventId: eventId || null,
      recipientMode,
      selectedRecipients,
      title: title.trim(),
      body: body?.trim() || '',
      emailSubject: emailSubject?.trim() || title.trim(),
      emailBody: emailBody?.trim() || '',
      sentBy: req.user.id || req.user._id,
      sentByName: req.user.name || req.user.email || 'Super Admin',
    });

    successResponse(
      res,
      {
        message: 'Notification broadcast completed',
        log: result.log,
        stats: result.stats,
        status: result.status,
      },
      201
    );
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
});

const getNotificationHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.body;
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

  const result = await models.AdminNotificationLog.paginate(
    {},
    {
      page: parsedPage,
      limit: parsedLimit,
      sort: { createdAt: -1 },
      select: '-__v',
    }
  );

  successResponse(res, {
    logs: result.docs,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.totalDocs,
      totalPages: result.totalPages,
    },
  });
});

const getEventsForFilter = asyncHandler(async (req, res) => {
  const { search = '' } = req.body;

  const query = { isDeleted: false };
  if (search?.trim()) {
    query.title = { $regex: search.trim(), $options: 'i' };
  }

  const events = await models.Event.find(query)
    .select('_id title fromDate toDate location organizerId')
    .sort({ fromDate: -1 })
    .limit(100)
    .lean();

  successResponse(res, { events });
});

module.exports = {
  previewRecipients,
  searchRecipients,
  sendNotification,
  getNotificationHistory,
  getEventsForFilter,
};

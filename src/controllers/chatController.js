// src/controllers/chatController.js
const asyncHandler = require('express-async-handler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const ChatRequest = require('../models/ChatRequest');
const ChatMessage = require('../models/ChatMessage');
const Visitor = require('../models/Visitor');
const Exhibitor = require('../models/Exhibitor');
const Event = require('../models/Event');
const { emitToUser } = require('../utils/socket');
const { sendNotification } = require('../utils/fcmToken_notification');

/**
 * Send a chat request
 * Route: POST /api/v1/chat/request/send
 */
const sendChatRequest = asyncHandler(async (req, res) => {
  const senderId = req.user.id || req.user._id;
  const senderType = req.user.type; // 'visitor' or 'exhibitor'
  const { eventId, receiverId, receiverType } = req.body;

  if (!eventId || !receiverId || !receiverType) {
    return errorResponse(res, 'eventId, receiverId, and receiverType are required', 400);
  }

  if (senderId.toString() === receiverId.toString()) {
    return errorResponse(res, 'You cannot send a chat request to yourself', 400);
  }

  // 1. Verify Event exists
  const event = await Event.findById(eventId);
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  // 2. Verify Recipient exists
  let receiver;
  if (receiverType === 'exhibitor') {
    receiver = await Exhibitor.findById(receiverId);
  } else {
    receiver = await Visitor.findById(receiverId);
  }

  if (!receiver) {
    return errorResponse(res, 'Recipient not found', 404);
  }

  // 3. Verify Sender exists
  let sender;
  if (senderType === 'exhibitor') {
    sender = await Exhibitor.findById(senderId);
  } else {
    sender = await Visitor.findById(senderId);
  }

  if (!sender) {
    return errorResponse(res, 'Sender profile not found', 404);
  }

  // 4. Check if request already exists (either direction)
  const existingRequest = await ChatRequest.findOne({
    eventId,
    $or: [
      { senderId, receiverId },
      { senderId: receiverId, receiverId: senderId }
    ]
  });

  if (existingRequest) {
    return errorResponse(
      res, 
      `A chat request already exists with status: ${existingRequest.status}`, 
      400
    );
  }

  // 5. Create new ChatRequest
  const chatRequest = new ChatRequest({
    eventId,
    senderId,
    senderType,
    receiverId,
    receiverType,
    status: 'pending'
  });
  await chatRequest.save();

  // Populate request data for emission
  const populatedRequest = await ChatRequest.findById(chatRequest._id)
    .populate({ path: 'senderId', select: 'name companyName email phone profileImage' })
    .populate({ path: 'receiverId', select: 'name companyName email phone profileImage' });

  // 6. Emit real-time socket event to receiver
  emitToUser(receiverId, 'chat_request_received', populatedRequest);

  // 7. Send Push Notification if FCM Token is available
  if (receiver.fcmToken) {
    const senderName = sender.name || sender.companyName || 'Someone';
    await sendNotification(receiver.fcmToken, [
      'New Chat Request',
      `${senderName} wants to start a chat with you under event "${event.title}".`,
      {
        type: 'chat_request',
        requestId: chatRequest._id.toString(),
        eventId: eventId.toString(),
        senderId: senderId.toString(),
        senderType: senderType
      }
    ]);
  }

  successResponse(res, {
    message: 'Chat request sent successfully',
    data: populatedRequest
  }, 201);
});

/**
 * Respond to a chat request (Accept or Reject)
 * Route: POST /api/v1/chat/request/respond
 */
const respondToChatRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { requestId, status } = req.body;

  if (!requestId || !status) {
    return errorResponse(res, 'requestId and status are required', 400);
  }

  if (!['accepted', 'rejected'].includes(status)) {
    return errorResponse(res, 'Status must be accepted or rejected', 400);
  }

  // 1. Find the request
  const chatRequest = await ChatRequest.findById(requestId);
  if (!chatRequest) {
    return errorResponse(res, 'Chat request not found', 404);
  }

  // 2. Authorize: Only the receiver can accept/reject the request
  if (chatRequest.receiverId.toString() !== userId.toString()) {
    return errorResponse(res, 'You are not authorized to respond to this request', 403);
  }

  if (chatRequest.status !== 'pending') {
    return errorResponse(res, `Chat request has already been ${chatRequest.status}`, 400);
  }

  // 3. Update status
  chatRequest.status = status;
  await chatRequest.save();

  // Populate updated data
  const populatedRequest = await ChatRequest.findById(chatRequest._id)
    .populate({ path: 'senderId', select: 'name companyName email phone profileImage fcmToken' })
    .populate({ path: 'receiverId', select: 'name companyName email phone profileImage' });

  // 4. Emit real-time socket event to sender
  emitToUser(chatRequest.senderId, 'chat_request_responded', populatedRequest);

  // 5. Send FCM Notification to the sender
  const sender = populatedRequest.senderId;
  const receiverName = populatedRequest.receiverId?.name || populatedRequest.receiverId?.companyName || 'Someone';

  if (sender && sender.fcmToken) {
    await sendNotification(sender.fcmToken, [
      `Chat Request ${status === 'accepted' ? 'Accepted' : 'Rejected'}`,
      `${receiverName} has ${status} your chat request.`,
      {
        type: 'chat_request_response',
        requestId: requestId.toString(),
        status: status,
        eventId: chatRequest.eventId.toString()
      }
    ]);
  }

  successResponse(res, {
    message: `Chat request ${status} successfully`,
    data: populatedRequest
  });
});

/**
 * Get all chat requests for the current user
 * Route: GET /api/v1/chat/requests
 */
const getChatRequests = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { status, eventId, type } = req.query; // type: 'incoming' or 'outgoing'

  const query = {};

  if (eventId) {
    query.eventId = eventId;
  }

  if (status) {
    query.status = status;
  }

  if (type === 'incoming') {
    query.receiverId = userId;
  } else if (type === 'outgoing') {
    query.senderId = userId;
  } else {
    // If not specified, return both incoming and outgoing
    query.$or = [{ senderId: userId }, { receiverId: userId }];
  }

  const requests = await ChatRequest.find(query)
    .populate({ path: 'senderId', select: 'name companyName email phone profileImage' })
    .populate({ path: 'receiverId', select: 'name companyName email phone profileImage' })
    .populate({ path: 'eventId', select: 'title fromDate toDate location' })
    .sort({ updatedAt: -1 });

  successResponse(res, {
    total: requests.length,
    requests
  });
});


/**
 * Get conversation messages with pagination
 * Route: GET /api/v1/chat/messages
 */
const getChatMessages = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { eventId, otherUserId, page = 1, limit = 50 } = req.query;

  if (!eventId || !otherUserId) {
    return errorResponse(res, 'eventId and otherUserId are required', 400);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Find messages in either direction
  const query = {
    eventId,
    $or: [
      { senderId: userId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: userId }
    ]
  };

  const total = await ChatMessage.countDocuments(query);
  
  const messages = await ChatMessage.find(query)
    .populate({ path: 'senderId', select: 'name companyName email phone profileImage' })
    .populate({ path: 'receiverId', select: 'name companyName email phone profileImage' })
    .sort({ createdAt: -1 }) // Get latest first for pagination
    .skip(skip)
    .limit(parseInt(limit));

  // Reverse to chronological order (no modification of paths)
  const chronologicalMessages = messages.reverse();

  successResponse(res, {
    messages: chronologicalMessages,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  });
});

/**
 * Get all exhibitors and visitors of an event
 * Route: GET /api/v1/chat/event-users/:eventId
 */
const getEventUsers = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  if (!eventId) {
    return errorResponse(res, 'eventId is required', 400);
  }

  const event = await Event.findById(eventId)
    .populate({
      path: 'exhibitor.userId',
      select: 'companyName email phone profileImage bio Sector location fcmToken'
    })
    .populate({
      path: 'visitor.userId',
      select: 'name email phone profileImage bio Sector location companyName fcmToken'
    });

  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  // Extract exhibitors (strictly relative paths)
  const exhibitors = event.exhibitor
    .filter(e => e.userId)
    .map(e => {
      const user = e.userId.toObject ? e.userId.toObject() : e.userId;
      user.userType = 'exhibitor';
      return user;
    });

  // Extract visitors (strictly relative paths)
  const visitors = event.visitor
    .filter(v => v.userId)
    .map(v => {
      const user = v.userId.toObject ? v.userId.toObject() : v.userId;
      user.userType = 'visitor';
      return user;
    });

  successResponse(res, {
    eventId,
    eventTitle: event.title,
    exhibitors,
    visitors,
    totalExhibitors: exhibitors.length,
    totalVisitors: visitors.length
  });
});

/**
 * Mark all messages in a conversation as read
 * Route: POST /api/v1/chat/messages/mark-read
 */
const markMessagesAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { eventId, senderId } = req.body;

  if (!eventId || !senderId) {
    return errorResponse(res, 'eventId and senderId are required', 400);
  }

  // Update all unread messages from senderId to the current user (userId)
  const result = await ChatMessage.updateMany(
    {
      eventId,
      senderId,
      receiverId: userId,
      isRead: false
    },
    {
      $set: { isRead: true }
    }
  );

  // Emit a real-time event to the sender so they know their messages were read
  emitToUser(senderId, 'messages_read', {
    eventId,
    readerId: userId,
    readCount: result.modifiedCount
  });

  successResponse(res, {
    message: 'Messages marked as read successfully',
    modifiedCount: result.modifiedCount
  });
});

module.exports = {
  sendChatRequest,
  respondToChatRequest,
  getChatRequests,
  getChatMessages,
  getEventUsers,
  markMessagesAsRead
};

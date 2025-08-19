const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const UserEventSlot = require('../models/UserEventSlot');
const Meeting = require("../models/meeting");

const toggleShowSlots = asyncHandler(async (req, res) => {
  const { eventId, show } = req.body;
  const userSlot = await UserEventSlot.findOne({ userId: req.user.id, userType: req.user.type, eventId });
  if (!userSlot) return errorResponse(res, 'Slots not found', 404);
  userSlot.showSlots = show;
  await userSlot.save();
  successResponse(res, { message: 'Toggle updated' });
});

const getUserSlots = asyncHandler(async (req, res) => {
  const { eventId, targetUserId, targetUserType } = req.body; // Changed from params to body
  const userSlot = await UserEventSlot.findOne({ userId: targetUserId, userType: targetUserType, eventId });
  if (!userSlot || !userSlot.showSlots) return errorResponse(res, 'Slots not available or hidden', 403);
  const availableSlots = userSlot.slots.filter(s => s.status === 'available');
  successResponse(res, availableSlots);
});

const requestMeeting = asyncHandler(async (req, res) => {
  const { eventId, requesteeId, requesteeType, slotStart, slotEnd } = req.body;
  const userSlot = await UserEventSlot.findOne({ userId: requesteeId, userType: requesteeType, eventId });
  if (!userSlot) return errorResponse(res, 'Slots not found', 404);
  const slotIndex = userSlot.slots.findIndex(s => s.start.getTime() === new Date(slotStart).getTime() && s.status === 'available');
  if (slotIndex === -1) return errorResponse(res, 'Slot not available', 400);

  const meeting = new Meeting({
    eventId,
    requesterId: req.user.id,
    requesterType: req.user.type,
    requesteeId,
    requesteeType,
    slotStart: new Date(slotStart),
    slotEnd: new Date(slotEnd)
  });
  await meeting.save();

  userSlot.slots[slotIndex].status = 'requested';
  userSlot.slots[slotIndex].meetingId = meeting._id;
  await userSlot.save();
  successResponse(res, meeting, 201);
});

const respondToMeeting = asyncHandler(async (req, res) => {
  const { meetingId, status } = req.body;
  const meeting = await Meeting.findById(meetingId);
  if (!meeting || meeting.requesteeId.toString() !== req.user.id) return errorResponse(res, 'Invalid meeting', 404);
  meeting.status = status;
  await meeting.save();

  const userSlot = await UserEventSlot.findOne({ userId: req.user.id, userType: req.user.type, eventId: meeting.eventId });
  const slotIndex = userSlot.slots.findIndex(s => s.meetingId.toString() === meetingId);
  if (slotIndex !== -1) {
    userSlot.slots[slotIndex].status = status === 'accepted' ? 'booked' : 'available';
    if (status !== 'accepted') userSlot.slots[slotIndex].meetingId = null;
    await userSlot.save();
  }
  successResponse(res, meeting);
});

// Get user's meetings grouped by date
const getUserMeetingsByDate = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;

  let query = {
    $or: [
      { requesterId: userId, requesterType: userType },
      { requesteeId: userId, requesteeType: userType }
    ]
  };

  if (eventId) {
    query.eventId = eventId;
  }

  const meetings = await Meeting.find(query)
    .populate('eventId', 'title fromDate toDate location')
    .sort({ slotStart: 1 });

  // Group meetings by date and status
  const meetingsByDate = {};
  const statusCounts = {
    pending: 0,
    accepted: 0,
    rejected: 0,
    cancelled: 0
  };

  for (const meeting of meetings) {
    const dateKey = meeting.slotStart.toISOString().split('T')[0];
    
    if (!meetingsByDate[dateKey]) {
      meetingsByDate[dateKey] = {
        pending: [],
        accepted: [],
        rejected: [],
        cancelled: []
      };
    }

    // Get other participant details
    let otherParticipant;
    let otherParticipantType;
    let isRequester = false;

    if (meeting.requesterId.toString() === userId.toString()) {
      isRequester = true;
      otherParticipantType = meeting.requesteeType;
      if (meeting.requesteeType === 'exhibitor') {
        otherParticipant = await require('../models/Exhibitor').findById(meeting.requesteeId)
          .select('companyName email phone profileImage bio Sector location');
      } else {
        otherParticipant = await require('../models/Visitor').findById(meeting.requesteeId)
          .select('name email phone profileImage bio Sector location companyName');
      }
    } else {
      otherParticipantType = meeting.requesterType;
      if (meeting.requesterType === 'exhibitor') {
        otherParticipant = await require('../models/Exhibitor').findById(meeting.requesterId)
          .select('companyName email phone profileImage bio Sector location');
      } else {
        otherParticipant = await require('../models/Visitor').findById(meeting.requesterId)
          .select('name email phone profileImage bio Sector location companyName');
      }
    }

    const meetingData = {
      _id: meeting._id,
      eventId: meeting.eventId._id,
      eventTitle: meeting.eventId.title,
      eventLocation: meeting.eventId.location,
      slotStart: meeting.slotStart,
      slotEnd: meeting.slotEnd,
      status: meeting.status,
      createdAt: meeting.createdAt,
      otherParticipant,
      otherParticipantType,
      isRequester
    };

    meetingsByDate[dateKey][meeting.status].push(meetingData);
    statusCounts[meeting.status]++;
  }

  successResponse(res, {
    totalMeetings: meetings.length,
    statusCounts,
    meetingsByDate
  });
});

// Cancel a meeting
const cancelMeeting = asyncHandler(async (req, res) => {
  const { meetingId } = req.body;
  const userId = req.user.id;

  if (!meetingId) {
    return errorResponse(res, 'Meeting ID is required', 400);
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    return errorResponse(res, 'Meeting not found', 404);
  }

  // Check if user is part of this meeting
  if (meeting.requesterId.toString() !== userId.toString() && 
      meeting.requesteeId.toString() !== userId.toString()) {
    return errorResponse(res, 'You are not authorized to cancel this meeting', 403);
  }

  // Only allow cancellation of pending or accepted meetings
  if (!['pending', 'accepted'].includes(meeting.status)) {
    return errorResponse(res, 'Cannot cancel this meeting', 400);
  }

  // Update meeting status
  meeting.status = 'cancelled';
  await meeting.save();

  // Free up the slot if it was booked
  if (meeting.status === 'accepted') {
    const userSlot = await UserEventSlot.findOne({
      userId: meeting.requesteeId,
      userType: meeting.requesteeType,
      eventId: meeting.eventId
    });

    if (userSlot) {
      const slotIndex = userSlot.slots.findIndex(s => 
        s.meetingId && s.meetingId.toString() === meetingId
      );

      if (slotIndex !== -1) {
        userSlot.slots[slotIndex].status = 'available';
        userSlot.slots[slotIndex].meetingId = null;
        await userSlot.save();
      }
    }
  }

  successResponse(res, {
    message: 'Meeting cancelled successfully',
    meeting: {
      _id: meeting._id,
      status: meeting.status
    }
  });
});

module.exports = { 
  toggleShowSlots, 
  getUserSlots, 
  requestMeeting, 
  respondToMeeting,
  getUserMeetingsByDate,
  cancelMeeting
};
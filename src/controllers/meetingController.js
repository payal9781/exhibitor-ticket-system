const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const UserEventSlot = require('../models/UserEventSlot');
const Meeting = require('../models/Meeting');

const toggleShowSlots = asyncHandler(async (req, res) => {
  const { eventId, show } = req.body;
  const userSlot = await UserEventSlot.findOne({ userId: req.user._id, userType: req.user.type, eventId });
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
    requesterId: req.user._id,
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
  if (!meeting || meeting.requesteeId.toString() !== req.user._id) return errorResponse(res, 'Invalid meeting', 404);
  meeting.status = status;
  await meeting.save();

  const userSlot = await UserEventSlot.findOne({ userId: req.user._id, userType: req.user.type, eventId: meeting.eventId });
  const slotIndex = userSlot.slots.findIndex(s => s.meetingId.toString() === meetingId);
  if (slotIndex !== -1) {
    userSlot.slots[slotIndex].status = status === 'accepted' ? 'booked' : 'available';
    if (status !== 'accepted') userSlot.slots[slotIndex].meetingId = null;
    await userSlot.save();
  }
  successResponse(res, meeting);
});

module.exports = { toggleShowSlots, getUserSlots, requestMeeting, respondToMeeting };
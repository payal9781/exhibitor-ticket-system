const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const UserEventSlot = require('../models/UserEventSlot');
const generateSlots = require('../utils/slotGenerator');

const createEvent = asyncHandler(async (req, res) => {
  const event = new Event({ ...req.body, organizerId: req.user._id });
  await event.save();
  successResponse(res, event, 201);
});

const getEvents = asyncHandler(async (req, res) => {
  const { organizerId } = req.query;
  let query = {};
  if (req.user.type === 'organizer') query.organizerId = req.user._id;
  if (req.user.type === 'superAdmin' && organizerId) query.organizerId = organizerId;
  const events = await Event.find(query);
  successResponse(res, events);
});

const getEventById = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return errorResponse(res, 'Event not found', 404);
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user._id) return errorResponse(res, 'Access denied', 403);
  successResponse(res, event);
});

const updateEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return errorResponse(res, 'Event not found', 404);
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user._id) return errorResponse(res, 'Access denied', 403);
  Object.assign(event, req.body);
  await event.save();
  successResponse(res, event);
});

const deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return errorResponse(res, 'Event not found', 404);
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user._id) return errorResponse(res, 'Access denied', 403);
  event.isDeleted = true;
  await event.save();
  successResponse(res, { message: 'Event deleted' });
});

// Register user for event (exhibitor/visitor) and generate slots
const registerForEvent = asyncHandler(async (req, res) => {
  const { eventId, userId, userType } = req.body; // For admin/organizer to add, or self-register
  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, 'Event not found', 404);
  if (userType === 'exhibitor') {
    if (!event.exhibitor.includes(userId)) event.exhibitor.push(userId);
  } else if (userType === 'visitor') {
    if (!event.visitor.includes(userId)) event.visitor.push(userId);
  } else return errorResponse(res, 'Invalid user type');
  await event.save();

  // Generate slots
  const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
  const slots = rawSlots.map(s => ({ ...s, status: 'available' }));
  const userSlot = new UserEventSlot({ userId, userType, eventId, slots });
  await userSlot.save();

  // Generate QR
  const qrData = { eventId, userId, role: userType, startDate: event.fromDate, endDate: event.toDate };
  const qrCode = await require('../utils/qrGenerator')(qrData);
  successResponse(res, { message: 'Registered successfully', qrCode });
});

module.exports = { createEvent, getEvents, getEventById, updateEvent, deleteEvent, registerForEvent };
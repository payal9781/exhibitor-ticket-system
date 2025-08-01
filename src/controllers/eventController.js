const asyncHandler = require('../utils/asyncHandler');
const { response } = require('../utils/apiResponse');
const { models } = require('../models/z-index');

const createEvent = asyncHandler(async (req, res) => {
  const { title, description, fromDate, toDate, startTime, endTime, location } = req.body;
  const organizerId = req.user._id;

  const event = await models.Event.create({
    organizerId,
    title,
    description,
    fromDate,
    toDate,
    startTime,
    endTime,
    location
  });

  return response.create('Event created successfully', event, res);
});

const updateEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const updateData = req.body;

  const event = await models.Event.findOneAndUpdate(
    { _id: eventId, organizerId: req.user._id },
    updateData,
    { new: true }
  );

  if (!event) {
    return response.notFound('Event not found or unauthorized', res);
  }

  return response.success('Event updated successfully', event, res);
});

const deleteEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const event = await models.Event.findOneAndUpdate(
    { _id: eventId, organizerId: req.user._id },
    { isDeleted: true },
    { new: true }
  );

  if (!event) {
    return response.notFound('Event not found or unauthorized', res);
  }

  return response.success('Event deleted successfully', {}, res);
});

const getEvents = asyncHandler(async (req, res) => {
  const { organizerId } = req.query;
  const query = {};
  if (req.user.type === 'organizer') {
    query.organizerId = req.user._id;
  } else if (organizerId) {
    query.organizerId = organizerId;
  }
  query.isDeleted = false;

  const events = await models.Event.find(query).populate('organizerId');
  return response.success('Events retrieved successfully', events, res);
});

module.exports = { createEvent, updateEvent, deleteEvent, getEvents };
const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const UserEventSlot = require('../models/UserEventSlot');
const Attendance = require('../models/z-index').models.Attendance;
const generateSlots = require('../utils/slotGenerator');
const QRCode = require('qrcode');
const crypto = require('crypto');
const moment = require('moment');
const mongoose = require('mongoose');

const createEvent = asyncHandler(async (req, res) => {
  const { schedules, ...eventData } = req.body;

  if (schedules) {
    for (const schedule of schedules) {
      if (!schedule.activities || !Array.isArray(schedule.activities)) {
        return errorResponse(res, 'Each schedule must have an activities array', 400);
      }
      for (const activity of schedule.activities) {
        if (!activity.title || !activity.startTime || !activity.endTime) {
          return errorResponse(res, 'Activity title, startTime, and endTime are required', 400);
        }
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(activity.startTime) || !timeRegex.test(activity.endTime)) {
          return errorResponse(res, 'Invalid time format for activities. Use HH:MM', 400);
        }
      }
      if (schedule.date) {
        const scheduleDate = new Date(schedule.date);
        if (isNaN(scheduleDate.getTime()) || 
            scheduleDate < new Date(eventData.fromDate) || 
            scheduleDate > new Date(eventData.toDate)) {
          return errorResponse(res, 'Schedule date must be within event date range', 400);
        }
      }
    }
  }

  const event = new Event({ 
    ...eventData, 
    organizerId: req.user.id,
    schedules 
  });
  await event.save();
  successResponse(res, event, 201);
});

const addOrUpdateSchedule = asyncHandler(async (req, res) => {
  const { eventId, isCommon, date, activities } = req.body;

  if (!eventId || !activities || !Array.isArray(activities) || activities.length === 0) {
    return errorResponse(res, 'Event ID and activities array are required', 400);
  }

  for (const activity of activities) {
    if (!activity.title || !activity.startTime || !activity.endTime) {
      return errorResponse(res, 'Each activity must have title, startTime, and endTime', 400);
    }
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(activity.startTime) || !timeRegex.test(activity.endTime)) {
      return errorResponse(res, 'Invalid time format for activities. Use HH:MM', 400);
    }
  }

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, 'Event not found', 404);
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  const scheduleDate = isCommon ? null : new Date(date);
  if (!isCommon && !date) {
    return errorResponse(res, 'Date is required for date-specific schedules', 400);
  }
  if (!isCommon && (isNaN(scheduleDate.getTime()) || 
      scheduleDate < new Date(event.fromDate) || 
      scheduleDate > new Date(event.toDate))) {
    return errorResponse(res, 'Schedule date must be within event date range', 400);
  }

  const existingScheduleIndex = event.schedules.findIndex(
    (s) => (s.date === null && isCommon) || 
           (s.date && scheduleDate && s.date.toDateString() === scheduleDate.toDateString())
  );

  if (existingScheduleIndex !== -1) {
    event.schedules[existingScheduleIndex].activities = activities;
  } else {
    event.schedules.push({
      date: scheduleDate,
      activities
    });
  }

  await event.save();
  successResponse(res, {
    message: 'Schedule added/updated successfully',
    schedules: event.schedules
  });
});

const getSchedules = asyncHandler(async (req, res) => {
  const { eventId, mergeForDate } = req.body;

  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, 'Event not found', 404);
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  if (mergeForDate) {
    const targetDate = new Date(mergeForDate);
    if (isNaN(targetDate.getTime())) {
      return errorResponse(res, 'Invalid date format', 400);
    }
    const commonSchedule = event.schedules.find(s => s.date === null);
    const specificSchedule = event.schedules.find(s => s.date && s.date.toDateString() === targetDate.toDateString());

    const mergedActivities = [
      ...(commonSchedule ? commonSchedule.activities : []),
      ...(specificSchedule ? specificSchedule.activities : [])
    ];

    mergedActivities.sort((a, b) => a.startTime.localeCompare(b.startTime));

    successResponse(res, {
      message: 'Merged schedules for date',
      date: targetDate,
      activities: mergedActivities
    });
  } else {
    successResponse(res, {
      message: 'All schedules retrieved',
      schedules: event.schedules
    });
  }
});

const deleteSchedule = asyncHandler(async (req, res) => {
  const { eventId, date } = req.body;

  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, 'Event not found', 404);
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  const scheduleDate = date === 'common' || date === null ? null : new Date(date);
  if (date && date !== 'common' && isNaN(scheduleDate.getTime())) {
    return errorResponse(res, 'Invalid date format', 400);
  }

  event.schedules = event.schedules.filter(
    (s) => !((s.date === null && scheduleDate === null) || 
             (s.date && scheduleDate && s.date.toDateString() === scheduleDate.toDateString()))
  );

  await event.save();
  successResponse(res, {
    message: 'Schedule deleted successfully',
    remainingSchedules: event.schedules
  });
});

const getEvents = asyncHandler(async (req, res) => {
  const { organizerId, includeInactive = false, search, page = 1, limit = 10 } = req.body;
  let query = { isDeleted: false };

  if (!includeInactive) {
    query.isActive = true;
  }

  if (req.user.type === 'organizer') query.organizerId = req.user.id;
  if (req.user.type === 'superadmin' && organizerId) query.organizerId = organizerId;

  if (search && search.trim()) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;
  const total = await Event.countDocuments(query);

  const events = await Event.find(query)
    .populate('organizerId', 'name email organizationName')
    .sort({ fromDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const eventsWithStatus = events.map(event => {
    const eventObj = event.toObject();
    const eventEndDate = new Date(event.toDate);
    const currentDate = new Date();

    if (eventEndDate < currentDate) {
      eventObj.status = 'ended';
      eventObj.statusColor = 'red';
    } else if (new Date(event.fromDate) <= currentDate && eventEndDate >= currentDate) {
      eventObj.status = 'ongoing';
      eventObj.statusColor = 'orange';
    } else {
      eventObj.status = 'upcoming';
      eventObj.statusColor = 'green';
    }

    return eventObj;
  });

  const response = {
    events: eventsWithStatus,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  };

  successResponse(res, response);
});

const getEventById = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const event = await Event.findById(id).populate('organizerId', 'name email organizationName');
  if (!event) return errorResponse(res, 'Event not found', 404);
  if (req.user.type === 'organizer' && event.organizerId._id.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }
  successResponse(res, event);
});

const updateEvent = asyncHandler(async (req, res) => {
  const { id, schedules, ...updateData } = req.body;
  const event = await Event.findById(id);
  if (!event) return errorResponse(res, 'Event not found', 404);
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  if (schedules) {
    for (const schedule of schedules) {
      if (!schedule.activities || !Array.isArray(schedule.activities)) {
        return errorResponse(res, 'Each schedule must have an activities array', 400);
      }
      for (const activity of schedule.activities) {
        if (!activity.title || !activity.startTime || !activity.endTime) {
          return errorResponse(res, 'Activity title, startTime, and endTime are required', 400);
        }
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(activity.startTime) || !timeRegex.test(activity.endTime)) {
          return errorResponse(res, 'Invalid time format for activities. Use HH:MM', 400);
        }
      }
      if (schedule.date) {
        const scheduleDate = new Date(schedule.date);
        if (isNaN(scheduleDate.getTime()) || 
            scheduleDate < new Date(event.fromDate) || 
            scheduleDate > new Date(event.toDate)) {
          return errorResponse(res, 'Schedule date must be within event date range', 400);
        }
      }
    }
    event.schedules = schedules;
  }

  Object.assign(event, updateData);
  await event.save();
  successResponse(res, event);
});

const deleteEvent = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const event = await Event.findById(id);

  if (event.exhibitor.length > 0 || event.visitor.length > 0) {
    return successResponse(res, { message: 'Event has exhibitors or visitors, so it cannot be deleted', status: 400 });
  }

  if (!event) return errorResponse(res, 'Event not found', 404);
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }
  event.isDeleted = true;
  await event.save();
  successResponse(res, { message: 'Event deleted' });
});

const registerForEvent = asyncHandler(async (req, res) => {
  const { eventId, userId, userType } = req.body;
  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, 'Event not found', 404);

  const qrData = { 
    eventId, 
    userId, 
    userType, 
    startDate: event.fromDate, 
    endDate: event.toDate,
    eventTitle: event.title 
  };
  const qrResult = await generateParticipantQR(eventId, userId, userType, event.title);
  const qrCode = qrResult.qrCode;

  let isNewRegistration = false;

  if (userType === 'exhibitor') {
    const existingExhibitor = event.exhibitor.find(ex => ex.userId.toString() === userId);
    if (!existingExhibitor) {
      event.exhibitor.push({ userId, qrCode });
      isNewRegistration = true;
    }
  } else if (userType === 'visitor') {
    const existingVisitor = event.visitor.find(vis => vis.userId.toString() === userId);
    if (!existingVisitor) {
      event.visitor.push({ userId, qrCode });
      isNewRegistration = true;
    }
  } else {
    return errorResponse(res, 'Invalid user type', 400);
  }

  await event.save();

  if (isNewRegistration) {
    const existingSlots = await UserEventSlot.findOne({ userId, userType, eventId });
    if (!existingSlots) {
      const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
      const slots = rawSlots.map(s => ({ 
        start: s.start, 
        end: s.end, 
        status: 'available',
        showSlots: false 
      }));
      const userSlot = new UserEventSlot({ userId, userType, eventId, slots });
      await userSlot.save();
    }
  }

  successResponse(res, { 
    message: isNewRegistration ? 'Registered successfully' : 'Already registered for this event', 
    qrCode,
    isNewRegistration 
  });
});

const registerByLink = asyncHandler(async (req, res) => {
  const { registrationLink, type } = req.params;
  const participantData = req.body;

  if (!['exhibitor', 'visitor'].includes(type)) {
    return errorResponse(res, 'Invalid registration type. Must be "exhibitor" or "visitor"', 400);
  }

  if (!registrationLink) {
    return errorResponse(res, 'Registration link is required', 400);
  }

  const event = await Event.findOne({ registrationLink });
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  if (!event.isActive) {
    return errorResponse(res, 'Cannot register for inactive event', 400);
  }

  const requiredFields = type === 'exhibitor' 
    ? ['companyName', 'email', 'phone'] 
    : ['name', 'email', 'phone'];
  for (const field of requiredFields) {
    if (!participantData[field]) {
      return errorResponse(res, `${field} is required`, 400);
    }
  }

  const Model = type === 'exhibitor' ? Exhibitor : Visitor;
  let participant;
  let isNewParticipant = false;

  let existingParticipant = null;
  if (participantData.email) {
    existingParticipant = await Model.findOne({ email: participantData.email, isDeleted: false });
  }
  if (!existingParticipant && participantData.phone) {
    existingParticipant = await Model.findOne({ phone: participantData.phone, isDeleted: false });
  }

  if (existingParticipant) {
    Object.keys(participantData).forEach((key) => {
      if (participantData[key] && participantData[key] !== '') {
        existingParticipant[key] = participantData[key];
      }
    });
    participant = await existingParticipant.save();
  } else {
    participant = new Model({
      ...participantData,
      isActive: true,
    });
    await participant.save();
    isNewParticipant = true;
  }

  const qrData = {
    eventId: event._id,
    userId: participant._id,
    userType: type,
    startDate: event.fromDate,
    endDate: event.toDate,
    eventTitle: event.title,
  };
  const qrResult = await generateParticipantQR(event._id, participant._id, type, event.title);
  const qrCode = qrResult.qrCode;

  let isNewRegistration = false;
  const participantArray = type === 'exhibitor' ? event.exhibitor : event.visitor;
  const existingParticipantInEvent = participantArray.find(p => p.userId.toString() === participant._id.toString());

  if (!existingParticipantInEvent) {
    participantArray.push({ userId: participant._id, qrCode });
    isNewRegistration = true;
  } else {
    return errorResponse(res, `${type} already registered for this event`, 400);
  }

  await event.save();

  if (isNewRegistration) {
    const existingSlots = await UserEventSlot.findOne({
      userId: participant._id,
      userType: type,
      eventId: event._id,
    });

    if (!existingSlots) {
      const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
      const slots = rawSlots.map(s => ({
        start: s.start,
        end: s.end,
        status: 'available',
        showSlots: false,
      }));
      const userSlot = new UserEventSlot({
        userId: participant._id,
        userType: type,
        eventId: event._id,
        slots,
      });
      await userSlot.save();
    }
  }

  successResponse(res, {
    message: `${type} registered successfully`,
    qrCode,
    isNewRegistration,
    isNewParticipant,
    participant: {
      _id: participant._id,
      name: type === 'exhibitor' ? participant.companyName : participant.name,
      email: participant.email,
      phone: participant.phone,
    },
    event: {
      _id: event._id,
      title: event.title,
      fromDate: event.fromDate,
      toDate: event.toDate,
    },
  });
});

const getEventStats = asyncHandler(async (req, res) => {
  let query = { isDeleted: false };
  if (req.user.type === 'organizer') {
    query.organizerId = req.user.id;
  }

  const totalEvents = await Event.countDocuments(query);
  const activeEvents = await Event.countDocuments({ 
    ...query, 
    fromDate: { $lte: new Date() }, 
    toDate: { $gte: new Date() } 
  });
  const upcomingEvents = await Event.countDocuments({ 
    ...query, 
    fromDate: { $gt: new Date() } 
  });
  const pastEvents = await Event.countDocuments({ 
    ...query, 
    toDate: { $lt: new Date() } 
  });

  const stats = {
    totalEvents,
    activeEvents,
    upcomingEvents,
    pastEvents
  };

  successResponse(res, stats);
});

const getUpcomingEvents = asyncHandler(async (req, res) => {
  const currentDate = new Date();
  let query = { 
    isDeleted: false,
    isActive: true,
    fromDate: { $gte: currentDate }
  };

  if (req.user.type === 'organizer') {
    query.organizerId = req.user.id;
  }

  const upcomingEvents = await Event.find(query)
    .select('_id title fromDate toDate location isActive')
    .sort({ fromDate: 1 });

  successResponse(res, upcomingEvents);
});

const getAllParticipants = asyncHandler(async (req, res) => {
  const { search, type } = req.body;

  let exhibitors = [];
  let visitors = [];

  let searchQuery = { isDeleted: false, isActive: true };
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    searchQuery.$or = [
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  if (!type || type === 'exhibitor') {
    const exhibitorSearchQuery = { ...searchQuery };
    if (search) {
      exhibitorSearchQuery.$or.push({ companyName: new RegExp(search, 'i') });
    }

    exhibitors = await Exhibitor.find(exhibitorSearchQuery)
      .select('_id companyName email phone profileImage bio Sector location')
      .limit(50)
      .sort({ companyName: 1 });
  }

  if (!type || type === 'visitor') {
    const visitorSearchQuery = { ...searchQuery };
    if (search) {
      visitorSearchQuery.$or.push({ name: new RegExp(search, 'i') });
      visitorSearchQuery.$or.push({ companyName: new RegExp(search, 'i') });
    }

    visitors = await Visitor.find(visitorSearchQuery)
      .select('_id name email phone profileImage bio Sector location companyName')
      .limit(50)
      .sort({ name: 1 });
  }

  const formattedExhibitors = exhibitors.map((ex) => ({
    ...ex.toObject(),
    userType: 'exhibitor',
    displayName: ex.companyName,
  }));

  const formattedVisitors = visitors.map((vis) => ({
    ...vis.toObject(),
    userType: 'visitor',
    displayName: vis.name,
  }));

  successResponse(res, {
    exhibitors: formattedExhibitors,
    visitors: formattedVisitors,
    totalExhibitors: formattedExhibitors.length,
    totalVisitors: formattedVisitors.length,
    totalParticipants: formattedExhibitors.length + formattedVisitors.length,
  });
});

const addParticipantToEvent = asyncHandler(async (req, res) => {
  const { eventId, participantId, participantType, participantData } = req.body;

  if (!eventId || !participantType) {
    return errorResponse(res, 'Event ID and participant type are required', 400);
  }
  if (!['exhibitor', 'visitor'].includes(participantType)) {
    return errorResponse(res, 'Invalid participant type. Must be "exhibitor" or "visitor"', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, 'Event not found', 404);

  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  let participant;
  let isNewParticipant = false;

  if (participantId) {
    const Model = participantType === 'exhibitor' ? Exhibitor : Visitor;
    participant = await Model.findById(participantId);
    if (!participant) {
      return errorResponse(res, `${participantType} not found`, 404);
    }
  } else if (participantData) {
    const Model = participantType === 'exhibitor' ? Exhibitor : Visitor;
    const requiredFields = participantType === 'exhibitor' 
      ? ['companyName', 'email', 'phone'] 
      : ['name', 'email', 'phone'];
    for (const field of requiredFields) {
      if (!participantData[field]) {
        return errorResponse(res, `${field} is required`, 400);
      }
    }

    let existingParticipant = null;
    if (participantData.email) {
      existingParticipant = await Model.findOne({ email: participantData.email, isDeleted: false });
    }
    if (!existingParticipant && participantData.phone) {
      existingParticipant = await Model.findOne({ phone: participantData.phone, isDeleted: false });
    }

    if (existingParticipant) {
      Object.keys(participantData).forEach((key) => {
        if (participantData[key] && participantData[key] !== '') {
          existingParticipant[key] = participantData[key];
        }
      });
      participant = await existingParticipant.save();
    } else {
      participant = new Model({
        ...participantData,
        isActive: true
      });
      await participant.save();
      isNewParticipant = true;
    }
  } else {
    return errorResponse(res, 'Either participantId or participantData is required', 400);
  }

  const qrData = {
    eventId,
    userId: participant._id,
    userType: participantType,
    startDate: event.fromDate,
    endDate: event.toDate,
    eventTitle: event.title
  };
  const qrResult = await generateParticipantQR(eventId, participant._id, participantType, event.title);
  const qrCode = qrResult.qrCode;

  let isNewRegistration = false;

  if (participantType === 'exhibitor') {
    const existingExhibitor = event.exhibitor.find(ex => ex.userId.toString() === participant._id.toString());
    if (!existingExhibitor) {
      event.exhibitor.push({ userId: participant._id, qrCode });
      isNewRegistration = true;
    }
  } else {
    const existingVisitor = event.visitor.find(vis => vis.userId.toString() === participant._id.toString());
    if (!existingVisitor) {
      event.visitor.push({ userId: participant._id, qrCode });
      isNewRegistration = true;
    }
  }

  await event.save();

  if (isNewRegistration) {
    const existingSlots = await UserEventSlot.findOne({
      userId: participant._id,
      userType: participantType,
      eventId
    });

    if (!existingSlots) {
      const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
      const slots = rawSlots.map(s => ({ 
        start: s.start, 
        end: s.end, 
        status: 'available',
        showSlots: false 
      }));
      const userSlot = new UserEventSlot({
        userId: participant._id,
        userType: participantType,
        eventId,
        slots
      });
      await userSlot.save();
    }
  }

  successResponse(res, {
    message: isNewRegistration ?
      `${participantType} added to event successfully` :
      `${participantType} already registered for this event`,
    qrCode,
    isNewRegistration,
    isNewParticipant,
    participant: {
      _id: participant._id,
      name: participant.name || participant.companyName,
      email: participant.email,
      phone: participant.phone
    },
    event: {
      _id: event._id,
      title: event.title,
      fromDate: event.fromDate,
      toDate: event.toDate
    }
  });
});

const getEventParticipants = asyncHandler(async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }

  const event = await Event.findById(eventId)
    .populate('exhibitor.userId', 'companyName email phone profileImage bio Sector location isActive isDeleted')
    .populate('visitor.userId', 'name email phone profileImage bio Sector location companyName isActive isDeleted');

  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  const exhibitors = event.exhibitor.map(ex => ({
    ...ex.userId,
    qrCode: ex.qrCode,
    registeredAt: ex.registeredAt,
    userType: 'exhibitor'
  }));

  const visitors = event.visitor.map(vis => ({
    ...vis.userId,
    qrCode: vis.qrCode,
    registeredAt: vis.registeredAt,
    userType: 'visitor'
  }));

  successResponse(res, {
    eventId,
    eventTitle: event.title,
    totalParticipants: exhibitors.length + visitors.length,
    totalExhibitors: exhibitors.length,
    totalVisitors: visitors.length,
    exhibitors,
    visitors
  });
});

const updateEventStatus = asyncHandler(async (req, res) => {
  const currentDate = new Date();

  const endedEvents = await Event.find({
    isDeleted: false,
    isActive: true,
    toDate: { $lt: currentDate }
  });

  const updatePromises = endedEvents.map(event => {
    event.isActive = false;
    return event.save();
  });

  await Promise.all(updatePromises);

  successResponse(res, {
    message: `Updated ${endedEvents.length} events to inactive status`,
    updatedEvents: endedEvents.length
  });
});

const getEventStatusStats = asyncHandler(async (req, res) => {
  const currentDate = new Date();
  let query = { isDeleted: false };

  if (req.user.type === 'organizer') {
    query.organizerId = req.user.id;
  }

  const allEvents = await Event.find(query);

  const stats = {
    total: allEvents.length,
    active: 0,
    inactive: 0,
    upcoming: 0,
    ongoing: 0,
    ended: 0
  };

  allEvents.forEach(event => {
    const eventStartDate = new Date(event.fromDate);
    const eventEndDate = new Date(event.toDate);

    if (event.isActive) {
      stats.active++;
    } else {
      stats.inactive++;
    }

    if (eventEndDate < currentDate) {
      stats.ended++;
    } else if (eventStartDate <= currentDate && eventEndDate >= currentDate) {
      stats.ongoing++;
    } else {
      stats.upcoming++;
    }
  });

  successResponse(res, stats);
});

const getAvailableParticipants = asyncHandler(async (req, res) => {
  const { eventId, search = '', userType = 'all' } = req.body;

  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  const registeredExhibitorIds = event.exhibitor.map(ex => ex.userId.toString());
  const registeredVisitorIds = event.visitor.map(vis => vis.userId.toString());
  let availableParticipants = [];

  if (userType === 'all' || userType === 'exhibitor') {
    const searchQuery = {
      isDeleted: false,
      isActive: true,
      _id: { $nin: registeredExhibitorIds }
    };
    if (search) {
      searchQuery.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { Sector: { $regex: search, $options: 'i' } }
      ];
    }
    const exhibitors = await Exhibitor.find(searchQuery)
      .select('companyName email phone bio Sector location website')
      .limit(50);
    const exhibitorData = exhibitors.map(ex => ({
      _id: ex._id,
      name: ex.companyName,
      email: ex.email,
      phone: ex.phone,
      bio: ex.bio,
      Sector: ex.Sector,
      location: ex.location,
      website: ex.website,
      userType: 'exhibitor',
      displayName: `${ex.companyName} (${ex.email})`,
      isRegistered: false
    }));
    availableParticipants = [...availableParticipants, ...exhibitorData];
  }

  if (userType === 'all' || userType === 'visitor') {
    const searchQuery = {
      isDeleted: false,
      isActive: true,
      _id: { $nin: registeredVisitorIds }
    };
    if (search) {
      searchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { Sector: { $regex: search, $options: 'i' } }
      ];
    }
    const visitors = await Visitor.find(searchQuery)
      .select('name email phone bio Sector location companyName')
      .limit(50);
    const visitorData = visitors.map(vis => ({
      _id: vis._id,
      name: vis.name,
      email: vis.email,
      phone: vis.phone,
      bio: vis.bio,
      Sector: vis.Sector,
      location: vis.location,
      companyName: vis.companyName,
      userType: 'visitor',
      displayName: `${vis.name} (${vis.email})`,
      isRegistered: false
    }));
    availableParticipants = [...availableParticipants, ...visitorData];
  }

  availableParticipants.sort((a, b) => a.name.localeCompare(b.name));
  successResponse(res, {
    eventId,
    eventTitle: event.title,
    participants: availableParticipants,
    totalAvailable: availableParticipants.length,
    searchTerm: search,
    userType
  });
});

const generateParticipantQR = async (eventId, userId, userType, eventTitle) => {
  const qrData = {
    eventId,
    userId,
    userType,
    eventTitle,
    timestamp: new Date().toISOString(),
    qrId: crypto.randomBytes(16).toString('hex')
  };
  try {
    const qrCodeString = await QRCode.toDataURL(JSON.stringify(qrData));
    return {
      qrCode: qrCodeString,
      qrData: JSON.stringify(qrData),
      qrId: qrData.qrId
    };
  } catch (error) {
    console.error('QR Code generation error:', error);
    return {
      qrCode: `QR_${eventId}_${userId}_${Date.now()}`,
      qrData: JSON.stringify(qrData),
      qrId: qrData.qrId
    };
  }
};

const addParticipantToEventComprehensive = asyncHandler(async (req, res) => {
  const { eventId, userId, userType } = req.body;

  if (!eventId || !userId || !userType) {
    return errorResponse(res, 'Event ID, User ID, and User Type are required', 400);
  }
  if (!['exhibitor', 'visitor'].includes(userType)) {
    return errorResponse(res, 'User type must be either exhibitor or visitor', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  if (!event.isActive) {
    return errorResponse(res, 'Cannot add participants to inactive events', 400);
  }

  const UserModel = userType === 'exhibitor' ? Exhibitor : Visitor;
  const user = await UserModel.findById(userId);
  if (!user) {
    return errorResponse(res, `${userType} not found`, 404);
  }
  if (!user.isActive || user.isDeleted) {
    return errorResponse(res, `${userType} is not active`, 400);
  }

  const participantArray = userType === 'exhibitor' ? event.exhibitor : event.visitor;
  const isAlreadyRegistered = participantArray.some(p => p.userId.toString() === userId);

  if (isAlreadyRegistered) {
    return errorResponse(res, `${userType} is already registered for this event`, 400);
  }

  const qrResult = await generateParticipantQR(eventId, userId, userType, event.title);
  const qrCode = qrResult.qrCode;

  const participantData = {
    userId,
    qrCode,
    registeredAt: new Date()
  };

  if (userType === 'exhibitor') {
    event.exhibitor.push(participantData);
  } else {
    event.visitor.push(participantData);
  }

  await event.save();

  try {
    const existingSlots = await UserEventSlot.findOne({
      userId,
      userType,
      eventId,
    });

    if (!existingSlots) {
      const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
      const slots = rawSlots.map(s => ({
        start: s.start,
        end: s.end,
        status: 'available',
        showSlots: false
      }));
      const userSlot = new UserEventSlot({
        userId,
        userType,
        eventId,
        slots
      });
      await userSlot.save();
    }
  } catch (slotError) {
    console.error('Error generating slots:', slotError);
  }

  const updatedEvent = await Event.findById(eventId)
    .populate(`${userType}.userId`, userType === 'exhibitor' ? 'companyName email phone' : 'name email phone');
  const addedParticipant = updatedEvent[userType].find(p => p.userId._id.toString() === userId);

  successResponse(res, {
    message: `${userType} added to event successfully`,
    participant: {
      _id: addedParticipant.userId._id,
      name: userType === 'exhibitor' ? addedParticipant.userId.companyName : addedParticipant.userId.name,
      email: addedParticipant.userId.email,
      phone: addedParticipant.userId.phone,
      userType,
      qrCode: addedParticipant.qrCode,
      registeredAt: addedParticipant.registeredAt
    },
    eventTitle: event.title,
    totalSlots: slots ? slots.length : 0
  });
});

const addMultipleParticipantsToEvent = asyncHandler(async (req, res) => {
  const { eventId, participants } = req.body;

  if (!eventId || !participants || !Array.isArray(participants)) {
    return errorResponse(res, 'Event ID and participants array are required', 400);
  }
  if (participants.length === 0) {
    return errorResponse(res, 'At least one participant is required', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }
  if (!event.isActive) {
    return errorResponse(res, 'Cannot add participants to inactive events', 400);
  }

  const results = {
    successful: [],
    failed: [],
    totalProcessed: participants.length
  };

  for (const participant of participants) {
    try {
      const { userId, userType } = participant;

      if (!userId || !userType || !['exhibitor', 'visitor'].includes(userType)) {
        results.failed.push({
          userId,
          userType,
          error: 'Invalid user ID or user type'
        });
        continue;
      }

      const participantArray = userType === 'exhibitor' ? event.exhibitor : event.visitor;
      const isAlreadyRegistered = participantArray.some(p => p.userId.toString() === userId);

      if (isAlreadyRegistered) {
        results.failed.push({
          userId,
          userType,
          error: 'Already registered for this event'
        });
        continue;
      }

      const UserModel = userType === 'exhibitor' ? Exhibitor : Visitor;
      const user = await UserModel.findById(userId);

      if (!user || !user.isActive || user.isDeleted) {
        results.failed.push({
          userId,
          userType,
          error: 'User not found or inactive'
        });
        continue;
      }

      const qrResult = await generateParticipantQR(eventId, userId, userType, event.title);
      const qrCode = qrResult.qrCode;

      const participantData = {
        userId,
        qrCode,
        registeredAt: new Date()
      };

      if (userType === 'exhibitor') {
        event.exhibitor.push(participantData);
      } else {
        event.visitor.push(participantData);
      }

      try {
        const existingSlots = await UserEventSlot.findOne({
          userId,
          userType,
          eventId,
        });

        if (!existingSlots) {
          const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
          const slots = rawSlots.map(s => ({
            start: s.start,
            end: s.end,
            status: 'available',
            showSlots: false
          }));
          const userSlot = new UserEventSlot({
            userId,
            userType,
            eventId,
            slots
          });
          await userSlot.save();
        }
      } catch (slotError) {
        console.error('Error generating slots for user:', userId, slotError);
      }

      results.successful.push({
        userId,
        userType,
        name: userType === 'exhibitor' ? user.companyName : user.name,
        email: user.email
      });
    } catch (error) {
      results.failed.push({
        userId: participant.userId,
        userType: participant.userType,
        error: error.message
      });
    }
  }

  await event.save();
  successResponse(res, {
    message: `Processed ${results.totalProcessed} participants`,
    results,
    eventTitle: event.title,
    successCount: results.successful.length,
    failureCount: results.failed.length
  });
});

const removeParticipantFromEvent = asyncHandler(async (req, res) => {
  const { eventId, userId, userType } = req.body;

  if (!eventId || !userId || !userType) {
    return errorResponse(res, 'Event ID, User ID, and User Type are required', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  if (userType === 'exhibitor') {
    event.exhibitor = event.exhibitor.filter(ex => ex.userId.toString() !== userId);
  } else {
    event.visitor = event.visitor.filter(vis => vis.userId.toString() !== userId);
  }

  await event.save();

  await UserEventSlot.deleteMany({
    eventId,
    userId,
    userType
  });

  successResponse(res, {
    message: `${userType} removed from event successfully`,
    eventTitle: event.title
  });
});

const scanQRForAttendance = asyncHandler(async (req, res) => {
  const { qrData } = req.body;
  const scannerId = req.user.id;
  const scannerType = req.user.type;

  if (!qrData) {
    return errorResponse(res, 'QR data is required', 400);
  }

  try {
    let parsedQRData;
    try {
      parsedQRData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch (parseError) {
      return errorResponse(res, 'Invalid QR code format', 400);
    }

    const { eventId, userId, userType, startDate, endDate } = parsedQRData;
    if (!eventId || !userId || !userType || !startDate || !endDate) {
      return errorResponse(res, 'Invalid QR code data', 400);
    }

    const event = await Event.findById(eventId);
    if (!event || !event.isActive || event.isDeleted) {
      return errorResponse(res, 'Event not found or inactive', 404);
    }

    const currentDate = new Date();
    const eventStartDate = new Date(startDate);
    const eventEndDate = new Date(endDate);
    const bufferDate = new Date(eventStartDate);
    bufferDate.setDate(bufferDate.getDate() - 1);

    if (currentDate < bufferDate || currentDate > eventEndDate) {
      return errorResponse(res, 'QR code is not valid for current date', 400);
    }

    const UserModel = userType === 'exhibitor' ? Exhibitor : Visitor;
    const user = await UserModel.findById(userId);

    if (!user || !user.isActive || user.isDeleted) {
      return errorResponse(res, 'User not found or inactive', 404);
    }

    const participantArray = userType === 'exhibitor' ? event.exhibitor : event.visitor;
    const isRegistered = participantArray.some(p => p.userId.toString() === userId);

    if (!isRegistered) {
      return errorResponse(res, 'User is not registered for this event', 403);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      userId,
      eventId,
      attendanceDate: today
    });

    if (existingAttendance) {
      return successResponse(res, {
        message: 'Attendance already recorded for today',
        attendance: existingAttendance,
        user: {
          name: user.name || user.companyName,
          type: userType
        }
      });
    }

    const attendance = new Attendance({
      userId,
      userModel: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor',
      eventId,
      attendanceDate: today,
      scannedBy: scannerId,
      scannedByModel: 'User',
      qrData: parsedQRData
    });

    await attendance.save();
    successResponse(res, {
      message: 'Attendance recorded successfully',
      attendance,
      user: {
        name: user.name || user.companyName,
        type: userType
      },
      event: {
        title: event.title,
        location: event.location
      }
    });
  } catch (error) {
    console.error('QR scan error:', error);
    return errorResponse(res, 'Failed to process QR scan', 500);
  }
});

const getAttendanceStats = asyncHandler(async (req, res) => {
  const organizerId = req.user.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const organizerEvents = await Event.find({
      organizerId,
      isActive: true,
      isDeleted: false
    }).select('_id title');

    const eventIds = organizerEvents.map(event => event._id);

    const todayAttendance = await Attendance.find({
      eventId: { $in: eventIds },
      attendanceDate: {
        $gte: today,
        $lt: tomorrow
      }
    })
      .populate('userId', 'name companyName')
      .populate('eventId', 'title location')
      .sort({ scanTime: -1 });

    const stats = {
      totalScansToday: todayAttendance.length,
      uniqueParticipantsToday: new Set(todayAttendance.map(a => a.userId._id.toString())).size,
      exhibitorsToday: todayAttendance.filter(a => a.userModel === 'Exhibitor').length,
      visitorsToday: todayAttendance.filter(a => a.userModel === 'Visitor').length,
      recentScans: todayAttendance.slice(0, 10).map(attendance => ({
        user: {
          name: attendance.userId.name || attendance.userId.companyName,
          type: attendance.userModel.toLowerCase()
        },
        event: {
          title: attendance.eventId.title,
          location: attendance.eventId.location
        },
        attendance: {
          attendanceDate: attendance.attendanceDate,
          scanTime: attendance.scanTime
        }
      }))
    };

    successResponse(res, stats);
  } catch (error) {
    console.error('Failed to get attendance stats:', error);
    return errorResponse(res, 'Failed to get attendance statistics', 500);
  }
});

const addSponsor = asyncHandler(async (req, res) => {
  const { eventId, sponsorData } = req.body;

  if (!eventId || !sponsorData || !sponsorData.name) {
    return errorResponse(res, 'Event ID and sponsor name are required', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, 'Event not found', 404);

  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  const newSponsor = {
    name: sponsorData.name,
    logo: sponsorData.logo,
    description: sponsorData.description,
    website: sponsorData.website,
    tier: sponsorData.tier,
    addedAt: new Date()
  };

  event.sponsors.push(newSponsor);
  await event.save();

  successResponse(res, {
    message: 'Sponsor added successfully',
    sponsor: event.sponsors[event.sponsors.length - 1]
  });
});

const updateSponsor = asyncHandler(async (req, res) => {
  const { eventId, sponsorId, sponsorData } = req.body;

  if (!eventId || !sponsorId || !sponsorData) {
    return errorResponse(res, 'Event ID, sponsor ID, and update data are required', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, 'Event not found', 404);

  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  const sponsor = event.sponsors.id(sponsorId);
  if (!sponsor) {
    return errorResponse(res, 'Sponsor not found', 404);
  }

  if (sponsorData.name) sponsor.name = sponsorData.name;
  if (sponsorData.logo) sponsor.logo = sponsorData.logo;
  if (sponsorData.description) sponsor.description = sponsorData.description;
  if (sponsorData.website) sponsor.website = sponsorData.website;
  if (sponsorData.tier) sponsor.tier = sponsorData.tier;

  await event.save();

  successResponse(res, {
    message: 'Sponsor updated successfully',
    sponsor
  });
});

const removeSponsor = asyncHandler(async (req, res) => {
  const { eventId, sponsorId } = req.body;

  if (!eventId || !sponsorId) {
    return errorResponse(res, 'Event ID and sponsor ID are required', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, 'Event not found', 404);

  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  const sponsor = event.sponsors.id(sponsorId);
  if (!sponsor) {
    return errorResponse(res, 'Sponsor not found', 404);
  }

  event.sponsors.pull(sponsorId);
  await event.save();

  successResponse(res, {
    message: 'Sponsor removed successfully'
  });
});

const getSponsors = asyncHandler(async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }

  const event = await Event.findById(eventId).select('sponsors');
  if (!event) return errorResponse(res, 'Event not found', 404);

  successResponse(res, {
    sponsors: event.sponsors,
    total: event.sponsors.length
  });
});

module.exports = {
  createEvent,
  addOrUpdateSchedule,
  getSchedules,
  deleteSchedule,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  registerForEvent,
  registerByLink,
  getEventStats,
  getUpcomingEvents,
  getAllParticipants,
  addParticipantToEvent,
  getEventParticipants,
  updateEventStatus,
  getEventStatusStats,
  getAvailableParticipants,
  addParticipantToEventComprehensive,
  addMultipleParticipantsToEvent,
  removeParticipantFromEvent,
  scanQRForAttendance,
  getAttendanceStats,
  addSponsor,
  updateSponsor,
  removeSponsor,
  getSponsors
};
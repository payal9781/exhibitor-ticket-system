const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const UserEventSlot = require('../models/UserEventSlot');
const Attendance = require('../models/Attendance');
const generateSlots = require('../utils/slotGenerator');
const QRCode = require('qrcode');
const crypto = require('crypto');

const createEvent = asyncHandler(async (req, res) => {
  const event = new Event({ ...req.body, organizerId: req.user._id });
  await event.save();
  successResponse(res, event, 201);
});

const getEvents = asyncHandler(async (req, res) => {
  const { organizerId, includeInactive = false, search, page = 1, limit = 10 } = req.body;
  let query = { isDeleted: false };
  
  // Only include active events unless specifically requested
  if (!includeInactive) {
    query.isActive = true;
  }
  
  if (req.user.type === 'organizer') query.organizerId = req.user._id;
  if (req.user.type === 'superadmin' && organizerId) query.organizerId = organizerId;
  
  // Add search functionality
  if (search && search.trim()) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Calculate pagination
  const skip = (page - 1) * limit;
  const total = await Event.countDocuments(query);
  
  const events = await Event.find(query)
    .populate('organizerId', 'name email organizationName')
    .sort({ fromDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));
    
  // Add status indicators
  const currentDate = new Date();
  const eventsWithStatus = events.map(event => {
    const eventObj = event.toObject();
    const eventEndDate = new Date(event.toDate);
    
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
  if (req.user.type === 'organizer' && event.organizerId._id.toString() !== req.user._id) return errorResponse(res, 'Access denied', 403);
  successResponse(res, event);
});

const updateEvent = asyncHandler(async (req, res) => {
  const { id, ...updateData } = req.body;
  const event = await Event.findById(id);
  if (!event) return errorResponse(res, 'Event not found', 404);
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user._id) return errorResponse(res, 'Access denied', 403);
  Object.assign(event, updateData);
  await event.save();
  successResponse(res, event);
});

const deleteEvent = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const event = await Event.findById(id);

  if(event.exhibitor.length > 0 || event.visitor.length > 0){
    return successResponse(res, { message: 'Event has exhibitors or visitors, so it cannot be deleted', status: 400 });
  }

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

  // Generate QR code data
  const qrData = { 
    eventId, 
    userId, 
    userType, 
    startDate: event.fromDate, 
    endDate: event.toDate,
    eventTitle: event.title 
  };
  const qrCode = await require('../utils/qrGenerator')(qrData);

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

  // Generate slots only for new registrations
  if (isNewRegistration) {
    // Check if user already has slots for this event
    const existingSlots = await UserEventSlot.findOne({ userId, userType, eventId });
    if (!existingSlots) {
      const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
      const slots = rawSlots.map(s => ({ ...s, status: 'available' }));
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

// Get event statistics
const getEventStats = asyncHandler(async (req, res) => {
  let query = { isDeleted: false };
  if (req.user.type === 'organizer') {
    query.organizerId = req.user._id;
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

// Get upcoming events for organizer (for dropdown in add participant)
const getUpcomingEvents = asyncHandler(async (req, res) => {
  const currentDate = new Date();
  let query = { 
    isDeleted: false,
    isActive: true,
    fromDate: { $gte: currentDate } // Only upcoming active events
  };
  
  if (req.user.type === 'organizer') {
    query.organizerId = req.user._id;
  }
  
  const upcomingEvents = await Event.find(query)
    .select('_id title fromDate toDate location isActive')
    .sort({ fromDate: 1 });
  
  successResponse(res, upcomingEvents);
});

// Get all participants (exhibitors and visitors) for organizer dropdown
const getAllParticipants = asyncHandler(async (req, res) => {
  const { search, type } = req.body; // search term and type filter
  
  let exhibitors = [];
  let visitors = [];
  
  // Build search query
  let searchQuery = { isDeleted: false, isActive: true };
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    searchQuery.$or = [
      { email: searchRegex },
      { phone: searchRegex }
    ];
  }
  
  // Get exhibitors if type is not specified or is 'exhibitor'
  if (!type || type === 'exhibitor') {
    const exhibitorSearchQuery = { ...searchQuery };
    if (search) {
      exhibitorSearchQuery.$or.push({ companyName: new RegExp(search, 'i') });
    }
    
    exhibitors = await require('../models/Exhibitor').find(exhibitorSearchQuery)
      .select('_id companyName email phone profileImage bio Sector location')
      .limit(50)
      .sort({ companyName: 1 });
  }
  
  // Get visitors if type is not specified or is 'visitor'  
  if (!type || type === 'visitor') {
    const visitorSearchQuery = { ...searchQuery };
    if (search) {
      visitorSearchQuery.$or.push({ name: new RegExp(search, 'i') });
      visitorSearchQuery.$or.push({ companyName: new RegExp(search, 'i') });
    }
    
    visitors = await require('../models/Visitor').find(visitorSearchQuery)
      .select('_id name email phone profileImage bio Sector location companyName')
      .limit(50)
      .sort({ name: 1 });
  }
  
  // Format response
  const formattedExhibitors = exhibitors.map(ex => ({
    ...ex.toObject(),
    userType: 'exhibitor',
    displayName: ex.companyName
  }));
  
  const formattedVisitors = visitors.map(vis => ({
    ...vis.toObject(),
    userType: 'visitor',
    displayName: vis.name
  }));
  
  successResponse(res, {
    exhibitors: formattedExhibitors,
    visitors: formattedVisitors,
    totalExhibitors: formattedExhibitors.length,
    totalVisitors: formattedVisitors.length,
    totalParticipants: formattedExhibitors.length + formattedVisitors.length
  });
});

// Add exhibitor/visitor to event by organizer with participant creation if needed
const addParticipantToEvent = asyncHandler(async (req, res) => {
  const { 
    eventId, 
    participantId, 
    participantType, 
    participantData // New participant data if creating new participant
  } = req.body;
  
  if (!eventId || !participantType) {
    return errorResponse(res, 'Event ID and participant type are required', 400);
  }

  if (!['exhibitor', 'visitor'].includes(participantType)) {
    return errorResponse(res, 'Invalid participant type. Must be "exhibitor" or "visitor"', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, 'Event not found', 404);

  // Check if organizer owns this event
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user._id) {
    return errorResponse(res, 'Access denied', 403);
  }

  let participant;
  let isNewParticipant = false;

  // If participantId is provided, find existing participant
  if (participantId) {
    if (participantType === 'exhibitor') {
      participant = await require('../models/Exhibitor').findById(participantId);
    } else {
      participant = await require('../models/Visitor').findById(participantId);
    }

    if (!participant) {
      return errorResponse(res, `${participantType} not found`, 404);
    }
  } 
  // If participantData is provided, create new participant or find existing by email/phone
  else if (participantData) {
    const Model = participantType === 'exhibitor' ? 
      require('../models/Exhibitor') : 
      require('../models/Visitor');

    // Check if participant already exists by phone or email
    let existingParticipant = null;
    if (participantData.phone) {
      existingParticipant = await Model.findOne({ 
        phone: participantData.phone, 
        isDeleted: false 
      });
    }
    
    if (!existingParticipant && participantData.email) {
      existingParticipant = await Model.findOne({ 
        email: participantData.email, 
        isDeleted: false 
      });
    }

    if (existingParticipant) {
      // Update existing participant with new data
      Object.keys(participantData).forEach(key => {
        if (participantData[key] && participantData[key] !== '') {
          existingParticipant[key] = participantData[key];
        }
      });
      participant = await existingParticipant.save();
    } else {
      // Create new participant
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

  // Generate QR code data
  const qrData = { 
    eventId, 
    userId: participant._id, 
    userType: participantType, 
    startDate: event.fromDate, 
    endDate: event.toDate,
    eventTitle: event.title 
  };
  const qrCode = await require('../utils/qrGenerator')(qrData);

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

  // Generate slots only for new registrations
  if (isNewRegistration) {
    const existingSlots = await UserEventSlot.findOne({ 
      userId: participant._id, 
      userType: participantType, 
      eventId 
    });
    
    if (!existingSlots) {
      const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
      const slots = rawSlots.map(s => ({ ...s, status: 'available' }));
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

// Get event participants (exhibitors and visitors)
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

  // Check access permissions
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user._id) {
    return errorResponse(res, 'Access denied', 403);
  }

  const exhibitors = event.exhibitor.map(ex => ({
    ...ex.userId.toObject(),
    qrCode: ex.qrCode,
    registeredAt: ex.registeredAt,
    userType: 'exhibitor'
  }));

  const visitors = event.visitor.map(vis => ({
    ...vis.userId.toObject(),
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

// Update event status based on current date
const updateEventStatus = asyncHandler(async (req, res) => {
  const currentDate = new Date();
  
  // Find events that have ended but are still marked as active
  const endedEvents = await Event.find({
    isDeleted: false,
    isActive: true,
    toDate: { $lt: currentDate }
  });
  
  // Update ended events to inactive
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

// Get event statistics with status breakdown
const getEventStatusStats = asyncHandler(async (req, res) => {
  const currentDate = new Date();
  let query = { isDeleted: false };
  
  if (req.user.type === 'organizer') {
    query.organizerId = req.user._id;
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

// ===== COMPREHENSIVE PARTICIPANT MANAGEMENT =====

// Get all available exhibitors and visitors for selection
const getAvailableParticipants = asyncHandler(async (req, res) => {
  const { eventId, search = '', userType = 'all' } = req.body;
  
  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }

  // Verify event exists and user has access
  const event = await Event.findById(eventId);
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  // Check access permissions
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user._id) {
    return errorResponse(res, 'Access denied', 403);
  }

  // Get already registered participant IDs
  const registeredExhibitorIds = event.exhibitor.map(ex => ex.userId.toString());
  const registeredVisitorIds = event.visitor.map(vis => vis.userId.toString());

  let availableParticipants = [];

  // Search exhibitors
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

  // Search visitors
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

  // Sort by name
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

// Generate QR code for participant
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

// Add single participant to event
const addParticipantToEventComprehensive = asyncHandler(async (req, res) => {
  const { eventId, userId, userType } = req.body;
  
  if (!eventId || !userId || !userType) {
    return errorResponse(res, 'Event ID, User ID, and User Type are required', 400);
  }

  if (!['exhibitor', 'visitor'].includes(userType)) {
    return errorResponse(res, 'User type must be either exhibitor or visitor', 400);
  }

  // Verify event exists and user has access
  const event = await Event.findById(eventId);
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  // Check access permissions
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user._id) {
    return errorResponse(res, 'Access denied', 403);
  }

  // Check if event is still active for registration
  if (!event.isActive) {
    return errorResponse(res, 'Cannot add participants to inactive events', 400);
  }

  // Verify user exists
  const UserModel = userType === 'exhibitor' ? Exhibitor : Visitor;
  const user = await UserModel.findById(userId);
  if (!user) {
    return errorResponse(res, `${userType} not found`, 404);
  }

  if (!user.isActive || user.isDeleted) {
    return errorResponse(res, `${userType} is not active`, 400);
  }

  // Check if already registered
  const participantArray = userType === 'exhibitor' ? event.exhibitor : event.visitor;
  const isAlreadyRegistered = participantArray.some(p => p.userId.toString() === userId);
  
  if (isAlreadyRegistered) {
    return errorResponse(res, `${userType} is already registered for this event`, 400);
  }

  // Generate QR code
  const qrResult = await generateParticipantQR(eventId, userId, userType, event.title);

  // Add to event
  const participantData = {
    userId,
    qrCode: qrResult.qrCode,
    registeredAt: new Date()
  };

  if (userType === 'exhibitor') {
    event.exhibitor.push(participantData);
  } else {
    event.visitor.push(participantData);
  }

  await event.save();

  // Generate 30-minute slots for the participant
  try {
    const slots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
    
    const userSlots = slots.map(slot => ({
      eventId,
      userId,
      userType,
      start: slot.start,
      end: slot.end,
      status: 'available',
      showSlots: false // Default to hidden
    }));

    await UserEventSlot.insertMany(userSlots);
  } catch (slotError) {
    console.error('Error generating slots:', slotError);
    // Don't fail the registration if slot generation fails
  }

  // Get updated participant info
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

// Add multiple participants to event
const addMultipleParticipantsToEvent = asyncHandler(async (req, res) => {
  const { eventId, participants } = req.body; // participants: [{ userId, userType }]
  
  if (!eventId || !participants || !Array.isArray(participants)) {
    return errorResponse(res, 'Event ID and participants array are required', 400);
  }

  if (participants.length === 0) {
    return errorResponse(res, 'At least one participant is required', 400);
  }

  // Verify event exists and user has access
  const event = await Event.findById(eventId);
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  // Check access permissions
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user._id) {
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

  // Process each participant
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

      // Check if already registered
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

      // Verify user exists
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

      // Generate QR code
      const qrResult = await generateParticipantQR(eventId, userId, userType, event.title);

      // Add to event
      const participantData = {
        userId,
        qrCode: qrResult.qrCode,
        registeredAt: new Date()
      };

      if (userType === 'exhibitor') {
        event.exhibitor.push(participantData);
      } else {
        event.visitor.push(participantData);
      }

      // Generate slots
      try {
        const slots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
        
        const userSlots = slots.map(slot => ({
          eventId,
          userId,
          userType,
          start: slot.start,
          end: slot.end,
          status: 'available',
          showSlots: false
        }));

        await UserEventSlot.insertMany(userSlots);
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

  // Save event with all new participants
  await event.save();

  successResponse(res, {
    message: `Processed ${results.totalProcessed} participants`,
    results,
    eventTitle: event.title,
    successCount: results.successful.length,
    failureCount: results.failed.length
  });
});

// Remove participant from event
const removeParticipantFromEvent = asyncHandler(async (req, res) => {
  const { eventId, userId, userType } = req.body;
  
  if (!eventId || !userId || !userType) {
    return errorResponse(res, 'Event ID, User ID, and User Type are required', 400);
  }

  // Verify event exists and user has access
  const event = await Event.findById(eventId);
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  // Check access permissions
  if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user._id) {
    return errorResponse(res, 'Access denied', 403);
  }

  // Remove from event
  if (userType === 'exhibitor') {
    event.exhibitor = event.exhibitor.filter(ex => ex.userId.toString() !== userId);
  } else {
    event.visitor = event.visitor.filter(vis => vis.userId.toString() !== userId);
  }

  await event.save();

  // Remove user slots
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

// QR Code scanning for attendance
const scanQRForAttendance = asyncHandler(async (req, res) => {
  const { qrData } = req.body;
  const scannerId = req.user._id;
  const scannerType = req.user.type; // 'organizer' or 'superadmin'

  if (!qrData) {
    return errorResponse(res, 'QR data is required', 400);
  }

  try {
    // Parse QR data (assuming it's JSON string)
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

    // Verify event exists and is active
    const event = await Event.findById(eventId);
    if (!event || !event.isActive || event.isDeleted) {
      return errorResponse(res, 'Event not found or inactive', 404);
    }

    // Check if current date is within event period
    const currentDate = new Date();
    const eventStartDate = new Date(startDate);
    const eventEndDate = new Date(endDate);

    if (currentDate < eventStartDate || currentDate > eventEndDate) {
      return errorResponse(res, 'QR code is not valid for current date', 400);
    }

    // Verify user exists and is registered for this event
    const UserModel = userType === 'exhibitor' ? Exhibitor : Visitor;
    const user = await UserModel.findById(userId);
    
    if (!user || !user.isActive || user.isDeleted) {
      return errorResponse(res, 'User not found or inactive', 404);
    }

    // Check if user is registered for this event
    const participantArray = userType === 'exhibitor' ? event.exhibitor : event.visitor;
    const isRegistered = participantArray.some(p => p.userId.toString() === userId);
    
    if (!isRegistered) {
      return errorResponse(res, 'User is not registered for this event', 403);
    }

    // Get today's date (without time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if attendance already exists for today
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

    // Create new attendance record
    const attendance = new Attendance({
      userId,
      userModel: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor',
      eventId,
      attendanceDate: today,
      scannedBy: scannerId,
      scannedByModel: 'User', // organizer/superadmin
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

// Get attendance statistics for today
const getAttendanceStats = asyncHandler(async (req, res) => {
  const organizerId = req.user._id;
  
  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // Get organizer's events
    const organizerEvents = await Event.find({ 
      organizerId, 
      isActive: true, 
      isDeleted: false 
    }).select('_id title');

    const eventIds = organizerEvents.map(event => event._id);

    // Get today's attendance records for organizer's events
    const todayAttendance = await Attendance.find({
      eventId: { $in: eventIds },
      attendanceDate: {
        $gte: today,
        $lt: tomorrow
      }
    }).populate('userId', 'name companyName')
      .populate('eventId', 'title location')
      .sort({ scanTime: -1 });

    // Calculate statistics
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

module.exports = { 
  createEvent, 
  getEvents, 
  getEventById, 
  updateEvent, 
  deleteEvent, 
  registerForEvent, 
  getEventStats,
  getUpcomingEvents,
  getAllParticipants,
  addParticipantToEvent,
  getEventParticipants,
  updateEventStatus,
  getEventStatusStats,
  // New comprehensive participant management
  getAvailableParticipants,
  addParticipantToEventComprehensive,
  addMultipleParticipantsToEvent,
  removeParticipantFromEvent,
  // QR scanning for attendance
  scanQRForAttendance,
  getAttendanceStats
};
const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Exhibitor = require('../models/Exhibitor');
const Event = require('../models/Event');
const Organizer = require('../models/Organizer');
const Visitor = require('../models/Visitor');
const axios = require('axios');
const UserEventSlot = require('../models/UserEventSlot');
const Meeting = require('../models/z-index').models.Meeting;
const mongoose = require('mongoose');
const generateSlots = require('../utils/slotGenerator');
const createExhibitor = asyncHandler(async (req, res) => {
  const { eventId, ...exhibitorData } = req.body;
  let exhibitor;
  let isNewExhibitor = false;

  // Check if exhibitor already exists by phone or email
  if (exhibitorData.phone) {
    exhibitor = await Exhibitor.findOne({
      phone: exhibitorData.phone,
      isDeleted: false
    });
  }

  if (!exhibitor && exhibitorData.email) {
    exhibitor = await Exhibitor.findOne({
      email: exhibitorData.email,
      isDeleted: false
    });
  }

  if (exhibitor) {
    Object.keys(exhibitorData).forEach(key => {
      if (exhibitorData[key] && exhibitorData[key] !== '' && key !== 'keyWords') {
        exhibitor[key] = exhibitorData[key];
      }
    });
    if (exhibitorData.keyWords) {
      exhibitor.keyWords = exhibitorData.keyWords;
    }
  } else {
    if (exhibitorData.email) {
      const deletedExhibitor = await Exhibitor.findOne({
        email: exhibitorData.email,
        isDeleted: true
      });
      if (deletedExhibitor) {
        return errorResponse(res, 'Contact administrator', 409);
      }
    }
    exhibitor = new Exhibitor({
      ...exhibitorData,
      isActive: true
    });

    try {
      const payload = {
        name: String(exhibitor.companyName || '').trim(),
        email: exhibitor.email || '',
        mobile: exhibitor.phone,
        businessKeyword: 'Event Exhibitor',
        originId: '67ca6934c15747af04fff36c',
        countryCode: '91'
      };
      const DIGITAL_CARD_URL = 'https://digitalcard.co.in/web/create-account/mobile';
      const result = await axios.post(DIGITAL_CARD_URL, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (result.data?.data?.path) {
        exhibitor.digitalProfile = result.data.data.path;
      } else {
        console.log(`Something went wrong while creating digital card: ${JSON.stringify(result.data)}`);
      }
    } catch (err) {
      console.log(`Error in creating digital card: ${err}`);
    }

    isNewExhibitor = true;
  }

  await exhibitor.save();

  let qrCode = null;
  let event = null;
  if (eventId && eventId !== 'none') {
    event = await Event.findById(eventId);
    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    if (!event.isActive) {
      return errorResponse(res, 'Cannot add exhibitor to inactive event', 400);
    }
    if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
      return errorResponse(res, 'Access denied', 403);
    }

    const currentDate = new Date();
    const eventEndDate = new Date(event.toDate);
    if (currentDate > eventEndDate) {
      return errorResponse(res, 'Registration for this event has closed. The event has ended.', 400);
    }

    const existingExhibitor = event.exhibitor.find(ex => ex.userId.toString() === exhibitor._id.toString());
    if (existingExhibitor) {
      return successResponse(res, {
        message: 'Exhibitor is already registered for this event',
        exhibitor: {
          _id: exhibitor._id,
          companyName: exhibitor.companyName,
          email: exhibitor.email,
          phone: exhibitor.phone
        },
        isNewExhibitor,
        alreadyRegistered: true,
        qrCode: existingExhibitor.qrCode,
        event: {
          _id: event._id,
          title: event.title,
          fromDate: event.fromDate,
          toDate: event.toDate
        }
      });
    }

    const qrData = {
      eventId: event._id,
      userId: exhibitor._id,
      userType: 'exhibitor',
      startDate: event.fromDate,
      endDate: event.toDate,
      eventTitle: event.title
    };
    qrCode = await require('../utils/qrGenerator')(qrData);

    event.exhibitor.push({
      userId: exhibitor._id,
      qrCode,
      registeredAt: new Date()
    });

    try {
      const existingSlots = await UserEventSlot.findOne({
        userId: exhibitor._id,
        userType: 'exhibitor',
        eventId
      });

      if (!existingSlots) {
        const rawSlots = generateSlots(
          event.fromDate,
          event.toDate,
          event.meetingStartTime || event.startTime,
          event.meetingEndTime || event.endTime,
          event.timeInterval || 30
        );
        const slots = rawSlots.map(s => ({
          start: s.start,
          end: s.end,
          status: 'available',
          showSlots: false
        }));
        const userSlot = new UserEventSlot({
          userId: exhibitor._id,
          userType: 'exhibitor',
          eventId,
          slots
        });
        await userSlot.save();
      }
    } catch (slotError) {
      console.error('Error generating slots:', slotError);
    }

    await event.save();
  }

  successResponse(res, {
    message: isNewExhibitor ? 'Exhibitor created successfully' : 'Exhibitor updated successfully',
    exhibitor: {
      _id: exhibitor._id,
      companyName: exhibitor.companyName,
      email: exhibitor.email,
      phone: exhibitor.phone
    },
    isNewExhibitor,
    qrCode,
    event: event ? {
      _id: event._id,
      title: event.title,
      fromDate: event.fromDate,
      toDate: event.toDate
    } : null
  }, isNewExhibitor ? 201 : 200);
});

const getExhibitors = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 10, organizerId } = req.body;
  const userRole = req.user.type;
  const currentUserId = req.user.id;
  
  let exhibitors;
  let total;
  
  // If organizer is requesting, filter by their events only
  if (userRole === 'organizer' || organizerId) {
    const targetOrganizerId = organizerId || currentUserId;
    
    // Get all events organized by this organizer
    const organizerEvents = await Event.find({ 
      organizerId: targetOrganizerId, 
      isDeleted: false 
    }).select('_id');
    
    const eventIds = organizerEvents.map(event => new mongoose.Types.ObjectId(event._id));
    
    // Find exhibitors who have attended these events
    const attendedExhibitors = await Event.aggregate([
      { $match: { _id: { $in: eventIds } } },
      { $unwind: '$exhibitor' },
      { $group: { _id: '$exhibitor.userId' } }
    ]);
    
    const exhibitorIds = attendedExhibitors.map(item => item._id);
    
    if (exhibitorIds.length === 0) {
      return successResponse(res, {
        exhibitors: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(limit)
        }
      });
    }
    
    let query = { 
      _id: { $in: exhibitorIds },
      isDeleted: false 
    };
    
    // Filter by status
    if (status && status !== 'all') {
      query.isActive = status === 'active';
    } else {
      query.isActive = true;
    }
    
    // Add search functionality
    if (search && search.trim()) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { Sector: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { website: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    total = await Exhibitor.countDocuments(query);
    
    exhibitors = await Exhibitor.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
  } else {
    // SuperAdmin can see all exhibitors
    let query = { isDeleted: false };
    
    // Filter by status
    if (status && status !== 'all') {
      query.isActive = status === 'active';
    } else {
      query.isActive = true;
    }
    
    // Add search functionality
    if (search && search.trim()) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { Sector: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { website: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    total = await Exhibitor.countDocuments(query);
    
    exhibitors = await Exhibitor.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
  }
  
  const response = {
    exhibitors,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  };
  
  successResponse(res, response);
});

const getExhibitorById = asyncHandler(async (req, res) => {
  const { id } = req.body; // Changed from params to body
  const exhibitor = await Exhibitor.findById(id);
  if (!exhibitor) return errorResponse(res, 'Exhibitor not found', 404);
  successResponse(res, exhibitor);
});
const updateExhibitor = asyncHandler(async (req, res) => {
  const { id, ...updateData } = req.body; // Changed from params to body
  const exhibitor = await Exhibitor.findByIdAndUpdate(id, updateData, { new: true });
  if (!exhibitor) return errorResponse(res, 'Exhibitor not found', 404);
  successResponse(res, exhibitor);
});

const deleteExhibitor = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const exhibitor = await Exhibitor.findById(id);
  if (!exhibitor) return errorResponse(res, 'Exhibitor not found', 404);

  // Check if exhibitor is associated with any active event
  const eventWithExhibitor = await Event.findOne({
    'exhibitor.userId': id,
  });

  if (eventWithExhibitor) {
    return errorResponse(res, 'Cannot delete exhibitor associated with an active event', 400);
  }

  exhibitor.isDeleted = true;
  await exhibitor.save();
  successResponse(res, { message: 'Exhibitor deleted' });
});

const getOrganizersEventWise = asyncHandler(async (req, res) => {
  const events = await Event.aggregate([
    { $group: { _id: '$organizerId', events: { $push: '$$ROOT' } } },
    { $lookup: { from: 'organizers', localField: '_id', foreignField: '_id', as: 'organizer' } },
    { $unwind: '$organizer' }
  ]);
  successResponse(res, events);
});

const getEventsOrganizerWise = asyncHandler(async (req, res) => {
  const { organizerId } = req.body;
  const currentDate = new Date();
  // Set to start of the current day in UTC
  const startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  // Determine the organizer ID to query
  let queryOrganizerId = organizerId;
  if (req.user.type === 'organizer' && !req.user.isSuperAdmin) {
    queryOrganizerId = req.user.id;
  } else if (!organizerId && req.user.type === 'superAdmin') {
    queryOrganizerId = null;
  }

  // Build query
  const query = {
    toDate: { $gte: startOfDay },
    isDeleted: false,
    isActive: true,
    ...(queryOrganizerId ? { organizerId: queryOrganizerId } : {}),
  };

  // Fetch events
  const events = await Event.find(query)
    .select('_id title fromDate toDate location startTime endTime description registrationLink media exhibitor visitor sponsors organizerId schedules isActive isDeleted createdAt updatedAt')
    .populate('organizerId', '_id name email organizationName')
    .sort({ fromDate: 1 });

  successResponse(res, { events });
});

const getParticipantsEventWise = asyncHandler(async (req, res) => {
  const { eventId, type } = req.body; // Changed from query to body
  const event = await Event.findById(eventId).populate(type === 'visitor' ? 'visitor' : 'exhibitor');
  successResponse(res, event ? event[type] : []);
});

const getUserDetails = asyncHandler(async (req, res) => {
  const { userId, userType } = req.body; // Changed from params to body
  const Model = userType === 'visitor' ? Visitor : Exhibitor;
  const user = await Model.findById(userId);
  if (!user) return errorResponse(res, 'User not found', 404);
  successResponse(res, user);
});

// Get exhibitor statistics
const getExhibitorStats = asyncHandler(async (req, res) => {
  const totalExhibitors = await Exhibitor.countDocuments({ isDeleted: false });
  const activeExhibitors = await Exhibitor.countDocuments({ isDeleted: false, isActive: true });
  const checkedInExhibitors = await Exhibitor.countDocuments({ isDeleted: false, isCheckedIn: true });

  const stats = {
    totalExhibitors,
    activeExhibitors,
    checkedInExhibitors,
    inactiveExhibitors: totalExhibitors - activeExhibitors
  };

  successResponse(res, stats);
});

// Get available booths for an event
const getAvailableBooths = asyncHandler(async (req, res) => {
  const { eventId } = req.body;

  // Mock booth data - in real implementation, this would come from a Booth model
  const booths = [
    { id: 'A1', name: 'Booth A1', size: 'Large', price: 5000, available: true },
    { id: 'A2', name: 'Booth A2', size: 'Medium', price: 3000, available: true },
    { id: 'A3', name: 'Booth A3', size: 'Small', price: 2000, available: false },
    { id: 'B1', name: 'Booth B1', size: 'Large', price: 5000, available: true },
    { id: 'B2', name: 'Booth B2', size: 'Medium', price: 3000, available: true }
  ];

  const availableBooths = booths.filter(booth => booth.available);
  successResponse(res, availableBooths);
});

// Check in exhibitor
const checkInExhibitor = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const exhibitor = await Exhibitor.findByIdAndUpdate(
    id,
    {
      isCheckedIn: true,
      checkInTime: new Date()
    },
    { new: true }
  );

  if (!exhibitor) return errorResponse(res, 'Exhibitor not found', 404);
  successResponse(res, exhibitor);
});

// Check out exhibitor
const checkOutExhibitor = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const exhibitor = await Exhibitor.findByIdAndUpdate(
    id,
    {
      isCheckedIn: false,
      checkOutTime: new Date()
    },
    { new: true }
  );

  if (!exhibitor) return errorResponse(res, 'Exhibitor not found', 404);
  successResponse(res, exhibitor);
});

// ===== MOBILE APP APIs FOR EXHIBITORS =====

// Get exhibitor profile (for mobile app)
const getMyProfile = asyncHandler(async (req, res) => {
  const exhibitor = await Exhibitor.findById(req.user._id).select('-password');
  if (!exhibitor) {
    return successResponse(res, { message: 'Exhibitor not found', data: 0 });
  }
  successResponse(res, {
    message: 'Profile retrieved successfully',
    data: exhibitor
  });
});

// Update exhibitor profile (for mobile app)
const updateMyProfile = asyncHandler(async (req, res) => {
  const { companyName, email, phone, bio, Sector, location, website } = req.body;

  const exhibitor = await Exhibitor.findById(req.user._id);
  if (!exhibitor) {
    return successResponse(res, { message: 'Exhibitor not found', data: 0 });
  }

  // Check if email or phone already exists (excluding current user)
  if (email && email !== exhibitor.email) {
    const existingEmail = await Exhibitor.findOne({ email, _id: { $ne: req.user.id } });
    if (existingEmail) {
      return successResponse(res, { message: 'Email already exists', data: 0 });
    }
  }

  if (phone && phone !== exhibitor.phone) {
    const existingPhone = await Exhibitor.findOne({ phone, _id: { $ne: req.user.id } });
    if (existingPhone) {
      return successResponse(res, { message: 'Phone number already exists', data: 0 });
    }
  }

  // Update fields
  if (companyName) exhibitor.companyName = companyName;
  if (email) exhibitor.email = email;
  if (phone) exhibitor.phone = phone;
  if (bio) exhibitor.bio = bio;
  if (Sector) exhibitor.Sector = Sector;
  if (location) exhibitor.location = location;
  if (website) exhibitor.website = website;

  await exhibitor.save();

  const updatedExhibitor = await Exhibitor.findById(req.user._id).select('-password');
  successResponse(res, {
    message: 'Profile updated successfully',
    data: updatedExhibitor
  });
});

// Get exhibitor's registered events (for mobile app)
const getMyEvents = asyncHandler(async (req, res) => {
  const currentDate = new Date();
  const { includeEnded = false } = req.body;

  let query = {
    isDeleted: false,
    'exhibitor.userId': req.user.id
  };

  // Only include active events unless specifically requested
  if (!includeEnded) {
    query.isActive = true;
    query.toDate = { $gte: currentDate };
  }

  const events = await Event.find(query)
    .populate('organizerId', 'name email organizationName')
    .sort({ fromDate: 1 });

  // Add status and QR code for each event
  const eventsWithDetails = events.map(event => {
    const eventObj = event.toObject();
    const exhibitorData = event.exhibitor.find(ex => ex.userId.toString() === req.user.id);

    // Add status
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

    // Add QR code and registration details
    eventObj.myQRCode = exhibitorData?.qrCode;
    eventObj.registeredAt = exhibitorData?.registeredAt;

    return eventObj;
  });

  successResponse(res, eventsWithDetails);
});

// Get exhibitor's event statistics (for mobile app)
const getMyEventStats = asyncHandler(async (req, res) => {
  const currentDate = new Date();

  const events = await Event.find({
    isDeleted: false,
    'exhibitor.userId': req.user.id
  });

  const stats = {
    totalEvents: events.length,
    upcomingEvents: 0,
    ongoingEvents: 0,
    endedEvents: 0,
    activeEvents: 0,
    totalMeetings: 0
  };

  events.forEach(event => {
    const eventStartDate = new Date(event.fromDate);
    const eventEndDate = new Date(event.toDate);

    if (event.isActive) {
      stats.activeEvents++;
    }

    if (eventEndDate < currentDate) {
      stats.endedEvents++;
    } else if (eventStartDate <= currentDate && eventEndDate >= currentDate) {
      stats.ongoingEvents++;
    } else {
      stats.upcomingEvents++;
    }
  });

  // Get total meetings
  const eventIds = events.map(event => event._id);
  const totalMeetings = await Meeting.countDocuments({
    eventId: { $in: eventIds },
    $or: [
      { requesterId: req.user.id },
      { requestedId: req.user.id }
    ],
    status: 'accepted'
  });

  stats.totalMeetings = totalMeetings;
  successResponse(res, stats);
});

// Get exhibitor's slots for a specific event (for mobile app)
const getMyEventSlots = asyncHandler(async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) return errorResponse(res, 'Event ID is required', 400);

  // Verify exhibitor is registered for this event
  const event = await Event.findOne({
    _id: eventId,
    isDeleted: false,
    isActive: true,
    'exhibitor.userId': req.user.id
  });

  if (!event) return errorResponse(res, 'Event not found or not registered', 404);

  // Get slots
  const userSlots = await UserEventSlot.findOne({
    eventId,
    userId: req.user.id,
    userType: 'exhibitor'
  });

  if (!userSlots) {
    return successResponse(res, {
      event: {
        _id: event._id,
        title: event.title,
        fromDate: event.fromDate,
        toDate: event.toDate,
        location: event.location
      },
      slotsByDate: {},
      statusCounts: { available: 0, requested: 0, booked: 0 },
      showSlots: false,
      totalSlots: 0
    });
  }

  const slots = userSlots.slots.sort((a, b) => new Date(a.start) - new Date(b.start));

  // Group slots by date and status
  const slotsByDate = {};
  const statusCounts = { available: 0, requested: 0, booked: 0 };

  slots.forEach(slot => {
    const date = slot.start.toISOString().split('T')[0];
    if (!slotsByDate[date]) {
      slotsByDate[date] = { available: [], requested: [], booked: [] };
    }

    const slotObj = {
      _id: slot._id,
      start: slot.start,
      end: slot.end,
      status: slot.status,
      color: slot.status === 'available' ? 'green' : slot.status === 'requested' ? 'yellow' : 'red',
      isAvailable: slot.status === 'available',
      isPending: slot.status === 'requested',
      isBooked: slot.status === 'booked'
    };

    slotsByDate[date][slot.status].push(slotObj);
    statusCounts[slot.status]++;
  });

  // Get show slots setting
  const showSlots = userSlots.showSlots;

  successResponse(res, {
    event: {
      _id: event._id,
      title: event.title,
      fromDate: event.fromDate,
      toDate: event.toDate,
      location: event.location
    },
    slotsByDate,
    statusCounts,
    showSlots,
    totalSlots: slots.length
  });
});

// Toggle slot visibility (for mobile app)
const toggleMySlotVisibility = asyncHandler(async (req, res) => {
  const { eventId, showSlots } = req.body;

  if (!eventId || typeof showSlots !== 'boolean') {
    return errorResponse(res, 'Event ID and showSlots boolean are required', 400);
  }

  // Update all slots for this user and event
  await UserEventSlot.updateMany(
    {
      eventId,
      userId: req.user.id,
      userType: 'exhibitor'
    },
    { showSlots }
  );

  successResponse(res, {
    message: `Slots ${showSlots ? 'enabled' : 'disabled'} successfully`,
    showSlots
  });
});

// Get exhibitor's meetings for a specific event (for mobile app)
const getMyEventMeetings = asyncHandler(async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) return errorResponse(res, 'Event ID is required', 400);

  const meetings = await Meeting.find({
    eventId,
    $or: [
      { requesterId: req.user.id },
      { requestedId: req.user.id }
    ],
    status: 'accepted'
  })
    .populate('requesterId', 'name companyName email phone bio Sector')
    .populate('requestedId', 'name companyName email phone bio Sector')
    .populate('eventId', 'title location')
    .sort({ slotStart: 1 });

  // Group meetings by date
  const meetingsByDate = {};

  meetings.forEach(meeting => {
    const date = meeting.slotStart.toISOString().split('T')[0];
    if (!meetingsByDate[date]) {
      meetingsByDate[date] = [];
    }

    const otherParticipant = meeting.requesterId._id.toString() === req.user.id
      ? meeting.requestedId
      : meeting.requesterId;

    const otherParticipantType = meeting.requesterType === 'exhibitor' && meeting.requesterId._id.toString() === req.user.id
      ? meeting.requestedType
      : meeting.requesterType === 'exhibitor' && meeting.requestedId._id.toString() === req.user.id
        ? meeting.requesterType
        : meeting.requestedType;

    meetingsByDate[date].push({
      _id: meeting._id,
      slotStart: meeting.slotStart,
      slotEnd: meeting.slotEnd,
      eventTitle: meeting.eventId.title,
      eventLocation: meeting.eventId.location,
      otherParticipant: {
        _id: otherParticipant._id,
        name: otherParticipant.name,
        companyName: otherParticipant.companyName,
        email: otherParticipant.email,
        phone: otherParticipant.phone,
        bio: otherParticipant.bio,
        Sector: otherParticipant.Sector
      },
      otherParticipantType,
      isRequester: meeting.requesterId._id.toString() === req.user.id
    });
  });

  successResponse(res, {
    meetingsByDate,
    totalMeetings: meetings.length
  });
});

// Get pending meeting requests for exhibitor (for mobile app)
const getMyPendingRequests = asyncHandler(async (req, res) => {
  const { eventId } = req.body;

  let query = {
    requestedId: req.user.id,
    requestedType: 'exhibitor',
    status: 'pending'
  };

  if (eventId) {
    query.eventId = eventId;
  }

  const requests = await Meeting.find(query)
    .populate('requesterId', 'name companyName email phone bio Sector')
    .populate('eventId', 'title location')
    .sort({ createdAt: -1 });

  const formattedRequests = requests.map(request => ({
    _id: request._id,
    slotStart: request.slotStart,
    slotEnd: request.slotEnd,
    eventTitle: request.eventId.title,
    eventLocation: request.eventId.location,
    requester: {
      _id: request.requesterId._id,
      name: request.requesterId.name,
      companyName: request.requesterId.companyName,
      email: request.requesterId.email,
      phone: request.requesterId.phone,
      bio: request.requesterId.bio,
      Sector: request.requesterId.Sector
    },
    requesterType: request.requesterType,
    createdAt: request.createdAt
  }));

  successResponse(res, {
    requests: formattedRequests,
    totalRequests: formattedRequests.length
  });
});

// Respond to meeting request (for mobile app)
const respondToMeetingRequest = asyncHandler(async (req, res) => {
  const { meetingId, status } = req.body; // status: 'accepted' or 'rejected'

  if (!meetingId || !['accepted', 'rejected'].includes(status)) {
    return errorResponse(res, 'Meeting ID and valid status (accepted/rejected) are required', 400);
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) return errorResponse(res, 'Meeting request not found', 404);

  // Verify this is a request for the current user
  if (meeting.requestedId.toString() !== req.user.id || meeting.status !== 'pending') {
    return errorResponse(res, 'Invalid meeting request', 400);
  }

  // Update meeting status
  meeting.status = status;
  await meeting.save();

  // Update slot status
  const userSlot = await UserEventSlot.findOne({
    eventId: meeting.eventId,
    userId: req.user.id,
    userType: 'exhibitor'
  });

  if (userSlot) {
    const slotIndex = userSlot.slots.findIndex(s =>
      s.start.getTime() === meeting.slotStart.getTime() &&
      s.end.getTime() === meeting.slotEnd.getTime()
    );

    if (slotIndex !== -1) {
      if (status === 'accepted') {
        userSlot.slots[slotIndex].status = 'booked';
        userSlot.slots[slotIndex].meetingId = meeting._id;
      } else {
        userSlot.slots[slotIndex].status = 'available';
        userSlot.slots[slotIndex].meetingId = null;
      }
      await userSlot.save();
    }
  }

  successResponse(res, {
    message: `Meeting request ${status} successfully`,
    meetingId: meeting._id,
    status
  });
});

// Get exhibitors with their attendance details for organizer
const getExhibitorsWithAttendance = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 10, eventId } = req.body;
  const userRole = req.user.role;
  const currentUserId = req.user.id;
  
  if (userRole !== 'organizer' && userRole !== 'superAdmin') {
    return errorResponse(res, 'Access denied', 403);
  }
  
  let eventIds = [];
  
  if (eventId) {
    // Get specific event
    const event = await Event.findOne({ 
      _id: eventId, 
      organizerId: userRole === 'organizer' ? currentUserId : undefined,
      isDeleted: false 
    });
    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    eventIds = [eventId];
  } else {
    // Get all events for this organizer
    const organizerEvents = await Event.find({ 
      organizerId: userRole === 'organizer' ? currentUserId : undefined,
      isDeleted: false 
    }).select('_id');
    eventIds = organizerEvents.map(event => event._id);
  }
  
  if (eventIds.length === 0) {
    return successResponse(res, {
      exhibitors: [],
      pagination: {
        currentPage: parseInt(page),
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: parseInt(limit)
      }
    });
  }
  
  // Get exhibitors with their attendance details
  const exhibitorsWithAttendance = await Event.aggregate([
    { $match: { _id: { $in: eventIds } } },
    { $unwind: '$exhibitor' },
    {
      $lookup: {
        from: 'exhibitors',
        localField: 'exhibitor.userId',
        foreignField: '_id',
        as: 'exhibitorDetails'
      }
    },
    { $unwind: '$exhibitorDetails' },
    {
      $match: {
        'exhibitorDetails.isDeleted': false,
        ...(status && status !== 'all' ? { 'exhibitorDetails.isActive': status === 'active' } : { 'exhibitorDetails.isActive': true })
      }
    },
    {
      $group: {
        _id: '$exhibitor.userId',
        exhibitor: { $first: '$exhibitorDetails' },
        events: {
          $push: {
            eventId: '$_id',
            eventTitle: '$title',
            eventLocation: '$location',
            eventFromDate: '$fromDate',
            eventToDate: '$toDate',
            registeredAt: '$exhibitor.registeredAt',
            qrCode: '$exhibitor.qrCode'
          }
        },
        totalEvents: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'attendances',
        let: { exhibitorId: '$_id', eventIds: eventIds },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', '$$exhibitorId'] },
                  { $eq: ['$userModel', 'Exhibitor'] },
                  { $in: ['$eventId', '$$eventIds'] }
                ]
              }
            }
          }
        ],
        as: 'attendanceRecords'
      }
    },
    {
      $addFields: {
        totalAttendance: { $size: '$attendanceRecords' },
        lastAttendance: {
          $max: '$attendanceRecords.attendanceDate'
        }
      }
    }
  ]);
  
  // Apply search filter
  let filteredExhibitors = exhibitorsWithAttendance;
  if (search && search.trim()) {
    const searchRegex = new RegExp(search, 'i');
    filteredExhibitors = exhibitorsWithAttendance.filter(item => 
      searchRegex.test(item.exhibitor.companyName) ||
      searchRegex.test(item.exhibitor.email) ||
      searchRegex.test(item.exhibitor.phone) ||
      searchRegex.test(item.exhibitor.Sector) ||
      searchRegex.test(item.exhibitor.location) ||
      searchRegex.test(item.exhibitor.bio) ||
      searchRegex.test(item.exhibitor.website)
    );
  }
  
  // Apply pagination
  const total = filteredExhibitors.length;
  const skip = (page - 1) * limit;
  const paginatedExhibitors = filteredExhibitors.slice(skip, skip + parseInt(limit));
  
  const response = {
    exhibitors: paginatedExhibitors,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  };
  
  successResponse(res, response);
});

module.exports = {
  createExhibitor,
  getExhibitors,
  getExhibitorById,
  updateExhibitor,
  deleteExhibitor,
  getOrganizersEventWise,
  getEventsOrganizerWise,
  getParticipantsEventWise,
  getUserDetails,
  getExhibitorStats,
  getAvailableBooths,
  checkInExhibitor,
  checkOutExhibitor,
  getExhibitorsWithAttendance,
  // Mobile App APIs
  getMyProfile,
  updateMyProfile,
  getMyEvents,
  getMyEventStats,
  getMyEventSlots,
  toggleMySlotVisibility,
  getMyEventMeetings,
  getMyPendingRequests,
  respondToMeetingRequest
};
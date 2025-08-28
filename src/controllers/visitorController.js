const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Visitor = require('../models/Visitor');
const Event = require('../models/Event');
const Organizer = require('../models/Organizer');
const Exhibitor = require('../models/Exhibitor');
const UserEventSlot = require('../models/UserEventSlot');
const Meeting = require('../models/z-index').models.Meeting;
const generateSlots = require('../utils/slotGenerator');

const createVisitor = asyncHandler(async (req, res) => {
  const { eventId, ...visitorData } = req.body;
  let visitor;
  let isNewVisitor = false;

  if (visitorData.phone) {
    visitor = await Visitor.findOne({
      phone: visitorData.phone,
      isDeleted: false
    });
  }

  if (!visitor && visitorData.email) {
    visitor = await Visitor.findOne({
      email: visitorData.email,
      isDeleted: false
    });
  }

  if (visitor) {
    Object.keys(visitorData).forEach(key => {
      if (visitorData[key] && visitorData[key] !== '' && key !== 'keyWords') {
        visitor[key] = visitorData[key];
      }
    });
    if (visitorData.keyWords) {
      visitor.keyWords = visitorData.keyWords;
    }
  } else {
    if (visitorData.email) {
      const deletedVisitor = await Visitor.findOne({
        email: visitorData.email,
        isDeleted: true
      });
      if (deletedVisitor) {
        return errorResponse(res, 'Contact administrator', 409);
      }
    }
    visitor = new Visitor({
      ...visitorData,
      isActive: true
    });

    try {
      const payload = {
        name: String(visitor.name || '').trim(),
        email: visitor.email || '',
        mobile: visitor.phone,
        businessKeyword: 'Event Visitor',
        originId: '67ca6934c15747af04fff36c',
        countryCode: '91'
      };
      const DIGITAL_CARD_URL = 'https://digitalcard.co.in/web/create-account/mobile';
      const result = await axios.post(DIGITAL_CARD_URL, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (result.data?.data?.path) {
        visitor.digitalProfile = result.data.data.path;
      } else {
        console.log(`Something went wrong while creating digital card: ${JSON.stringify(result.data)}`);
      }
    } catch (err) {
      console.log(`Error in creating digital card: ${err}`);
    }

    isNewVisitor = true;
  }

  await visitor.save();

  let qrCode = null;
  let event = null;
  if (eventId && eventId !== 'none') {
    event = await Event.findById(eventId);
    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    if (!event.isActive) {
      return errorResponse(res, 'Cannot add visitor to inactive event', 400);
    }
    if (req.user.type === 'organizer' && event.organizerId.toString() !== req.user.id) {
      return errorResponse(res, 'Access denied', 403);
    }

    const currentDate = new Date();
    const eventEndDate = new Date(event.toDate);
    if (currentDate > eventEndDate) {
      return errorResponse(res, 'Registration for this event has closed. The event has ended.', 400);
    }

    const existingVisitor = event.visitor.find(ex => ex.userId.toString() === visitor._id.toString());
    if (existingVisitor) {
      return successResponse(res, {
        message: 'Visitor is already registered for this event',
        visitor: {
          _id: visitor._id,
          name: visitor.name,
          email: visitor.email,
          phone: visitor.phone
        },
        isNewVisitor,
        alreadyRegistered: true,
        qrCode: existingVisitor.qrCode,
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
      userId: visitor._id,
      userType: 'visitor',
      startDate: event.fromDate,
      endDate: event.toDate,
      eventTitle: event.title
    };
    qrCode = await require('../utils/qrGenerator')(qrData);

    event.visitor.push({
      userId: visitor._id,
      qrCode,
      registeredAt: new Date()
    });

    try {
      const existingSlots = await UserEventSlot.findOne({
        userId: visitor._id,
        userType: 'visitor',
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
          userId: visitor._id,
          userType: 'visitor',
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
    message: isNewVisitor ? 'Visitor created successfully' : 'Visitor updated successfully',
    visitor: {
      _id: visitor._id,
      name: visitor.name,
      email: visitor.email,
      phone: visitor.phone
    },
    isNewVisitor,
    qrCode,
    event: event ? {
      _id: event._id,
      title: event.title,
      fromDate: event.fromDate,
      toDate: event.toDate
    } : null
  }, isNewVisitor ? 201 : 200);
});

const getVisitors = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 10, organizerId } = req.body;
  const userRole = req.user.type;
  const currentUserId = req.user.id;

  let visitors;
  let total;

  // If organizer is requesting, filter by their events only
  if (userRole === 'organizer' || organizerId) {
    const targetOrganizerId = organizerId || currentUserId;

    // Get all events organized by this organizer
    const organizerEvents = await Event.find({
      organizerId: targetOrganizerId,
      isDeleted: false
    }).select('_id visitor');

    const eventIds = organizerEvents.map(event => event._id);

    // Find visitors who have attended these events and are verified
    const attendedVisitors = await Event.aggregate([
      { $match: { _id: { $in: eventIds } } },
      { $unwind: '$visitor' },
      { $match: { 'visitor.isVerified': true } }, // Filter for verified visitors
      { $group: { _id: '$visitor.userId' } }
    ]);

    const visitorIds = attendedVisitors.map(item => item._id);

    if (visitorIds.length === 0) {
      return res.status(200).json({
        visitors: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(limit)
        }
      });
    }

    let query = {
      _id: { $in: visitorIds },
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
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { Sector: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    total = await Visitor.countDocuments(query);

    visitors = await Visitor.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

  } else {
    // SuperAdmin can see all verified visitors
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
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { Sector: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } }
      ];
    }

    // Find events with verified visitors
    const attendedVisitors = await Event.aggregate([
      { $unwind: '$visitor' },
      { $match: { 'visitor.isVerified': true } },
      { $group: { _id: '$visitor.userId' } }
    ]);

    const visitorIds = attendedVisitors.map(item => item._id);

    if (visitorIds.length > 0) {
      query._id = { $in: visitorIds };
    } else {
      return res.status(200).json({
        visitors: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(limit)
        }
      });
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    total = await Visitor.countDocuments(query);

    visitors = await Visitor.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
  }

  const response = {
    visitors,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  };

  res.status(200).json(response);
});

const getVisitorById = asyncHandler(async (req, res) => {
  const { id } = req.body; // Changed from params to body
  const visitor = await Visitor.findById(id);
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);
  successResponse(res, visitor);
});

const updateVisitor = asyncHandler(async (req, res) => {
  const { id, ...updateData } = req.body; // Changed from params to body
  const visitor = await Visitor.findByIdAndUpdate(id, updateData, { new: true });
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);
  successResponse(res, visitor);
});

const deleteVisitor = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const visitor = await Visitor.findById(id);
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);

  // Check if visitor is associated with any active event
  const eventWithVisitor = await Event.findOne({
    'visitor.userId': id,
  });

  if (eventWithVisitor) {
    return errorResponse(res, 'Cannot delete visitor associated with an active event', 400);
  }

  visitor.isDeleted = true;
  await visitor.save();
  successResponse(res, { message: 'Visitor deleted' });
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
  const { organizerId } = req.body; // Changed from query to body
  const events = await Event.find({ organizerId });
  successResponse(res, events);
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

// Get visitor statistics
const getVisitorStats = asyncHandler(async (req, res) => {
  const totalVisitors = await Visitor.countDocuments({ isDeleted: false });
  const activeVisitors = await Visitor.countDocuments({ isDeleted: false, isActive: true });
  const checkedInVisitors = await Visitor.countDocuments({ isDeleted: false, isCheckedIn: true });
  
  const stats = {
    totalVisitors,
    activeVisitors,
    checkedInVisitors,
    inactiveVisitors: totalVisitors - activeVisitors
  };
  
  successResponse(res, stats);
});

// Check in visitor
const checkInVisitor = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const visitor = await Visitor.findByIdAndUpdate(
    id, 
    { 
      isCheckedIn: true, 
      checkInTime: new Date() 
    }, 
    { new: true }
  );
  
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);
  successResponse(res, visitor);
});

// Check out visitor
const checkOutVisitor = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const visitor = await Visitor.findByIdAndUpdate(
    id, 
    { 
      isCheckedIn: false, 
      checkOutTime: new Date() 
    }, 
    { new: true }
  );
  
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);
  successResponse(res, visitor);
});

// Bulk check in visitors
const bulkCheckIn = asyncHandler(async (req, res) => {
  const { visitorIds } = req.body;
  const visitors = await Visitor.updateMany(
    { _id: { $in: visitorIds }, isDeleted: false },
    { 
      isCheckedIn: true, 
      checkInTime: new Date() 
    },
    { new: true }
  );
  
  const updatedVisitors = await Visitor.find({ _id: { $in: visitorIds }, isDeleted: false });
  successResponse(res, updatedVisitors);
});

// ===== MOBILE APP APIs FOR VISITORS =====

// Get visitor profile (for mobile app)
const getMyProfile = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findById(req.user._id).select('-password');
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);
  successResponse(res, visitor);
});

// Update visitor profile (for mobile app)
const updateMyProfile = asyncHandler(async (req, res) => {
  const { name, email, phone, bio, Sector, location, companyName } = req.body;
  
  const visitor = await Visitor.findById(req.user._id);
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);

  // Check if email or phone already exists (excluding current user)
  if (email && email !== visitor.email) {
    const existingEmail = await Visitor.findOne({ email, _id: { $ne: req.user.id } });
    if (existingEmail) return errorResponse(res, 'Email already exists', 400);
  }

  if (phone && phone !== visitor.phone) {
    const existingPhone = await Visitor.findOne({ phone, _id: { $ne: req.user.id } });
    if (existingPhone) return errorResponse(res, 'Phone number already exists', 400);
  }

  // Update fields
  if (name) visitor.name = name;
  if (email) visitor.email = email;
  if (phone) visitor.phone = phone;
  if (bio) visitor.bio = bio;
  if (Sector) visitor.Sector = Sector;
  if (location) visitor.location = location;
  if (companyName) visitor.companyName = companyName;

  await visitor.save();
  
  const updatedVisitor = await Visitor.findById(req.user._id).select('-password');
  successResponse(res, updatedVisitor);
});

// Get visitor's registered events (for mobile app)
const getMyEvents = asyncHandler(async (req, res) => {
  const currentDate = new Date();
  const { includeEnded = false } = req.body;

  let query = {
    isDeleted: false,
    'visitor.userId': req.user.id
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
    const visitorData = event.visitor.find(v => v.userId.toString() === req.user.id);
    
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
    eventObj.myQRCode = visitorData?.qrCode;
    eventObj.registeredAt = visitorData?.registeredAt;

    return eventObj;
  });

  successResponse(res, eventsWithDetails);
});

// Get visitor's event statistics (for mobile app)
const getMyEventStats = asyncHandler(async (req, res) => {
  const currentDate = new Date();
  
  const events = await Event.find({
    isDeleted: false,
    'visitor.userId': req.user.id
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

// Get visitor's slots for a specific event (for mobile app)
const getMyEventSlots = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  
  if (!eventId) return errorResponse(res, 'Event ID is required', 400);

  // Verify visitor is registered for this event
  const event = await Event.findOne({
    _id: eventId,
    isDeleted: false,
    isActive: true,
    'visitor.userId': req.user.id
  });

  if (!event) return errorResponse(res, 'Event not found or not registered', 404);

  // Get slots
  const userSlots = await UserEventSlot.findOne({
    eventId,
    userId: req.user.id,
    userType: 'visitor'
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
      userType: 'visitor'
    },
    { showSlots }
  );

  successResponse(res, {
    message: `Slots ${showSlots ? 'enabled' : 'disabled'} successfully`,
    showSlots
  });
});

// Get visitor's meetings for a specific event (for mobile app)
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

    const otherParticipantType = meeting.requesterType === 'visitor' && meeting.requesterId._id.toString() === req.user.id
      ? meeting.requestedType
      : meeting.requesterType === 'visitor' && meeting.requestedId._id.toString() === req.user.id
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

// Get pending meeting requests for visitor (for mobile app)
const getMyPendingRequests = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  
  let query = {
    requestedId: req.user.id,
    requestedType: 'visitor',
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
    userType: 'visitor'
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

// Get visitors with their attendance details for organizer
const getVisitorsWithAttendance = asyncHandler(async (req, res) => {
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
      visitors: [],
      pagination: {
        currentPage: parseInt(page),
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: parseInt(limit)
      }
    });
  }
  
  // Get visitors with their attendance details
  const visitorsWithAttendance = await Event.aggregate([
    { $match: { _id: { $in: eventIds } } },
    { $unwind: '$visitor' },
    {
      $lookup: {
        from: 'visitors',
        localField: 'visitor.userId',
        foreignField: '_id',
        as: 'visitorDetails'
      }
    },
    { $unwind: '$visitorDetails' },
    {
      $match: {
        'visitorDetails.isDeleted': false,
        ...(status && status !== 'all' ? { 'visitorDetails.isActive': status === 'active' } : { 'visitorDetails.isActive': true })
      }
    },
    {
      $group: {
        _id: '$visitor.userId',
        visitor: { $first: '$visitorDetails' },
        events: {
          $push: {
            eventId: '$_id',
            eventTitle: '$title',
            eventLocation: '$location',
            eventFromDate: '$fromDate',
            eventToDate: '$toDate',
            registeredAt: '$visitor.registeredAt',
            qrCode: '$visitor.qrCode'
          }
        },
        totalEvents: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'attendances',
        let: { visitorId: '$_id', eventIds: eventIds },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', '$$visitorId'] },
                  { $eq: ['$userModel', 'Visitor'] },
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
  let filteredVisitors = visitorsWithAttendance;
  if (search && search.trim()) {
    const searchRegex = new RegExp(search, 'i');
    filteredVisitors = visitorsWithAttendance.filter(item => 
      searchRegex.test(item.visitor.name) ||
      searchRegex.test(item.visitor.email) ||
      searchRegex.test(item.visitor.phone) ||
      searchRegex.test(item.visitor.companyName) ||
      searchRegex.test(item.visitor.Sector) ||
      searchRegex.test(item.visitor.location) ||
      searchRegex.test(item.visitor.bio)
    );
  }
  
  // Apply pagination
  const total = filteredVisitors.length;
  const skip = (page - 1) * limit;
  const paginatedVisitors = filteredVisitors.slice(skip, skip + parseInt(limit));
  
  const response = {
    visitors: paginatedVisitors,
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
  createVisitor, 
  getVisitors, 
  getVisitorById, 
  updateVisitor, 
  deleteVisitor, 
  getOrganizersEventWise, 
  getEventsOrganizerWise, 
  getParticipantsEventWise, 
  getUserDetails,
  getVisitorStats,
  checkInVisitor,
  checkOutVisitor,
  bulkCheckIn,
  getVisitorsWithAttendance,
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
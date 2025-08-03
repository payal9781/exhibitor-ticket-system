const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Visitor = require('../models/Visitor');
const Event = require('../models/Event');
const Organizer = require('../models/Organizer');
const Exhibitor = require('../models/Exhibitor');
const UserEventSlot = require('../models/UserEventSlot');
const Meeting = require('../models/Meeting');

const createVisitor = asyncHandler(async (req, res) => {
  const visitor = new Visitor(req.body);
  const isExists = await Visitor.findOne({ email: visitor.email });
  if(isExists && isExists?.isActive && !isExists?.isDeleted){
    return errorResponse(res,'Email already exists');
  }
  if(isExists &&  isExists?.isDeleted){
    return errorResponse(res,'contact to adminitrator');
  }
  await visitor.save();
  successResponse(res, visitor, 201);
});

const getVisitors = asyncHandler(async (req, res) => {
  const visitors = await Visitor.find({isActive:true ,isDeleted: false});
  successResponse(res, visitors);
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
  const { id } = req.body; // Changed from params to body
  const visitor = await Visitor.findById(id);
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);
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
    const existingEmail = await Visitor.findOne({ email, _id: { $ne: req.user._id } });
    if (existingEmail) return errorResponse(res, 'Email already exists', 400);
  }

  if (phone && phone !== visitor.phone) {
    const existingPhone = await Visitor.findOne({ phone, _id: { $ne: req.user._id } });
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
    'visitor.userId': req.user._id
  };

  // Only include active events unless specifically requested
  if (!includeEnded) {
    query.isActive = true;
    query.toDate = { $gte: currentDate };
  }

  const events = await Event.find(query)
    .populate('organizerId', 'name email companyName')
    .sort({ fromDate: 1 });

  // Add status and QR code for each event
  const eventsWithDetails = events.map(event => {
    const eventObj = event.toObject();
    const visitorData = event.visitor.find(v => v.userId.toString() === req.user._id);
    
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
    'visitor.userId': req.user._id
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
      { requesterId: req.user._id },
      { requestedId: req.user._id }
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
    'visitor.userId': req.user._id
  });

  if (!event) return errorResponse(res, 'Event not found or not registered', 404);

  // Get slots
  const userSlots = await UserEventSlot.findOne({
    eventId,
    userId: req.user._id,
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
      userId: req.user._id,
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
      { requesterId: req.user._id },
      { requestedId: req.user._id }
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

    const otherParticipant = meeting.requesterId._id.toString() === req.user._id 
      ? meeting.requestedId 
      : meeting.requesterId;

    const otherParticipantType = meeting.requesterType === 'visitor' && meeting.requesterId._id.toString() === req.user._id
      ? meeting.requestedType
      : meeting.requesterType === 'visitor' && meeting.requestedId._id.toString() === req.user._id
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
      isRequester: meeting.requesterId._id.toString() === req.user._id
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
    requestedId: req.user._id,
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
  if (meeting.requestedId.toString() !== req.user._id || meeting.status !== 'pending') {
    return errorResponse(res, 'Invalid meeting request', 400);
  }

  // Update meeting status
  meeting.status = status;
  await meeting.save();

  // Update slot status
  const userSlot = await UserEventSlot.findOne({
    eventId: meeting.eventId,
    userId: req.user._id,
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
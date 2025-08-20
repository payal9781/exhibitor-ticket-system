const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const Scan = require('../models/Scan');
const Meeting = require('../models/z-index').models.Meeting;
const UserEventSlot = require('../models/UserEventSlot');
const { default: mongoose } = require('mongoose');
const Attendance = require('../models/z-index').models.Attendance;

// Get total connections for exhibitor/visitor across all events
const getTotalConnections = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.type;

  // Get all scans where this user is the scanner
  const scans = await Scan.find({
    scanner: userId,
    userModel: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor'
  }).populate('eventId', 'title');

  // Count total unique scanned users across all events
  const uniqueScannedUsers = new Set();
  scans.forEach(scan => {
    scan.scannedUser.forEach(scannedUserId => {
      uniqueScannedUsers.add(scannedUserId.toString());
    });
  });

  const totalConnections = uniqueScannedUsers.size;

  // Get total events count where user is registered
  const totalEventsCount = await Event.countDocuments({
    isDeleted: false,
    $or: [
      { 'exhibitor.userId': userId },
      { 'visitor.userId': userId }
    ]
  });

  // Get total accepted meetings count
  const totalAcceptedMeetings = await Meeting.countDocuments({
    $or: [
      { requesterId: userId, status: 'accepted' },
      { recipientId: userId, status: 'accepted' }
    ]
  });

  // Get event-wise breakdown
  const eventWiseConnections = {};
  for (const scan of scans) {
    const eventId = scan.eventId._id.toString();
    const eventTitle = scan.eventId.title;

    if (!eventWiseConnections[eventId]) {
      eventWiseConnections[eventId] = {
        eventId,
        eventTitle,
        connections: 0,
        scannedUsers: new Set()
      };
    }

    scan.scannedUser.forEach(scannedUserId => {
      eventWiseConnections[eventId].scannedUsers.add(scannedUserId.toString());
    });

    eventWiseConnections[eventId].connections = eventWiseConnections[eventId].scannedUsers.size;
  }

  // Convert to array and remove Set objects
  const eventConnections = Object.values(eventWiseConnections).map(event => ({
    eventId: event.eventId,
    eventTitle: event.eventTitle,
    connections: event.connections
  }));

  successResponse(res, {
    message: 'Total connections retrieved successfully',
    data: {
      totalConnections,
      totalEventsCount,
      totalAcceptedMeetings,
      eventWiseConnections: eventConnections
    }
  });
});

// Get event-wise detailed connections with scanned user details
const getEventConnections = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;

  if (!eventId) {
    return successResponse(res, { message: 'Event ID is required', data: 0 });
  }

  // Get scans for this specific event
  const scans = await Scan.find({
    scanner: userId,
    userModel: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor',
    eventId
  }).populate('eventId', 'title fromDate toDate');

  if (scans.length === 0) {
    return successResponse(res, {
      message: 'No connections found for this event',
      data: {
        eventId,
        eventTitle: 'Event not found',
        totalConnections: 0,
        exhibitorConnections: [],
        visitorConnections: []
      }
    });
  }

  const event = scans[0].eventId;

  // Get all scanned user IDs
  const allScannedUserIds = [];
  scans.forEach(scan => {
    allScannedUserIds.push(...scan.scannedUser);
  });

  // Get exhibitor and visitor details separately
  const scannedExhibitors = await Exhibitor.find({
    _id: { $in: allScannedUserIds }
  }).select('companyName email phone profileImage bio Sector location');

  const scannedVisitors = await Visitor.find({
    _id: { $in: allScannedUserIds }
  }).select('name email phone profileImage bio Sector location companyName');

  const totalConnections = scannedExhibitors.length + scannedVisitors.length;

  // Get total events count where user is registered
  const totalEventsCount = await Event.countDocuments({
    isDeleted: false,
    $or: [
      { 'exhibitor.userId': userId },
      { 'visitor.userId': userId }
    ]
  });

  // Get total accepted meetings count for this specific event
  const totalAcceptedMeetings = await Meeting.countDocuments({
    eventId: eventId,
    $or: [
      { requesterId: userId, status: 'accepted' },
      { recipientId: userId, status: 'accepted' }
    ]
  });

  successResponse(res, {
    message: 'Event connections retrieved successfully',
    data: {
      eventId,
      eventTitle: event.title,
      eventDates: {
        fromDate: event.fromDate,
        toDate: event.toDate
      },
      totalConnections,
      totalEventsCount,
      totalAcceptedMeetings,
      exhibitorConnections: scannedExhibitors,
      visitorConnections: scannedVisitors
    }
  });
});

// Get all events where user is registered (for mobile app home screen)
const getMyRegisteredEvents = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.type;
  const currentDate = new Date();

  // Find events where user is registered
  let query = {
    isDeleted: false,
    isActive: true
  };

  if (userType === 'exhibitor') {
    query['exhibitor.userId'] = userId;
  } else {
    query['visitor.userId'] = userId;
  }

  const events = await Event.find(query)
    .populate('organizerId', 'name email organizationName')
    .sort({ fromDate: 1 });

  // Add status and connection count for each event
  const eventsWithDetails = await Promise.all(events.map(async (event) => {
    const eventObj = event.toObject();

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

    // Get connection count for this event
    const scans = await Scan.find({
      scanner: userId,
      userModel: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor',
      eventId: event._id
    });

    const uniqueScannedUsers = new Set();
    scans.forEach(scan => {
      scan.scannedUser.forEach(scannedUserId => {
        uniqueScannedUsers.add(scannedUserId.toString());
      });
    });

    eventObj.totalConnections = uniqueScannedUsers.size;

    // Add user's QR code for this event
    const userRegistration = userType === 'exhibitor'
      ? event.exhibitor.find(e => e.userId.toString() === userId.toString())
      : event.visitor.find(v => v.userId.toString() === userId.toString());

    eventObj.myQRCode = userRegistration?.qrCode;
    eventObj.registeredAt = userRegistration?.registeredAt;

    return eventObj;
  }));

  successResponse(res, {
    message: 'Registered events retrieved successfully',
    data: {
      totalEvents: eventsWithDetails.length,
      events: eventsWithDetails
    }
  });
});

// Get all events that user has attended (has scans in) - for mobile home screen
const getAttendedEvents = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.type;
  const currentDate = new Date();

  // Get all scans by this user
  const scans = await Scan.find({
    scanner: userId,
    userModel: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor'
  }).populate('eventId', 'title fromDate toDate location media');

  // Get unique events with enhanced details
  const uniqueEvents = {};
  scans.forEach(scan => {
    const eventId = scan.eventId._id.toString();
    if (!uniqueEvents[eventId]) {
      const event = scan.eventId;

      // Add status
      const eventEndDate = new Date(event.toDate);
      let status, statusColor;
      if (eventEndDate < currentDate) {
        status = 'ended';
        statusColor = 'red';
      } else if (new Date(event.fromDate) <= currentDate && eventEndDate >= currentDate) {
        status = 'ongoing';
        statusColor = 'orange';
      } else {
        status = 'upcoming';
        statusColor = 'green';
      }

      uniqueEvents[eventId] = {
        eventId,
        title: event.title,
        fromDate: event.fromDate,
        toDate: event.toDate,
        location: event.location,
        media: event.media,
        status,
        statusColor,
        totalConnections: 0,
        uniqueScannedUsers: new Set()
      };
    }

    // Count unique scanned users
    scan.scannedUser.forEach(scannedUserId => {
      uniqueEvents[eventId].uniqueScannedUsers.add(scannedUserId.toString());
    });
  });

  // Convert to array and finalize connection counts
  const attendedEvents = Object.values(uniqueEvents).map(event => ({
    eventId: event.eventId,
    title: event.title,
    fromDate: event.fromDate,
    toDate: event.toDate,
    location: event.location,
    media: event.media,
    status: event.status,
    statusColor: event.statusColor,
    totalConnections: event.uniqueScannedUsers.size
  }));

  successResponse(res, {
    totalEvents: attendedEvents.length,
    events: attendedEvents
  });
});

// Record a new scan (when user scans someone's QR code)
const recordScan = asyncHandler(async (req, res) => {
  const { scannedUserId, scannedUserType, eventId } = req.body;
  const scannerId = req.user.id;
  const scannerType = req.user.type;

  if (!scannedUserId || !scannedUserType || !eventId) {
    return successResponse(res, { message: 'Scanned user ID, user type, and event ID are required', data: 0 });
  }

  // Validate event exists
  const event = await Event.findById(eventId);
  if (!event) {
    return successResponse(res, { message: 'Event not found', data: 0 });
  }

  // Validate scanned user exists
  let scannedUser;
  if (scannedUserType === 'exhibitor') {
    scannedUser = await Exhibitor.findById(scannedUserId);
  } else if (scannedUserType === 'visitor') {
    scannedUser = await Visitor.findById(scannedUserId);
  }

  if (!scannedUser) {
    return successResponse(res, { message: 'Scanned user not found', data: 0 });
  }

  // Check if scan record already exists for this scanner and event
  let scanRecord = await Scan.findOne({
    scanner: scannerId,
    userModel: scannerType === 'exhibitor' ? 'Exhibitor' : 'Visitor',
    eventId
  });

  if (scanRecord) {
    // Add scanned user if not already in the array
    if (!scanRecord.scannedUser.includes(scannedUserId)) {
      scanRecord.scannedUser.push(scannedUserId);
      await scanRecord.save();
    }
  } else {
    // Create new scan record
    scanRecord = new Scan({
      scanner: scannerId,
      userModel: scannerType === 'exhibitor' ? 'Exhibitor' : 'Visitor',
      scannedUser: [scannedUserId],
      eventId
    });
    await scanRecord.save();
  }

  successResponse(res, {
    message: 'Scan recorded successfully',
    data: {
      scannedUser: {
        id: scannedUser._id,
        name: scannedUser.name || scannedUser.companyName,
        type: scannedUserType
      }
    }
  });
});

// Get scan statistics for mobile dashboard
const getScanStatistics = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.type;

  // Get all scans by this user
  const scans = await Scan.find({
    scanner: userId,
    userModel: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor'
  }).populate('eventId', 'title');

  // Calculate statistics
  const totalScans = scans.reduce((sum, scan) => sum + scan.scannedUser.length, 0);
  const totalEvents = new Set(scans.map(scan => scan.eventId._id.toString())).size;

  // Get scans from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayScans = scans.filter(scan => scan.createdAt >= today);
  const scansToday = todayScans.reduce((sum, scan) => sum + scan.scannedUser.length, 0);

  // Get scans from this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekScans = scans.filter(scan => scan.createdAt >= weekAgo);
  const scansThisWeek = weekScans.reduce((sum, scan) => sum + scan.scannedUser.length, 0);

  successResponse(res, {
    totalConnections: totalScans,
    totalEvents,
    scansToday,
    scansThisWeek,
    recentScans: scans.slice(-5).map(scan => ({
      eventTitle: scan.eventId.title,
      scanCount: scan.scannedUser.length,
      date: scan.createdAt
    }))
  });
});

// Get available slots of scanned users for meeting requests
const getScannedUserSlots = asyncHandler(async (req, res) => {
  const { eventId, scannedUserId, scannedUserType } = req.body;
  const currentUserId = req.user.id;

  if (!eventId || !scannedUserId || !scannedUserType) {
    return errorResponse(res, 'Event ID, scanned user ID, and user type are required', 400);
  }

  // Verify that the current user has scanned this user
  const scanRecord = await Scan.findOne({
    scanner: currentUserId,
    eventId,
    scannedUser: scannedUserId
  });

  if (!scanRecord) {
    return errorResponse(res, 'You have not scanned this user', 403);
  }

  // Get the scanned user's slots
  const userSlots = await UserEventSlot.findOne({
    userId: scannedUserId,
    userType: scannedUserType,
    eventId
  });

  if (!userSlots || !userSlots.showSlots) {
    return errorResponse(res, 'User slots not available or hidden', 403);
  }

  // Get attendance records for the scanned user for this event
  const attendanceRecords = await Attendance.find({
    userId: scannedUserId,
    eventId: eventId
  }).lean();

  const attendedDates = new Set();

attendanceRecords.forEach(record => {
  const date = record.attendanceDate;
  // Extract local date in YYYY-MM-DD format
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  attendedDates.add(dateKey);
});

// Filter slots to only show those on attended dates (all statuses)
const filteredSlots = userSlots.slots.filter(slot => {
  const slotDate = slot.start;
  // Extract local date in YYYY-MM-DD format
  const slotDateKey = `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, '0')}-${String(slotDate.getDate()).padStart(2, '0')}`;
  return attendedDates.has(slotDateKey);
});

  // Group slots by date with color indicators
  const slotsByDate = {};
  const statusColors = {
    'available': 'green',    // Available for booking
    'requested': 'yellow',   // Pending approval
    'booked': 'red'         // Confirmed meeting
  };

  // Count slots by status
  const statusCounts = { available: 0, requested: 0, booked: 0 };

  filteredSlots.forEach(slot => {
    const dateKey = slot.start.toISOString().split('T')[0];
    if (!slotsByDate[dateKey]) {
      slotsByDate[dateKey] = [];
    }
    slotsByDate[dateKey].push({
      _id: slot._id,
      start: slot.start,
      end: slot.end,
      status: slot.status,
      color: statusColors[slot.status] || 'gray',
      isAvailable: slot.status === 'available',
      isPending: slot.status === 'requested',
      isBooked: slot.status === 'booked'
    });

    // Count status
    if (statusCounts.hasOwnProperty(slot.status)) {
      statusCounts[slot.status]++;
    }
  });

  // Get scanned user details
  let scannedUserDetails;
  if (scannedUserType === 'exhibitor') {
    scannedUserDetails = await Exhibitor.findById(scannedUserId)
      .select('companyName email phone profileImage bio Sector location');
  } else {
    scannedUserDetails = await Visitor.findById(scannedUserId)
      .select('name email phone profileImage bio Sector location companyName');
  }

  successResponse(res, {
    scannedUser: scannedUserDetails,
    scannedUserType,
    eventId,
    totalSlots: filteredSlots.length,
    statusCounts,
    slotsByDate,
    attendedDates: Array.from(attendedDates),
    attendanceInfo: {
      totalAttendedDays: attendedDates.size,
      message: attendedDates.size === 0 ? 'User has not attended any event days yet' : `User has attended ${attendedDates.size} event day(s)`
    }
  });
});

// Send meeting request to a scanned user
const sendMeetingRequest = asyncHandler(async (req, res) => {
  const { eventId, requestedId, requestedType, slotStart, slotEnd } = req.body;
  const requesterId = req.user.id;
  const requesterType = req.user.type;

  if (!eventId || !requestedId || !requestedType || !slotStart || !slotEnd) {
    return errorResponse(res, 'All fields are required', 400);
  }

  // Verify that the requester has scanned the requested user
  const scanRecord = await Scan.findOne({
    scanner: requesterId,
    eventId,
    scannedUser: requestedId
  });

  if (!scanRecord) {
    return errorResponse(res, 'You have not scanned this user', 403);
  }

  // Check if the slot is still available
  const userSlot = await UserEventSlot.findOne({
    userId: requestedId,
    userType: requestedType,
    eventId
  });

  if (!userSlot) {
    return errorResponse(res, 'User slots not found', 404);
  }

  const slotIndex = userSlot.slots.findIndex(s =>
    s.start.getTime() === new Date(slotStart).getTime() &&
    s.status === 'available'
  );

  if (slotIndex === -1) {
    return errorResponse(res, 'Slot not available', 400);
  }

  // Create meeting request
  const meeting = new Meeting({
    eventId,
    requesterId,
    requesterType,
    requestedId,
    requestedType,
    slotStart: new Date(slotStart),
    slotEnd: new Date(slotEnd)
  });
  await meeting.save();

  // Update slot status to requested
  userSlot.slots[slotIndex].status = 'requested';
  userSlot.slots[slotIndex].meetingId = meeting._id;
  await userSlot.save();

  // Get requester details for response
  let requesterDetails;
  if (requesterType === 'exhibitor') {
    requesterDetails = await Exhibitor.findById(requesterId)
      .select('companyName email phone profileImage');
  } else {
    requesterDetails = await Visitor.findById(requesterId)
      .select('name email phone profileImage companyName');
  }

  successResponse(res, {
    message: 'Meeting request sent successfully',
    meeting: {
      _id: meeting._id,
      slotStart: meeting.slotStart,
      slotEnd: meeting.slotEnd,
      status: meeting.status,
      requester: requesterDetails
    }
  }, 201);
});

// Get pending meeting requests (for the current user)
const getPendingMeetingRequests = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;

  let query = {

    status: 'pending'
  };

  if (eventId) {
    query.eventId = eventId;
  }

  const pendingRequests = await Meeting.find(query)
    .populate('eventId', 'title fromDate toDate location')
    .sort({ createdAt: -1 });

  // Get requester details for each request
  const requestsWithDetails = await Promise.all(
    pendingRequests.map(async (request) => {
      let requesterDetails;
      if (request.requesterType === 'exhibitor') {
        requesterDetails = await Exhibitor.findById(request.requesterId)
          .select('companyName email phone profileImage bio Sector location');
      } else {
        requesterDetails = await Visitor.findById(request.requesterId)
          .select('name email phone profileImage bio Sector location companyName');
      }

      return {
        _id: request._id,
        eventId: request.eventId._id,
        eventTitle: request.eventId.title,
        eventLocation: request.eventId.location,
        slotStart: request.slotStart,
        slotEnd: request.slotEnd,
        status: request.status,
        createdAt: request.createdAt,
        requester: requesterDetails,
        requesterType: request.requesterType
      };
    })
  );

  successResponse(res, {
    totalPendingRequests: requestsWithDetails.length,
    requests: requestsWithDetails
  });
});

// Accept or reject meeting request
const respondToMeetingRequest = asyncHandler(async (req, res) => {
  const { meetingId, status } = req.body; // status: 'accepted' or 'rejected'
  const userId = req.user.id;

  if (!meetingId || !status || !['accepted', 'rejected'].includes(status)) {
    return errorResponse(res, 'Meeting ID and valid status (accepted/rejected) are required', 400);
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    return errorResponse(res, 'Meeting not found', 404);
  }

  if (meeting.requestedId.toString() !== userId.toString()) {
    return errorResponse(res, 'You are not authorized to respond to this meeting', 403);
  }

  if (meeting.status !== 'pending') {
    return errorResponse(res, 'Meeting request has already been responded to', 400);
  }

  // Update meeting status
  meeting.status = status;
  await meeting.save();

  // Update slot status
  const userSlot = await UserEventSlot.findOne({
    userId: meeting.requestedId,
    userType: meeting.requestedType,
    eventId: meeting.eventId
  });

  if (userSlot) {
    const slotIndex = userSlot.slots.findIndex(s =>
      s.meetingId && s.meetingId.toString() === meetingId
    );

    if (slotIndex !== -1) {
      if (status === 'accepted') {
        userSlot.slots[slotIndex].status = 'booked';
      } else {
        userSlot.slots[slotIndex].status = 'available';
        userSlot.slots[slotIndex].meetingId = null;
      }
      await userSlot.save();
    }
  }

  successResponse(res, {
    message: `Meeting request ${status} successfully`,
    meeting: {
      _id: meeting._id,
      status: meeting.status,
      slotStart: meeting.slotStart,
      slotEnd: meeting.slotEnd
    }
  });
});

// Get confirmed meetings (day-wise)
const getConfirmedMeetings = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;

  let query = {
    $or: [
      { requesterId: userId, requesterType: userType },
      { requestedId: userId, requestedType: userType }
    ],
    status: 'accepted'
  };

  if (eventId) {
    query.eventId = eventId;
  }

  const confirmedMeetings = await Meeting.find(query)
    .populate('eventId', 'title fromDate toDate location')
    .sort({ slotStart: 1 });

  // Get details for each meeting participant
  const meetingsWithDetails = await Promise.all(
    confirmedMeetings.map(async (meeting) => {
      let otherParticipant;
      let otherParticipantType;

      if (meeting.requesterId.toString() === userId.toString()) {
        // Current user is the requester, get requested user details
        otherParticipantType = meeting.requestedType;
        if (meeting.requestedType === 'exhibitor') {
          otherParticipant = await Exhibitor.findById(meeting.requestedId)
            .select('companyName email phone profileImage bio Sector location');
        } else {
          otherParticipant = await Visitor.findById(meeting.requestedId)
            .select('name email phone profileImage bio Sector location companyName');
        }
      } else {
        // Current user is the requested user, get requester details
        otherParticipantType = meeting.requesterType;
        if (meeting.requesterType === 'exhibitor') {
          otherParticipant = await Exhibitor.findById(meeting.requesterId)
            .select('companyName email phone profileImage bio Sector location');
        } else {
          otherParticipant = await Visitor.findById(meeting.requesterId)
            .select('name email phone profileImage bio Sector location companyName');
        }
      }

      return {
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
        isRequester: meeting.requesterId.toString() === userId.toString()
      };
    })
  );

  // Group meetings by date
  const meetingsByDate = {};
  meetingsWithDetails.forEach(meeting => {
    const dateKey = meeting.slotStart.toISOString().split('T')[0];
    if (!meetingsByDate[dateKey]) {
      meetingsByDate[dateKey] = [];
    }
    meetingsByDate[dateKey].push(meeting);
  });

  successResponse(res, {
    totalConfirmedMeetings: meetingsWithDetails.length,
    meetingsByDate
  });
});

// Get mobile dashboard data (for home screen)
const getMobileDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.type;

  // Get total connections
  const scans = await Scan.find({
    scanner: userId,
    userModel: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor'
  });

  const uniqueScannedUsers = new Set();
  scans.forEach(scan => {
    scan.scannedUser.forEach(scannedUserId => {
      uniqueScannedUsers.add(scannedUserId.toString());
    });
  });

  const totalConnections = uniqueScannedUsers.size;

  // Get total events attended
  const totalEvents = new Set(scans.map(scan => scan.eventId.toString())).size;

  // Get pending meeting requests count
  const pendingRequests = await Meeting.countDocuments({
    requestedId: userId,
    requestedType: userType,
    status: 'pending'
  });

  // Get confirmed meetings count
  const confirmedMeetings = await Meeting.countDocuments({
    $or: [
      { requesterId: userId, requesterType: userType },
      { requestedId: userId, requestedType: userType }
    ],
    status: 'accepted'
  });

  successResponse(res, {
    totalConnections,
    totalEvents,
    pendingRequests,
    confirmedMeetings,
    userType
  });
});

// Get user's own profile
const getMyProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.type;

  let user;
  if (userType === 'exhibitor') {
    user = await Exhibitor.findById(userId).select('-otp -otpExpires');
  } else {
    user = await Visitor.findById(userId).select('-otp -otpExpires');
  }

  if (!user) {
    return errorResponse(res, 'User not found', 404);
  }

  const userResponse = user.toObject();
  userResponse.userType = userType;

  successResponse(res, userResponse);
});

// Update user's own profile
const updateMyProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.type;
  const updateData = req.body;

  // Remove sensitive fields that shouldn't be updated
  delete updateData.otp;
  delete updateData.otpExpires;
  delete updateData.isActive;
  delete updateData.isDeleted;
  delete updateData._id;

  let user;
  if (userType === 'exhibitor') {
    user = await Exhibitor.findByIdAndUpdate(userId, updateData, { new: true }).select('-otp -otpExpires');
  } else {
    user = await Visitor.findByIdAndUpdate(userId, updateData, { new: true }).select('-otp -otpExpires');
  }

  if (!user) {
    return errorResponse(res, 'User not found', 404);
  }

  const userResponse = user.toObject();
  userResponse.userType = userType;

  successResponse(res, userResponse);
});

// Toggle slot visibility
const toggleSlotVisibility = asyncHandler(async (req, res) => {
  const { eventId, showSlots } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;

  if (!eventId || typeof showSlots !== 'boolean') {
    return errorResponse(res, 'Event ID and showSlots boolean are required', 400);
  }

  const userSlot = await UserEventSlot.findOne({
    userId,
    userType,
    eventId
  });

  if (!userSlot) {
    return errorResponse(res, 'User slots not found for this event', 404);
  }

  userSlot.showSlots = showSlots;
  await userSlot.save();

  successResponse(res, {
    message: `Slots ${showSlots ? 'enabled' : 'disabled'} successfully`,
    showSlots: userSlot.showSlots
  });
});

// Get user's own slot status for an event
const getMySlotStatus = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;

  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }

  const userSlot = await UserEventSlot.findOne({
    userId,
    userType,
    eventId
  });

  if (!userSlot) {
    return errorResponse(res, 'User slots not found for this event', 404);
  }

  // Group slots by date and status with color coding
  const slotsByDate = {};
  const statusCounts = {
    available: 0,
    requested: 0,
    booked: 0
  };

  const statusColors = {
    'available': 'green',    // Available for booking
    'requested': 'yellow',   // Pending approval  
    'booked': 'red'         // Confirmed meeting
  };

  userSlot.slots.forEach(slot => {
    const dateKey = slot.start.toISOString().split('T')[0];
    if (!slotsByDate[dateKey]) {
      slotsByDate[dateKey] = {
        available: [],
        requested: [],
        booked: []
      };
    }

    slotsByDate[dateKey][slot.status].push({
      _id: slot._id,
      start: slot.start,
      end: slot.end,
      status: slot.status,
      color: statusColors[slot.status] || 'gray',
      meetingId: slot.meetingId,
      isAvailable: slot.status === 'available',
      isPending: slot.status === 'requested',
      isBooked: slot.status === 'booked'
    });

    statusCounts[slot.status]++;
  });

  successResponse(res, {
    eventId,
    showSlots: userSlot.showSlots,
    totalSlots: userSlot.slots.length,
    statusCounts,
    slotsByDate
  });
});

const getSchedules = asyncHandler(async (req, res) => {
  const { eventId, mergeForDate } = req.body;

  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }

  const event = await Event.aggregate([
    {
      $match:{
        _id:new mongoose.Types.ObjectId(eventId)
      }
    },
  {
    $project:
      /**
       * specifications: The fields to
       *   include or exclude.
       */
      {
        schedules: 1
      }
  },
  {
    $unwind:
      /**
       * path: Path to the array field.
       * includeArrayIndex: Optional name for index.
       * preserveNullAndEmptyArrays: Optional
       *   toggle to unwind null and empty values.
       */
      {
        path: "$schedules"
      }
  },
  {
    $project:
      /**
       * specifications: The fields to
       *   include or exclude.
       */
      {
        activities: "$schedules.activities",
        _id: 0
      }
  },
  {
    $unwind:
      /**
       * path: Path to the array field.
       * includeArrayIndex: Optional name for index.
       * preserveNullAndEmptyArrays: Optional
       *   toggle to unwind null and empty values.
       */
      {
        path: "$activities"
      }
  }
]).exec();
  if (!event) return errorResponse(res, 'Event not found', 404);
    successResponse(res, {
      message: 'All schedules retrieved',
      schedules: event.schedules
    });

});


const getAllExhibitorsForEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }

  const event = await Event.aggregate([
  {
    $project:
      /**
       * specifications: The fields to
       *   include or exclude.
       */
      {
        exhibitor: 1
      }
  },
  {
    $unwind:
      /**
       * path: Path to the array field.
       * includeArrayIndex: Optional name for index.
       * preserveNullAndEmptyArrays: Optional
       *   toggle to unwind null and empty values.
       */
      {
        path: "$exhibitor"
      }
  },
  {
    $lookup:
      /**
       * from: The target collection.
       * localField: The local join field.
       * foreignField: The target join field.
       * as: The name for the results.
       * pipeline: Optional pipeline to run on the foreign collection.
       * let: Optional variables to use in the pipeline field stages.
       */
      {
        from: "exhibitors",
        localField: "exhibitor.userId",
        foreignField: "_id",
        as: "exhibitor.userId"
      }
  },
  {
    $unwind:
      /**
       * path: Path to the array field.
       * includeArrayIndex: Optional name for index.
       * preserveNullAndEmptyArrays: Optional
       *   toggle to unwind null and empty values.
       */
      {
        path: "$exhibitor.userId"
      }
  },
  {
    $project:
      /**
       * specifications: The fields to
       *   include or exclude.
       */
      {
        exhibitor: "$exhibitor.userId"
      }
  }
]).exec();

    successResponse(res, {
      message: 'All schedules retrieved',
      exhibitors:event || []
    });
  
});



module.exports = {
  getTotalConnections,
  getEventConnections,
  getMyRegisteredEvents,
  getAttendedEvents,
  recordScan,
  getScanStatistics,
  getScannedUserSlots,
  sendMeetingRequest,
  getPendingMeetingRequests,
  respondToMeetingRequest,
  getConfirmedMeetings,
  getMobileDashboard,
  getMyProfile,
  updateMyProfile,
  toggleSlotVisibility,
  getMySlotStatus,
  getSchedules,
  getAllExhibitorsForEvent
};
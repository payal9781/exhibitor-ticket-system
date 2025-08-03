const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const Scan = require('../models/Scan');

// Get total connections for exhibitor/visitor across all events
const getTotalConnections = asyncHandler(async (req, res) => {
  const userId = req.user._id;
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
    totalConnections,
    eventWiseConnections: eventConnections
  });
});

// Get event-wise detailed connections with scanned user details
const getEventConnections = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user._id;
  const userType = req.user.type;
  
  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }
  
  // Get scans for this specific event
  const scans = await Scan.find({ 
    scanner: userId, 
    userModel: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor',
    eventId 
  }).populate('eventId', 'title fromDate toDate');
  
  if (scans.length === 0) {
    return successResponse(res, {
      eventId,
      eventTitle: 'Event not found',
      totalConnections: 0,
      exhibitorConnections: [],
      visitorConnections: []
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
  
  successResponse(res, {
    eventId,
    eventTitle: event.title,
    eventDates: {
      fromDate: event.fromDate,
      toDate: event.toDate
    },
    totalConnections,
    exhibitorConnections: scannedExhibitors,
    visitorConnections: scannedVisitors
  });
});

// Get all events that user has attended (has scans in)
const getAttendedEvents = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userType = req.user.type;
  
  // Get all scans by this user
  const scans = await Scan.find({ 
    scanner: userId, 
    userModel: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor' 
  }).populate('eventId', 'title fromDate toDate location media');
  
  // Get unique events
  const uniqueEvents = {};
  scans.forEach(scan => {
    const eventId = scan.eventId._id.toString();
    if (!uniqueEvents[eventId]) {
      uniqueEvents[eventId] = {
        eventId,
        title: scan.eventId.title,
        fromDate: scan.eventId.fromDate,
        toDate: scan.eventId.toDate,
        location: scan.eventId.location,
        media: scan.eventId.media,
        totalScans: 0
      };
    }
    uniqueEvents[eventId].totalScans += scan.scannedUser.length;
  });
  
  const attendedEvents = Object.values(uniqueEvents);
  
  successResponse(res, {
    totalEvents: attendedEvents.length,
    events: attendedEvents
  });
});

// Record a new scan (when user scans someone's QR code)
const recordScan = asyncHandler(async (req, res) => {
  const { scannedUserId, scannedUserType, eventId } = req.body;
  const scannerId = req.user._id;
  const scannerType = req.user.type;
  
  if (!scannedUserId || !scannedUserType || !eventId) {
    return errorResponse(res, 'Scanned user ID, user type, and event ID are required', 400);
  }
  
  // Validate event exists
  const event = await Event.findById(eventId);
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }
  
  // Validate scanned user exists
  let scannedUser;
  if (scannedUserType === 'exhibitor') {
    scannedUser = await Exhibitor.findById(scannedUserId);
  } else if (scannedUserType === 'visitor') {
    scannedUser = await Visitor.findById(scannedUserId);
  }
  
  if (!scannedUser) {
    return errorResponse(res, 'Scanned user not found', 404);
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
    scannedUser: {
      id: scannedUser._id,
      name: scannedUser.name || scannedUser.companyName,
      type: scannedUserType
    }
  });
});

// Get scan statistics for mobile dashboard
const getScanStatistics = asyncHandler(async (req, res) => {
  const userId = req.user._id;
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

module.exports = {
  getTotalConnections,
  getEventConnections,
  getAttendedEvents,
  recordScan,
  getScanStatistics
};
const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const models = require('../models/z-index').models;
const Event = require('../models/Event');

const markAttendance = asyncHandler(async (req, res) => {
  const { eventId, userId, role, startDate, endDate } = req.body;
  const event = await Event.findById(eventId);
  if (!event || event.fromDate.getTime() !== new Date(startDate).getTime() || event.toDate.getTime() !== new Date(endDate).getTime()) {
    return errorResponse(res, 'Event not found or date mismatch', 404);
  }
  const userArray = role === 'visitor' ? event.visitor : event.exhibitor;
  if (!userArray.includes(userId)) return errorResponse(res, 'User not registered for event', 400);

  let attendance = await models.Attendance.findOne({ eventId, user: userId, userModel: role.charAt(0).toUpperCase() + role.slice(1) });
  if (!attendance) {
    attendance = new models.Attendance({
      eventId,
      organizerId: req.user._id,
      user: userId,
      userModel: role.charAt(0).toUpperCase() + role.slice(1),
      attendanceDetails: [{ date: new Date(), entryTime: new Date() }]
    });
  } else {
    attendance.attendanceDetails.push({ date: new Date(), entryTime: new Date() });
  }
  await attendance.save();
  successResponse(res, attendance);
});

// Get all attendance records with filtering
const getAttendanceRecords = asyncHandler(async (req, res) => {
  const { eventId, userType, status, search, page = 1, limit = 50 } = req.body;
  const organizerId = req.user._id;
  const userRole = req.user.type;

  try {
    let query = {};
    let eventQuery = {};

    // If not super admin, filter by organizer's events
    if (userRole !== 'superAdmin') {
      eventQuery.organizerId = organizerId;
    }

    // Get events based on organizer
    const events = await Event.find(eventQuery).select('_id title');
    const eventIds = events.map(e => e._id);

    // Filter by specific event if provided
    if (eventId && eventId !== 'all') {
      query.eventId = eventId;
    } else {
      query.eventId = { $in: eventIds };
    }

    // Filter by user type if provided
    if (userType && userType !== 'all') {
      query.userModel = userType.charAt(0).toUpperCase() + userType.slice(1);
    }

    // Get attendance records with populated user and event data
    const attendanceRecords = await models.Attendance.find(query)
      .populate({
        path: 'userId',
        select: 'name email phone companyName profileImage'
      })
      .populate({
        path: 'eventId',
        select: 'title fromDate toDate'
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Transform data for frontend
    const transformedRecords = attendanceRecords.map(record => {
      const user = record.userId;
      const event = record.eventId;
      
      // Determine check-in/check-out status based on attendance details
      const hasCheckIn = record.attendanceDetails && record.attendanceDetails.length > 0;
      const latestEntry = hasCheckIn ? record.attendanceDetails[record.attendanceDetails.length - 1] : null;
      
      let status = 'registered';
      let checkInTime = null;
      let checkOutTime = null;
      let duration = null;

      if (hasCheckIn) {
        status = latestEntry.exitTime ? 'checked-out' : 'checked-in';
        checkInTime = latestEntry.entryTime;
        checkOutTime = latestEntry.exitTime;
        
        if (checkInTime && checkOutTime) {
          const durationMs = new Date(checkOutTime) - new Date(checkInTime);
          const hours = Math.floor(durationMs / (1000 * 60 * 60));
          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          duration = `${hours}h ${minutes}m`;
        }
      }

      return {
        id: record._id,
        userName: user.name || user.companyName || 'Unknown',
        userEmail: user.email || 'No email',
        userType: record.userModel.toLowerCase(),
        eventName: event.title,
        checkInTime: checkInTime ? new Date(checkInTime).toLocaleString() : null,
        checkOutTime: checkOutTime ? new Date(checkOutTime).toLocaleString() : null,
        status,
        duration,
        registeredAt: record.createdAt
      };
    });

    // Apply search filter
    let filteredRecords = transformedRecords;
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase();
      filteredRecords = transformedRecords.filter(record =>
        record.userName.toLowerCase().includes(searchTerm) ||
        record.userEmail.toLowerCase().includes(searchTerm) ||
        record.eventName.toLowerCase().includes(searchTerm)
      );
    }

    // Apply status filter
    if (status && status !== 'all') {
      filteredRecords = filteredRecords.filter(record => record.status === status);
    }

    // Calculate statistics
    const allRecords = await models.Attendance.find({ eventId: { $in: eventIds } })
      .populate('userId')
      .populate('eventId');

    const stats = {
      totalRegistered: allRecords.length,
      checkedIn: allRecords.filter(r => r.attendanceDetails && r.attendanceDetails.length > 0 && !r.attendanceDetails[r.attendanceDetails.length - 1].exitTime).length,
      checkedOut: allRecords.filter(r => r.attendanceDetails && r.attendanceDetails.length > 0 && r.attendanceDetails[r.attendanceDetails.length - 1].exitTime).length,
      currentlyPresent: allRecords.filter(r => r.attendanceDetails && r.attendanceDetails.length > 0 && !r.attendanceDetails[r.attendanceDetails.length - 1].exitTime).length
    };

    successResponse(res, {
      records: filteredRecords,
      stats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredRecords.length / limit),
        totalRecords: filteredRecords.length
      }
    });

  } catch (error) {
    console.error('Error fetching attendance records:', error);
    errorResponse(res, 'Failed to fetch attendance records', 500);
  }
});

// Get attendance statistics
const getAttendanceStatistics = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const organizerId = req.user._id;
  const userRole = req.user.type;

  try {
    let eventQuery = {};
    
    // If not super admin, filter by organizer's events
    if (userRole !== 'superAdmin') {
      eventQuery.organizerId = organizerId;
    }

    // Get events based on organizer
    const events = await Event.find(eventQuery).select('_id title');
    const eventIds = events.map(e => e._id);

    let attendanceQuery = { eventId: { $in: eventIds } };
    
    // Filter by specific event if provided
    if (eventId && eventId !== 'all') {
      attendanceQuery.eventId = eventId;
    }

    // Get all attendance records
    const attendanceRecords = await models.Attendance.find(attendanceQuery)
      .populate('userId')
      .populate('eventId');

    // Calculate comprehensive statistics
    const totalRegistered = attendanceRecords.length;
    const exhibitorRecords = attendanceRecords.filter(r => r.userModel === 'Exhibitor');
    const visitorRecords = attendanceRecords.filter(r => r.userModel === 'Visitor');
    
    const checkedInRecords = attendanceRecords.filter(r => 
      r.attendanceDetails && r.attendanceDetails.length > 0 && 
      !r.attendanceDetails[r.attendanceDetails.length - 1].exitTime
    );
    
    const checkedOutRecords = attendanceRecords.filter(r => 
      r.attendanceDetails && r.attendanceDetails.length > 0 && 
      r.attendanceDetails[r.attendanceDetails.length - 1].exitTime
    );

    const stats = {
      totalRegistered,
      totalExhibitors: exhibitorRecords.length,
      totalVisitors: visitorRecords.length,
      checkedIn: checkedInRecords.length,
      checkedOut: checkedOutRecords.length,
      currentlyPresent: checkedInRecords.length,
      exhibitorsCheckedIn: checkedInRecords.filter(r => r.userModel === 'Exhibitor').length,
      visitorsCheckedIn: checkedInRecords.filter(r => r.userModel === 'Visitor').length,
      exhibitorsCheckedOut: checkedOutRecords.filter(r => r.userModel === 'Exhibitor').length,
      visitorsCheckedOut: checkedOutRecords.filter(r => r.userModel === 'Visitor').length
    };

    successResponse(res, stats);

  } catch (error) {
    console.error('Error fetching attendance statistics:', error);
    errorResponse(res, 'Failed to fetch attendance statistics', 500);
  }
});

// Manual check-in
const checkInUser = asyncHandler(async (req, res) => {
  const { userId, eventId, userType } = req.body;
  
  try {
    // Verify user is registered for the event
    const event = await Event.findById(eventId);
    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    const userArray = userType === 'visitor' ? event.visitor : event.exhibitor;
    if (!userArray.some(u => u.userId && u.userId.toString() === userId)) {
      return errorResponse(res, 'User not registered for this event', 400);
    }

    // Find or create attendance record
    let attendance = await models.Attendance.findOne({
      userId,
      eventId,
      userModel: userType.charAt(0).toUpperCase() + userType.slice(1)
    });

    if (!attendance) {
      attendance = new models.Attendance({
        userId,
        eventId,
        userModel: userType.charAt(0).toUpperCase() + userType.slice(1),
        attendanceDate: new Date(),
        scannedBy: req.user._id,
        scannedByModel: 'User',
        currentStatus: 'checked-in',
        attendanceDetails: [{
          date: new Date(),
          entryTime: new Date()
        }]
      });
    } else {
      // Check if already checked in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const latestEntry = attendance.attendanceDetails[attendance.attendanceDetails.length - 1];
      if (latestEntry && !latestEntry.exitTime) {
        return errorResponse(res, 'User is already checked in', 400);
      }

      attendance.attendanceDetails.push({
        date: new Date(),
        entryTime: new Date()
      });
      attendance.currentStatus = 'checked-in';
    }

    await attendance.save();
    successResponse(res, { message: 'User checked in successfully', attendance });

  } catch (error) {
    console.error('Error checking in user:', error);
    errorResponse(res, 'Failed to check in user', 500);
  }
});

// Manual check-out
const checkOutUser = asyncHandler(async (req, res) => {
  const { userId, eventId, userType } = req.body;
  
  try {
    // Find attendance record
    const attendance = await models.Attendance.findOne({
      userId,
      eventId,
      userModel: userType.charAt(0).toUpperCase() + userType.slice(1)
    });

    if (!attendance || !attendance.attendanceDetails || attendance.attendanceDetails.length === 0) {
      return errorResponse(res, 'User is not checked in', 400);
    }

    const latestEntry = attendance.attendanceDetails[attendance.attendanceDetails.length - 1];
    if (latestEntry.exitTime) {
      return errorResponse(res, 'User is already checked out', 400);
    }

    // Update the latest entry with exit time
    latestEntry.exitTime = new Date();
    attendance.currentStatus = 'checked-out';
    await attendance.save();

    successResponse(res, { message: 'User checked out successfully', attendance });

  } catch (error) {
    console.error('Error checking out user:', error);
    errorResponse(res, 'Failed to check out user', 500);
  }
});

module.exports = { 
  markAttendance, 
  getAttendanceRecords, 
  getAttendanceStatistics,
  checkInUser,
  checkOutUser
};
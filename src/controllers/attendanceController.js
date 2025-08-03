const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Attendance = require('../models/z-index').models.Attendance;
const Event = require('../models/Event');

const markAttendance = asyncHandler(async (req, res) => {
  const { eventId, userId, role, startDate, endDate } = req.body;
  const event = await Event.findById(eventId);
  if (!event || event.fromDate.getTime() !== new Date(startDate).getTime() || event.toDate.getTime() !== new Date(endDate).getTime()) {
    return errorResponse(res, 'Invalid event or dates', 400);
  }
  const userArray = role === 'visitor' ? event.visitor : event.exhibitor;
  if (!userArray.includes(userId)) return errorResponse(res, 'User not registered for event', 400);

  let attendance = await Attendance.findOne({ eventId, user: userId, userModel: role.charAt(0).toUpperCase() + role.slice(1) });
  if (!attendance) {
    attendance = new Attendance({
      eventId,
      organizerId: req.user._id,
      user: userId,
      userModel: role.charAt(0).toUpperCase() + role.slice(1),
      attendanceDetails: []
    });
  }
  attendance.attendanceDetails.push({ date: new Date(), entryTime: new Date() });
  await attendance.save();
  successResponse(res, attendance);
});

module.exports = { markAttendance };
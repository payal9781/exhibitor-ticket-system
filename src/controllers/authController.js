// src/controllers/authController.js
const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Organizer = require('../models/Organizer');
const Superadmin = require('../models/Superadmin');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const Event = require('../models/Event');
const UserEventSlot = require('../models/UserEventSlot');
const otpService = require('../services/otpService');
const generateSlots = require('../utils/slotGenerator');
const generateQR = require('../utils/qrGenerator');

const getModelByRole = (role) => {
  switch (role) {
    case 'organizer': return Organizer;
    case 'superAdmin': return Superadmin;
    case 'exhibitor': return Exhibitor;
    case 'visitor': return Visitor;
    default: return null;
  }
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const register = asyncHandler(async (req, res) => {
  const { role, ...userData } = req.body;
  const Model = getModelByRole(role);
  if (!Model) return errorResponse(res, 'Invalid role');
  if (['exhibitor', 'visitor'].includes(role)) {
    return errorResponse(res, 'Use event registration flow for exhibitor/visitor', 400);
  }
  
  // Check if user already exists
  const existingUser = await Model.findOne({ email: userData.email });
  if (existingUser) {
    return errorResponse(res, 'User with this email already exists', 409);
  }
  
  try {
    const user = new Model(userData);
    await user.save();
    const token = user.generateAccessToken();
    
    // Remove password from response and add role
    const userResponse = user.toObject();
    delete userResponse.password;
    userResponse.role = role; // Add role to response
    
    successResponse(res, { user: userResponse, token }, 201);
  } catch (error) {
    if (error.code === 11000) {
      // Handle duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return errorResponse(res, `${field} already exists`, 409);
    }
    throw error;
  }
});

const sendOtp = asyncHandler(async (req, res) => {
  const { role, phone } = req.body;
  if (!['exhibitor', 'visitor'].includes(role)) return errorResponse(res, 'Invalid role for OTP login');
  const Model = getModelByRole(role);
  let user = await Model.findOne({ phone });
  let exists = !!user;
  if (!user) {
    user = new Model({ phone });
    await user.save();
  }
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  user.otp = otp;
  user.otpExpires = expiresAt;
  await user.save();
  const sent = await otpService(phone, otp);
  if (!sent) return errorResponse(res, 'Failed to send OTP', 500);
  successResponse(res, { message: 'OTP sent', userId: user._id, exists });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { role, userId, otp, eventId, details } = req.body;
  if (!['exhibitor', 'visitor'].includes(role)) return errorResponse(res, 'Invalid role for OTP login');
  const Model = getModelByRole(role);
  const user = await Model.findById(userId);
  if (!user) return errorResponse(res, 'User not found', 404);
  if (!user.otp || user.otp !== otp || user.otpExpires < new Date()) {
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    return errorResponse(res, 'Invalid or expired OTP', 400);
  }
  user.otp = undefined;
  user.otpExpires = undefined;
  if (!user.isActive) {
    if (!details) return errorResponse(res, 'Provide details for new user', 400);
    Object.assign(user, details);
    user.isActive = true;
    await user.save();
  }
  const token = user.generateAccessToken();
  // Add role to user response
  const userResponse = user.toObject();
  delete userResponse.password;
  userResponse.role = role;
  
  if (!eventId) {
    return successResponse(res, { user: userResponse, token });
  }
  // Add to event and generate QR
  const event = await Event.findById(eventId);
  if (!event) return errorResponse(res, 'Event not found', 404);
  const userType = role;
  if (userType === 'exhibitor') {
    if (!event.exhibitor.includes(user._id)) event.exhibitor.push(user._id);
  } else if (userType === 'visitor') {
    if (!event.visitor.includes(user._id)) event.visitor.push(user._id);
  } else return errorResponse(res, 'Invalid user type');
  await event.save();

  const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
  const slots = rawSlots.map(s => ({ ...s, status: 'available' }));
  const userSlot = new UserEventSlot({ userId: user._id, userType, eventId, slots });
  await userSlot.save();

  const qrData = { eventId, userId: user._id, role: userType, startDate: event.fromDate, endDate: event.toDate };
  const qrCode = await generateQR(qrData);
  successResponse(res, { user: userResponse, token, qrCode });
});

const login = asyncHandler(async (req, res) => {
  const { role, email, password } = req.body;
  if (['exhibitor', 'visitor'].includes(role)) return errorResponse(res, 'Use OTP login for exhibitor/visitor', 400);
  const Model = getModelByRole(role);
  if (!Model) return errorResponse(res, 'Invalid role');
  const user = await Model.findOne({ email });
  if (!user || !(await user.isPasswordCorrect(password))) {
    return errorResponse(res, 'Invalid credentials', 401);
  }
  const token = user.generateAccessToken();
  // Add role to user response
  const userResponse = user.toObject();
  delete userResponse.password;
  userResponse.role = role;
  successResponse(res, { user: userResponse, token });
});

const logout = asyncHandler(async (req, res) => {
  successResponse(res, { message: 'Logged out successfully' });
});

module.exports = { register, sendOtp, verifyOtp, login, logout };
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
  if (!['exhibitor', 'visitor'].includes(role)) {
    return successResponse(res, { message: 'Invalid role for OTP login', data: 0 });
  }
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
  if (!sent) {
    return successResponse(res, { message: 'Failed to send OTP', data: 0 });
  }
  successResponse(res, { 
    message: 'OTP sent successfully',
    data: { 
      userId: user._id, 
      exists 
    }
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { role, phone, otp} = req.body;
  if (!['exhibitor', 'visitor'].includes(role)) {
    return successResponse(res, { message: 'Invalid role for OTP login', data: 0 });
  }
  const Model = getModelByRole(role);
  const user = await Model.findOne({phone});
  if (!user) {
    return successResponse(res, { message: 'User not found', data: 0 });
  }
  if (!user.otp || user.otp !== otp || user.otpExpires < new Date()) {
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    return successResponse(res, { message: 'Invalid or expired OTP', data: 0 });
  }
  user.otp = undefined;
  user.otpExpires = undefined;
  if (!user.isActive) {
    return successResponse(res, { message: 'user is inactive', data: 0 });
  }
  const token = user.generateAccessToken();
  // Add role to user response
  const userResponse = user.toObject();
  delete userResponse.password;
  userResponse.role = role;
  
  successResponse(res, { 
    message: 'OTP verified successfully',
    data: { 
      user: userResponse, 
      token 
    }
  });
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


const loginApp = asyncHandler(async (req, res) => {
  const { role, phone, machineId } = req.body;
  
  // Validate role
  if (!['exhibitor', 'visitor'].includes(role)) {
    return successResponse(res, { message: 'Invalid role for OTP login' ,data:0});
  }
  
  // Validate required fields
  if (!phone || !machineId) {
    return successResponse(res, { message: 'Phone number and machine ID are required' , data:0});
  }
  
  const Model = getModelByRole(role);
  const user = await Model.findOne({ phone });
  
  if (!user) {
    return successResponse(res, { message: 'User not found' , data:0});
  }
  
  let isVerified = false;
  
  // Check machineId verification logic
  if (!user.machineId || user.machineId === '') {
    // If machineId is empty, update it with the provided machineId
    user.machineId = machineId;
    await user.save();
    isVerified = false; // First time login, not verified yet
  } else if (user.machineId === machineId) {
    // If machineId matches, user is verified
    isVerified = true;
  } else {
    // If machineId doesn't match, user is not verified
    isVerified = false;
  }
  
  const token = user.generateAccessToken();
  
  // Prepare user response
  const userResponse = user.toObject();
  delete userResponse.password;
  delete userResponse.otp;
  delete userResponse.otpExpires;
  userResponse.role = role;
  
  successResponse(res, { 
    message:'Login successful',
    data:{
      user: userResponse, 
    token, 
    isVerified
    } 
  });
});


const logout = asyncHandler(async (req, res) => {
  successResponse(res, { message: 'Logged out successfully' });
});

module.exports = { register, sendOtp, verifyOtp, login, loginApp, logout };
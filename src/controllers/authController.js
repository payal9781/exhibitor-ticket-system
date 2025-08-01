const asyncHandler = require('../utils/asyncHandler');
const { response } = require('../utils/apiResponse');
const { models } = require('../models/z-index');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const register = asyncHandler(async (req, res) => {
  const { email, password, role, ...otherDetails } = req.body;
  const Model = models[role.charAt(0).toUpperCase() + role.slice(1)];
  
  if (!Model) {
    return response.badRequest('Invalid role', res);
  }

  const existingUser = await Model.findOne({ email });
  if (existingUser) {
    return response.conflict('User already exists', res);
  }

  const user = await Model.create({
    email,
    password,
    ...otherDetails,
    isActive: role === 'superadmin' ? false : true
  });

  const token = user.generateAccessToken();
  return response.create(`${role} registered successfully`, { user, token }, res);
});

const login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  const Model = models[role.charAt(0).toUpperCase() + role.slice(1)];

  if (!Model) {
    return response.badRequest('Invalid role', res);
  }

  const user = await Model.findOne({ email });
  if (!user || !(await user.isPasswordCorrect(password))) {
    return response.unauthorized('Invalid credentials', res);
  }

  if (!user.isActive) {
    return response.forbidden('Account is not active', res);
  }

  const token = user.generateAccessToken();
  return response.success('Login successful', { user, token }, res);
});

const signout = asyncHandler(async (req, res) => {
  return response.success('Signed out successfully', {}, res);
});

module.exports = { register, login, signout };
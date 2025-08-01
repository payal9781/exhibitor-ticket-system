const Joi = require('joi');

const registerEvent = Joi.object({
  eventId: Joi.string().required(),
});

const scanQR = Joi.object({
  qrData: Joi.string().required(),
});

const markAttendance = Joi.object({
  qrData: Joi.string().required(),
});

const createUser = Joi.object({
  role: Joi.string().valid('organizer', 'exhibitor', 'visitor').required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).when('role', { is: Joi.string().valid('organizer', 'exhibitor', 'visitor'), then: Joi.required() }),
  name: Joi.string().when('role', { is: 'visitor', then: Joi.required() }),
  phone: Joi.string().optional(),
  companyName: Joi.string().when('role', { is: 'exhibitor', then: Joi.required() }),
  organizationName: Joi.string().when('role', { is: 'organizer', then: Joi.required() }),
  profileImage: Joi.string().optional(),
  coverImage: Joi.string().optional(),
  bio: Joi.string().optional(),
  Sector: Joi.string().optional(),
  keyWords: Joi.array().items(Joi.string()).optional(),
  website: Joi.string().optional(),
  location: Joi.string().optional(),
  socialMediaLinks: Joi.object().optional(),
});

const updateUser = Joi.object({
  email: Joi.string().email().optional(),
  name: Joi.string().optional(),
  phone: Joi.string().optional(),
  companyName: Joi.string().optional(),
  organizationName: Joi.string().optional(),
  profileImage: Joi.string().optional(),
  coverImage: Joi.string().optional(),
  bio: Joi.string().optional(),
  Sector: Joi.string().optional(),
  keyWords: Joi.array().items(Joi.string()).optional(),
  website: Joi.string().optional(),
  location: Joi.string().optional(),
  socialMediaLinks: Joi.object().optional(),
  isActive: Joi.boolean().optional(),
});

module.exports = { registerEvent, scanQR, markAttendance, createUser, updateUser };
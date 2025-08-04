const Joi = require('joi');

const register = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('superAdmin', 'organizer', 'exhibitor', 'visitor').required(),
  phone: Joi.string().optional(),
  organizationName: Joi.string().when('role', { is: 'organizer', then: Joi.required() }),
  companyName: Joi.string().when('role', { is: 'exhibitor', then: Joi.required() }),
  profileImage: Joi.string().optional(),
  coverImage: Joi.string().optional(),
  bio: Joi.string().optional(),
  Sector: Joi.string().optional(),
  keyWords: Joi.array().items(Joi.string()).optional(),
  website: Joi.string().optional(),
  location: Joi.string().optional(),
  socialMediaLinks: Joi.object().optional(),
});

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  role: Joi.string().valid('superAdmin', 'organizer', 'exhibitor', 'visitor').required(),
});

const loginApp = Joi.object({
  phone: Joi.string().required(),
  machineId: Joi.string().required(),
  role: Joi.string().valid('exhibitor', 'visitor').required(),
});

module.exports = { register, login, loginApp };
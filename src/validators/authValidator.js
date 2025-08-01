const Joi = require('joi');

const register = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('superadmin', 'organizer', 'exhibitor', 'visitor').required(),
  name: Joi.string().when('role', { is: Joi.string().valid('superadmin', 'visitor'), then: Joi.required() }),
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

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  role: Joi.string().valid('superadmin', 'organizer', 'exhibitor', 'visitor').required(),
});

module.exports = { register, login };
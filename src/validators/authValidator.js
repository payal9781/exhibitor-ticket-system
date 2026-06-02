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
}).unknown(true);

const forgotPassword = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('organizer', 'superAdmin').required(),
});

const verifyResetToken = Joi.object({
  token: Joi.string().required(),
});

const resetPassword = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
});

const updateProfile = Joi.object({
  name: Joi.string().trim().min(1).max(120).optional(),
  phone: Joi.string().trim().max(20).allow('', null).optional(),
  organizationName: Joi.string().trim().max(200).allow('', null).optional(),
  company: Joi.string().trim().max(200).allow('', null).optional(),
  designation: Joi.string().trim().max(120).allow('', null).optional(),
  digitalProfile: Joi.string().trim().max(500).allow('', null).optional(),
  address: Joi.alternatives().try(
    Joi.string().trim().max(500).allow('', null),
    Joi.object({
      street: Joi.string().trim().max(200).allow('', null).optional(),
      city: Joi.string().trim().max(120).allow('', null).optional(),
      state: Joi.string().trim().max(120).allow('', null).optional(),
      country: Joi.string().trim().max(120).allow('', null).optional(),
      zipCode: Joi.string().trim().max(20).allow('', null).optional(),
    })
  ).optional(),
  extraDetails: Joi.object({
    website: Joi.string().trim().max(300).allow('', null).optional(),
    description: Joi.string().trim().max(2000).allow('', null).optional(),
    socialMedia: Joi.object({
      linkedin: Joi.string().trim().max(300).allow('', null).optional(),
      twitter: Joi.string().trim().max(300).allow('', null).optional(),
      facebook: Joi.string().trim().max(300).allow('', null).optional(),
      instagram: Joi.string().trim().max(300).allow('', null).optional(),
    }).optional(),
    businessInfo: Joi.object({
      taxId: Joi.string().trim().max(120).allow('', null).optional(),
      businessType: Joi.string().valid('corporation', 'llc', 'partnership', 'sole_proprietorship', 'nonprofit').allow('', null).optional(),
      foundedYear: Joi.number().integer().min(1800).max(3000).allow(null).optional(),
      employeeCount: Joi.string().trim().max(80).allow('', null).optional(),
      industry: Joi.string().trim().max(120).allow('', null).optional(),
    }).optional(),
    notes: Joi.string().trim().max(2000).allow('', null).optional(),
    tags: Joi.array().items(Joi.string().trim().max(80)).optional(),
  }).optional(),
}).min(1);

const changePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

module.exports = {
  register,
  login,
  loginApp,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  updateProfile,
  changePassword,
};
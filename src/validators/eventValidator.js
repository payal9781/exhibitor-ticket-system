const Joi = require('joi');

const create = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().optional(),
  fromDate: Joi.date().required(),
  toDate: Joi.date().greater(Joi.ref('fromDate')).required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().greater(Joi.ref('startTime')).required(),
  location: Joi.string().required(),
  media: Joi.array().items(Joi.string()).optional(),
  registrationLink: Joi.string().optional(),
});

const update = Joi.object({
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  fromDate: Joi.date().optional(),
  toDate: Joi.date().optional(),
  startTime: Joi.date().optional(),
  endTime: Joi.date().optional(),
  location: Joi.string().optional(),
  media: Joi.array().items(Joi.string()).optional(),
  registrationLink: Joi.string().optional(),
});

module.exports = { create, update };
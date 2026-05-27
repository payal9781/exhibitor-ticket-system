// src/validators/roomReferralValidator.js
const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createRoom = Joi.object({
  name: Joi.string().optional(),
  details: Joi.string().allow('').optional(),
  date: Joi.date().optional(),
  startTime: Joi.string().optional(),
  endTime: Joi.string().optional(),
  location: Joi.string().optional(),
  mapURL: Joi.string().allow('').optional(),
  eventId: Joi.string().regex(objectIdPattern).required().messages({
    'string.pattern.base': 'Invalid eventId format',
    'any.required': 'Event reference is required'
  }),
  chapter_name: Joi.string().allow('').optional()
});

const updateRoom = Joi.object({
  name: Joi.string().optional(),
  details: Joi.string().allow('').optional(),
  date: Joi.date().optional(),
  startTime: Joi.string().optional(),
  endTime: Joi.string().optional(),
  location: Joi.string().optional(),
  mapURL: Joi.string().allow('').optional(),
  eventId: Joi.string().regex(objectIdPattern).optional(),
  chapter_name: Joi.string().allow('').optional(),
  isActive: Joi.boolean().optional()
});

const createRound = Joi.object({
  roomId: Joi.string().regex(objectIdPattern).required().messages({
    'any.required': 'Room ID is required'
  }),
  name: Joi.string().required().messages({
    'any.required': 'Round name is required'
  }),
  roundNumber: Joi.number().integer().min(1).required().messages({
    'any.required': 'Round number is required'
  })
});

const updateRound = Joi.object({
  name: Joi.string().optional(),
  roundNumber: Joi.number().integer().min(1).optional()
});

const addUsersToRound = Joi.object({
  roundId: Joi.string().regex(objectIdPattern).required().messages({
    'any.required': 'Round ID is required'
  }),
  participants: Joi.array().items(
    Joi.object({
      userId: Joi.string().regex(objectIdPattern).required().messages({
        'any.required': 'User ID is required'
      }),
      userModel: Joi.string().valid('Exhibitor', 'Visitor').required().messages({
        'any.required': 'userModel must be either Exhibitor or Visitor'
      })
    })
  ).min(1).required().messages({
    'any.required': 'Participants list is required'
  })
});

const addUsersToRoundByFilter = Joi.object({
  roundId: Joi.string().regex(objectIdPattern).required().messages({
    'any.required': 'Round ID is required'
  }),
  filters: Joi.object({
    sector: Joi.string().allow('').optional(),
    category: Joi.string().allow('').optional(),
    userType: Joi.string().valid('Exhibitor', 'Visitor', 'all').default('all')
  }).required().messages({
    'any.required': 'Filters object is required'
  })
});

const createRoundReferral = Joi.object({
  roomId: Joi.string().regex(objectIdPattern).required().messages({
    'any.required': 'Room ID is required'
  }),
  roundId: Joi.string().regex(objectIdPattern).required().messages({
    'any.required': 'Round ID is required'
  }),
  receiverId: Joi.string().regex(objectIdPattern).required().messages({
    'any.required': 'Receiver ID is required'
  }),
  receiverModel: Joi.string().valid('Exhibitor', 'Visitor').required().messages({
    'any.required': 'receiverModel must be either Exhibitor or Visitor'
  }),
  referredName: Joi.string().required().messages({
    'any.required': 'Referred name is required'
  }),
  referredEmail: Joi.string().email().required().messages({
    'any.required': 'Referred email is required',
    'string.email': 'Invalid referred email format'
  }),
  referredMobile: Joi.string().required().messages({
    'any.required': 'Referred mobile/phone is required'
  }),
  comment: Joi.string().allow('').optional()
});

module.exports = {
  createRoom,
  updateRoom,
  createRound,
  updateRound,
  addUsersToRound,
  addUsersToRoundByFilter,
  createRoundReferral
};

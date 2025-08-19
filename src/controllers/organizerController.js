const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Organizer = require('../models/Organizer');

const createOrganizer = asyncHandler(async (req, res) => {
  const { firstName, lastName, company, email, password, phone, ...rest } = req.body;
  
  if (!firstName || !lastName || !email || !password || !company) {
    return errorResponse(res, 'First name, last name, email, password, and company are required', 400);
  }

  if (password.length < 8) {
    return errorResponse(res, 'Password must be at least 8 characters long', 400);
  }

  const name = `${firstName} ${lastName}`;
  const organizationName = company;

  // Check for existing email or phone to prevent duplicates
  const existingOrganizer = await Organizer.findOne({
    $or: [
      { email, isDeleted: false },
      { phone: phone && phone.trim() ? phone : null, isDeleted: false }
    ]
  });

  if (existingOrganizer) {
    return errorResponse(res, 'An organizer with this email or phone already exists', 409);
  }

  const organizerData = {
    name,
    email,
    password,
    phone: phone || undefined,
    organizationName,
    address: rest.address || {},
    extraDetails: {
      website: rest.website,
      description: rest.description,
      socialMedia: rest.socialMedia || {},
      businessInfo: rest.businessInfo || {},
      notes: rest.notes,
      tags: rest.tags || []
    }
  };

  const organizer = new Organizer(organizerData);
  await organizer.save();

  const response = {
    ...organizer.toObject(),
    firstName,
    lastName
  };

  successResponse(res, response, 201);
});

const updateOrganizer = asyncHandler(async (req, res) => {
  const { id, firstName, lastName, company, password, phone, ...rest } = req.body;

  if (!id) {
    return errorResponse(res, 'Organizer ID is required', 400);
  }

  const organizer = await Organizer.findById(id);
  if (!organizer) {
    return errorResponse(res, 'Organizer not found', 404);
  }

  if (req.user.type === 'organizer' && organizer._id.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  if (firstName && lastName) {
    organizer.name = `${firstName} ${lastName}`;
  } else if (firstName) {
    organizer.name = `${firstName} ${organizer.name.split(' ')[1] || ''}`;
  } else if (lastName) {
    organizer.name = `${organizer.name.split(' ')[0] || ''} ${lastName}`;
  }

  organizer.organizationName = company || organizer.organizationName;
  
  if (password) {
    if (password.length < 8) {
      return errorResponse(res, 'Password must be at least 8 characters long', 400);
    }
    organizer.password = password;
  }

  // Check for duplicate email or phone (excluding current organizer)
  if (email || phone) {
    const existingOrganizer = await Organizer.findOne({
      $and: [
        { _id: { $ne: id } },
        { isDeleted: false },
        {
          $or: [
            { email: email || organizer.email },
            { phone: phone && phone.trim() ? phone : null }
          ]
        }
      ]
    });

    if (existingOrganizer) {
      return errorResponse(res, 'An organizer with this email or phone already exists', 409);
    }
  }

  Object.assign(organizer, {
    email: email || organizer.email,
    phone: phone || organizer.phone,
    address: rest.address || organizer.address,
    extraDetails: {
      ...organizer.extraDetails,
      website: rest.website ?? organizer.extraDetails.website,
      description: rest.description ?? organizer.extraDetails.description,
      socialMedia: rest.socialMedia || organizer.extraDetails.socialMedia,
      businessInfo: rest.businessInfo || organizer.extraDetails.businessInfo,
      notes: rest.notes ?? organizer.extraDetails.notes,
      tags: rest.tags || organizer.extraDetails.tags
    }
  });

  await organizer.save();

  const response = {
    ...organizer.toObject(),
    firstName: firstName || organizer.name.split(' ')[0] || '',
    lastName: lastName || organizer.name.split(' ')[1] || ''
  };

  successResponse(res, response);
});

const deleteOrganizer = asyncHandler(async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return errorResponse(res, 'Organizer ID is required', 400);
  }

  const organizer = await Organizer.findById(id);
  if (!organizer) {
    return errorResponse(res, 'Organizer not found', 404);
  }

  if (req.user.type === 'organizer' && organizer._id.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  organizer.isDeleted = true;
  await organizer.save();

  successResponse(res, { message: 'Organizer deleted successfully' });
});

const getOrganizers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.body;
  
  let query = { isDeleted: false };
  
  if (search && search.trim()) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { organizationName: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;
  const total = await Organizer.countDocuments(query);
  
  const organizers = await Organizer.find(query)
    .skip(skip)
    .limit(parseInt(limit))
    .select('-password -resetPasswordToken -resetPasswordExpires');

  const response = organizers.map(org => ({
    ...org.toObject(),
    firstName: org.name.split(' ')[0] || '',
    lastName: org.name.split(' ')[1] || ''
  }));

  successResponse(res, {
    organizers: response,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  });
});

const getOrganizerStats = asyncHandler(async (req, res) => {
  const totalOrganizers = await Organizer.countDocuments({ isDeleted: false });
  const activeOrganizers = await Organizer.countDocuments({ isDeleted: false, isActive: true });
  const inactiveOrganizers = await Organizer.countDocuments({ isDeleted: false, isActive: false });

  successResponse(res, {
    totalOrganizers,
    activeOrganizers,
    inactiveOrganizers
  });
});

const getOrganizerById = asyncHandler(async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return errorResponse(res, 'Organizer ID is required', 400);
  }
  const organizer = await Organizer.findById(id).select('-password -resetPasswordToken -resetPasswordExpires');
  if (!organizer) {
    return errorResponse(res, 'Organizer not found', 404);
  }
  const response = {
    ...organizer.toObject(),
    firstName: organizer.name.split(' ')[0] || '',
    lastName: organizer.name.split(' ')[1] || ''
  };
  successResponse(res, response);
});

module.exports = { 
  createOrganizer, 
  getOrganizers, 
  getOrganizerById, 
  updateOrganizer, 
  deleteOrganizer,
  getOrganizerStats
};
const asyncHandler = require('../utils/asyncHandler');
const { response } = require('../utils/apiResponse');
const { models } = require('../models/z-index');

const getAllUsers = asyncHandler(async (req, res) => {
  const { role } = req.query;
  const Model = models[role.charAt(0).toUpperCase() + role.slice(1)];

  if (!Model) {
    return response.badRequest('Invalid role', res);
  }

  const users = await Model.find({ isDeleted: false });
  return response.success('Users retrieved successfully', users, res);
});

module.exports = { getAllUsers };


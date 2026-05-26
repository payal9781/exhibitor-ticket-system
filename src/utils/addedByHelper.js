const Organizer = require('../models/Organizer');
const Superadmin = require('../models/Superadmin');

const buildAddedByFromRequest = async (req) => {
  const userType =
    req.user?.type === 'organizer'
      ? 'Organizer'
      : req.user?.type === 'superAdmin' || req.user?.type === 'superadmin'
        ? 'Superadmin'
        : req.user?.type || 'Unknown';

  let name = 'User';
  try {
    if (req.user?.type === 'organizer') {
      const organizer = await Organizer.findById(req.user.id).select('name organizationName');
      name = organizer?.name || organizer?.organizationName || 'Organizer';
    } else if (req.user?.type === 'superAdmin' || req.user?.type === 'superadmin') {
      const superadmin = await Superadmin.findById(req.user.id).select('name');
      name = superadmin?.name || 'Superadmin';
    }
  } catch (error) {
    console.error('Error resolving addedBy name:', error);
  }

  return {
    userId: req.user.id,
    userType,
    name,
    addedAt: new Date(),
  };
};

module.exports = { buildAddedByFromRequest };

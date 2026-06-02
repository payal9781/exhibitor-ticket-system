const mongoose = require('mongoose');
const IndustrySector = require('../models/IndustrySector');

/**
 * Coerce industry sector ids from JSON body or multipart form fields.
 */
const normalizeIndustrySectorIds = (raw) => {
  if (raw === undefined || raw === null || raw === '') return undefined;

  if (Array.isArray(raw)) {
    return raw.flat().map((id) => String(id).trim()).filter(Boolean);
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((id) => String(id).trim()).filter(Boolean);
        }
      } catch {
        return { invalid: true };
      }
    }

    if (trimmed.includes(',')) {
      return trimmed.split(',').map((id) => id.trim()).filter(Boolean);
    }

    return [trimmed];
  }

  return { invalid: true };
};

/**
 * Read industrySectors / industrySectorIds from request body (JSON or multipart).
 */
const parseIndustrySectorInput = (body) => {
  if (body.industrySectors !== undefined) {
    return normalizeIndustrySectorIds(body.industrySectors);
  }
  if (body.industrySectorIds !== undefined) {
    return normalizeIndustrySectorIds(body.industrySectorIds);
  }
  return undefined;
};

const validateIndustrySectorIds = async (ids) => {
  if (ids && ids.invalid) {
    return { valid: false, error: 'industrySectors must be an array of sector IDs' };
  }

  if (!Array.isArray(ids)) {
    return { valid: false, error: 'industrySectors must be an array of sector IDs' };
  }

  if (ids.length === 0) {
    return { valid: true, sectorIds: [], sectors: [] };
  }

  const uniqueIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];

  for (const id of uniqueIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { valid: false, error: `Invalid industry sector id: ${id}` };
    }
  }

  const sectors = await IndustrySector.find({
    _id: { $in: uniqueIds },
    isDeleted: false,
    isActive: true,
  })
    .select('_id name value description')
    .sort({ name: 1 })
    .lean();

  if (sectors.length !== uniqueIds.length) {
    return { valid: false, error: 'One or more industry sectors are invalid or inactive' };
  }

  return { valid: true, sectorIds: uniqueIds, sectors };
};

const applyIndustrySectorsToUser = async (user, sectorIds, sectors) => {
  user.industrySectors = sectorIds;
  user.Sector = sectors.length ? sectors.map((s) => s.name).join(', ') : '';
};

const profileIndustrySectorSelect = 'name value description isActive';

const formatIndustryLabelFromUser = (user) => {
  if (user?.industrySectors?.length) {
    const names = user.industrySectors
      .map((sector) =>
        sector && typeof sector === 'object' ? sector.name || sector.value : null
      )
      .filter(Boolean);
    if (names.length) return names.join(', ');
  }
  return user?.Sector || '';
};

const getIndustrySectorIdsFromUser = (user) => {
  if (!user?.industrySectors?.length) return [];
  return user.industrySectors.map((sector) => String(sector._id || sector));
};

const parseJsonBodyField = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const EXHIBITOR_PROFILE_FIELDS = [
  'companyName',
  'email',
  'phone',
  'bio',
  'Sector',
  'website',
  'coverImage',
  'digitalProfile',
];

const VISITOR_PROFILE_FIELDS = [
  'name',
  'email',
  'phone',
  'bio',
  'Sector',
  'companyName',
  'website',
  'coverImage',
  'digitalProfile',
];

const applyMobileProfileFields = (user, body, userType) => {
  const allowed =
    userType === 'exhibitor' ? EXHIBITOR_PROFILE_FIELDS : VISITOR_PROFILE_FIELDS;

  for (const field of allowed) {
    if (body[field] !== undefined) {
      user[field] = body[field];
    }
  }

  if (body.keyWords !== undefined) {
    const parsed = parseJsonBodyField(body.keyWords);
    if (Array.isArray(parsed)) {
      user.keyWords = parsed;
    } else if (typeof parsed === 'string') {
      user.keyWords = parsed.split(',').map((k) => k.trim()).filter(Boolean);
    } else {
      user.keyWords = [];
    }
  }

  if (body.address !== undefined) {
    user.address = parseJsonBodyField(body.address) || {};
  }

  if (body.socialMediaLinks !== undefined) {
    user.socialMediaLinks = parseJsonBodyField(body.socialMediaLinks) || {};
  }
};

module.exports = {
  parseIndustrySectorInput,
  normalizeIndustrySectorIds,
  validateIndustrySectorIds,
  applyIndustrySectorsToUser,
  applyMobileProfileFields,
  profileIndustrySectorSelect,
  formatIndustryLabelFromUser,
  getIndustrySectorIdsFromUser,
  EXHIBITOR_PROFILE_FIELDS,
  VISITOR_PROFILE_FIELDS,
};

const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const IndustrySector = require('../models/IndustrySector');
const { DEFAULT_INDUSTRY_SECTORS } = require('../utils/defaultIndustrySectors');

const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ensureDefaultSectors = async () => {
  const count = await IndustrySector.countDocuments({ isDeleted: false });
  if (count > 0) return;

  await IndustrySector.insertMany(
    DEFAULT_INDUSTRY_SECTORS.map((s) => ({
      ...s,
      description: '',
      isActive: true,
      isDeleted: false,
    }))
  );
};

const listSectors = asyncHandler(async (req, res) => {
  await ensureDefaultSectors();

  const { search, includeInactive = false, page = 1, limit = 50 } = req.body || {};
  const query = { isDeleted: false };

  if (!includeInactive) query.isActive = true;

  if (search && search.trim()) {
    query.$or = [
      { name: { $regex: search.trim(), $options: 'i' } },
      { value: { $regex: search.trim(), $options: 'i' } },
      { description: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const total = await IndustrySector.countDocuments(query);
  const sectors = await IndustrySector.find(query)
    .sort({ name: 1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  successResponse(res, {
    sectors,
    pagination: {
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(total / limit) || 1,
      totalItems: total,
      itemsPerPage: parseInt(limit, 10),
    },
  });
});

const getActiveSectors = asyncHandler(async (req, res) => {
  await ensureDefaultSectors();

  const sectors = await IndustrySector.find({ isDeleted: false, isActive: true })
    .sort({ name: 1 })
    .select('name value description')
    .lean();

  successResponse(res, { sectors });
});

/** Mobile app: list active industry sectors (exhibitor / visitor) */
const listIndustrySectorsForMobile = asyncHandler(async (req, res) => {
  await ensureDefaultSectors();

  const { search } = req.body || {};
  const query = { isDeleted: false, isActive: true };

  if (search && String(search).trim()) {
    const term = String(search).trim();
    query.$or = [
      { name: { $regex: term, $options: 'i' } },
      { value: { $regex: term, $options: 'i' } },
      { description: { $regex: term, $options: 'i' } },
    ];
  }

  const sectors = await IndustrySector.find(query)
    .sort({ name: 1 })
    .select('name value description')
    .lean();

  successResponse(res, {
    message: 'Industry sectors retrieved successfully',
    sectors,
    total: sectors.length,
  });
});

const createSector = asyncHandler(async (req, res) => {
  const { name, value, description, isActive } = req.body;

  if (!name || !String(name).trim()) {
    return errorResponse(res, 'Sector name is required', 400);
  }

  const sectorValue = (value && String(value).trim()) || slugify(name);
  if (!sectorValue) {
    return errorResponse(res, 'Sector value is required', 400);
  }

  const existing = await IndustrySector.findOne({
    value: sectorValue.toLowerCase(),
    isDeleted: false,
  });
  if (existing) {
    return errorResponse(res, 'A sector with this value already exists', 409);
  }

  const sector = await IndustrySector.create({
    name: String(name).trim(),
    value: sectorValue.toLowerCase(),
    description: description?.trim() || '',
    isActive: isActive !== false,
  });

  successResponse(res, { message: 'Industry sector created', sector }, 201);
});

const updateSector = asyncHandler(async (req, res) => {
  const { id, name, value, description, isActive } = req.body;

  if (!id) return errorResponse(res, 'Sector ID is required', 400);

  const sector = await IndustrySector.findOne({ _id: id, isDeleted: false });
  if (!sector) return errorResponse(res, 'Industry sector not found', 404);

  if (name !== undefined) sector.name = String(name).trim();
  if (description !== undefined) sector.description = String(description).trim();
  if (isActive !== undefined) sector.isActive = isActive;

  if (value !== undefined) {
    const sectorValue = String(value).trim().toLowerCase();
    if (!sectorValue) return errorResponse(res, 'Sector value cannot be empty', 400);

    const duplicate = await IndustrySector.findOne({
      value: sectorValue,
      isDeleted: false,
      _id: { $ne: id },
    });
    if (duplicate) {
      return errorResponse(res, 'A sector with this value already exists', 409);
    }
    sector.value = sectorValue;
  }

  await sector.save();
  successResponse(res, { message: 'Industry sector updated', sector });
});

const deleteSector = asyncHandler(async (req, res) => {
  const { id } = req.body;
  if (!id) return errorResponse(res, 'Sector ID is required', 400);

  const sector = await IndustrySector.findOne({ _id: id, isDeleted: false });
  if (!sector) return errorResponse(res, 'Industry sector not found', 404);

  sector.isDeleted = true;
  sector.isActive = false;
  await sector.save();

  successResponse(res, { message: 'Industry sector deleted' });
});

const toggleSectorStatus = asyncHandler(async (req, res) => {
  const { id } = req.body;
  if (!id) return errorResponse(res, 'Sector ID is required', 400);

  const sector = await IndustrySector.findOne({ _id: id, isDeleted: false });
  if (!sector) return errorResponse(res, 'Industry sector not found', 404);

  sector.isActive = !sector.isActive;
  await sector.save();

  successResponse(res, {
    message: `Sector ${sector.isActive ? 'activated' : 'deactivated'}`,
    sector,
  });
});

module.exports = {
  listSectors,
  getActiveSectors,
  listIndustrySectorsForMobile,
  createSector,
  updateSector,
  deleteSector,
  toggleSectorStatus,
};

const { successResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const Organizer = require('../models/Organizer');

const SELF_REGISTRATION_TYPES = ['Exhibitor', 'Visitor'];

const attributionAddFields = (participantKey) => ({
  attributedOrganizer: {
    $cond: [
      { $eq: [`$${participantKey}.addedBy.userType`, 'Organizer'] },
      `$${participantKey}.addedBy.userId`,
      {
        $cond: [
          {
            $and: [
              { $ne: ['$organizerId', null] },
              {
                $not: {
                  $in: [`$${participantKey}.addedBy.userType`, SELF_REGISTRATION_TYPES],
                },
              },
            ],
          },
          '$organizerId',
          null,
        ],
      },
    ],
  },
});

const buildDateMatch = (startDate, endDate, participantKey) => {
  if (!startDate && !endDate) return null;

  const dateExpr = {
    $ifNull: [
      `$${participantKey}.addedBy.addedAt`,
      `$${participantKey}.registeredAt`,
    ],
  };

  const conditions = [];
  if (startDate) {
    conditions.push({ $gte: [dateExpr, new Date(startDate)] });
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push({ $lte: [dateExpr, end] });
  }

  return conditions.length === 1
    ? conditions[0]
    : { $and: conditions };
};

const aggregateParticipantStats = async (participantKey, filters = {}) => {
  const { startDate, endDate, eventId } = filters;
  const match = { isDeleted: false };
  if (eventId) match._id = eventId;

  const pipeline = [
    { $match: match },
    { $unwind: `$${participantKey}` },
    { $addFields: attributionAddFields(participantKey) },
    { $match: { attributedOrganizer: { $ne: null } } },
  ];

  const dateMatch = buildDateMatch(startDate, endDate, participantKey);
  if (dateMatch) {
    pipeline.push({ $match: { $expr: dateMatch } });
  }

  pipeline.push(
    {
      $group: {
        _id: '$attributedOrganizer',
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: `$${participantKey}.userId` },
      },
    },
    {
      $project: {
        count: 1,
        uniqueCount: { $size: '$uniqueUsers' },
      },
    }
  );

  return Event.aggregate(pipeline);
};

const getOrganizerAnalytics = asyncHandler(async (req, res) => {
  const filters = req.body?.filters || req.body || {};
  const { search, sortBy = 'totalAdded', sortOrder = 'desc' } = filters;

  const [exhibitorStats, visitorStats, organizers] = await Promise.all([
    aggregateParticipantStats('exhibitor', filters),
    aggregateParticipantStats('visitor', filters),
    Organizer.find({ isDeleted: false }).select('name email organizationName isActive createdAt').lean(),
  ]);

  const exhibitorMap = new Map(
    exhibitorStats.map((row) => [row._id.toString(), { count: row.count, uniqueCount: row.uniqueCount }])
  );
  const visitorMap = new Map(
    visitorStats.map((row) => [row._id.toString(), { count: row.count, uniqueCount: row.uniqueCount }])
  );

  let rows = organizers.map((organizer) => {
    const id = organizer._id.toString();
    const exhibitors = exhibitorMap.get(id) || { count: 0, uniqueCount: 0 };
    const visitors = visitorMap.get(id) || { count: 0, uniqueCount: 0 };

    return {
      organizerId: id,
      name: organizer.name,
      email: organizer.email,
      organizationName: organizer.organizationName || '',
      isActive: organizer.isActive,
      exhibitorsAdded: exhibitors.count,
      uniqueExhibitors: exhibitors.uniqueCount,
      visitorsAdded: visitors.count,
      uniqueVisitors: visitors.uniqueCount,
      totalAdded: exhibitors.count + visitors.count,
    };
  });

  if (search && String(search).trim()) {
    const term = String(search).trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.name?.toLowerCase().includes(term) ||
        row.email?.toLowerCase().includes(term) ||
        row.organizationName?.toLowerCase().includes(term)
    );
  }

  const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const field =
      sortBy === 'exhibitorsAdded'
        ? 'exhibitorsAdded'
        : sortBy === 'visitorsAdded'
          ? 'visitorsAdded'
          : sortBy === 'name'
            ? 'name'
            : 'totalAdded';
    if (field === 'name') {
      return sortMultiplier * (a.name || '').localeCompare(b.name || '');
    }
    return sortMultiplier * ((a[field] || 0) - (b[field] || 0));
  });

  const summary = {
    totalOrganizers: rows.length,
    totalExhibitorsAdded: rows.reduce((sum, row) => sum + row.exhibitorsAdded, 0),
    totalVisitorsAdded: rows.reduce((sum, row) => sum + row.visitorsAdded, 0),
    totalRegistrations: rows.reduce((sum, row) => sum + row.totalAdded, 0),
  };

  successResponse(res, { summary, organizers: rows });
});

module.exports = { getOrganizerAnalytics };

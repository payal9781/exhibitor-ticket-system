const { successResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const Organizer = require('../models/Organizer');
const { parseDateOnlyStart, parseDateOnlyEnd } = require('../utils/dashboardHelpers');

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

const buildOrganizerJoinedQuery = (startDate, endDate) => {
  const query = { isDeleted: false };
  if (!startDate && !endDate) return query;

  query.createdAt = {};
  if (startDate) query.createdAt.$gte = parseDateOnlyStart(startDate);
  if (endDate) query.createdAt.$lte = parseDateOnlyEnd(endDate);
  return query;
};

const aggregateParticipantStats = async (participantKey, eventId) => {
  const match = { isDeleted: false };
  if (eventId) match._id = eventId;

  const pipeline = [
    { $match: match },
    { $unwind: `$${participantKey}` },
    { $addFields: attributionAddFields(participantKey) },
    { $match: { attributedOrganizer: { $ne: null } } },
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
    },
  ];

  return Event.aggregate(pipeline);
};

const getOrganizerAnalytics = asyncHandler(async (req, res) => {
  const filters = { ...(req.body?.filters || req.body || {}) };
  const { search, sortBy = 'totalAdded', sortOrder = 'desc', startDate, endDate, eventId } = filters;

  if (startDate && endDate) {
    const from = parseDateOnlyStart(startDate);
    const to = parseDateOnlyEnd(endDate);
    if (from && to && from > to) {
      return successResponse(res, {
        summary: {
          totalOrganizers: 0,
          totalExhibitorsAdded: 0,
          totalVisitorsAdded: 0,
          totalRegistrations: 0,
        },
        organizers: [],
      });
    }
  }

  const organizerQuery = buildOrganizerJoinedQuery(startDate, endDate);

  const [exhibitorStats, visitorStats, organizers] = await Promise.all([
    aggregateParticipantStats('exhibitor', eventId),
    aggregateParticipantStats('visitor', eventId),
    Organizer.find(organizerQuery)
      .select('name email organizationName isActive createdAt')
      .lean(),
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
      createdAt: organizer.createdAt,
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
            : sortBy === 'createdAt'
              ? 'createdAt'
              : 'totalAdded';
    if (field === 'name') {
      return sortMultiplier * (a.name || '').localeCompare(b.name || '');
    }
    if (field === 'createdAt') {
      return (
        sortMultiplier *
        (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      );
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

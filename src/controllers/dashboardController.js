const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const Organizer = require('../models/Organizer');
const Scan = require('../models/Scan');
const Category = require('../models/Category');

// Helper function to calculate percentage change
function calculatePercentageChange(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous * 100).toFixed(1);
}

// Helper function to format trend text
function formatTrendText(current, previous, period = 'month') {
  const diff = current - previous;
  const percentage = calculatePercentageChange(current, previous);
  const sign = diff >= 0 ? '+' : '';
  const periodText = period === 'month' ? 'this month' : period === 'week' ? 'this week' : 'today';
  
  if (previous === 0 && current === 0) {
    return `No change ${periodText}`;
  }
  
  return `${sign}${diff} ${periodText} (${sign}${percentage}% vs last ${period === 'month' ? 'month' : period === 'week' ? 'week' : 'day'})`;
}

// Get dashboard stats for organizers
const getOrganizerDashboardStats = asyncHandler(async (req, res) => {
  const organizerId = req.user.id;
  // Support both GET (query params) and POST (body) requests
  // Handle filters nested in body or directly in body/query
  let filters = {};
  if (req.method === 'POST') {
    filters = req.body?.filters || req.body || {};
  } else {
    filters = req.query || {};
  }
  const { startDate, endDate, categoryId } = filters;
  
  // Build base query
  let eventQuery = { 
    organizerId, 
    isDeleted: false 
  };
  
  // Apply date range filter
  if (startDate || endDate) {
    eventQuery.createdAt = {};
    if (startDate) {
      eventQuery.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      eventQuery.createdAt.$lte = end;
    }
  }
  
  // Get events matching query
  let events = await Event.find(eventQuery);
  
  // Apply category filter if provided
  if (categoryId) {
    // Get category value from categoryId
    const category = await Category.findById(categoryId);
    if (category) {
      const categoryValue = category.value;
      events = events.filter(event => {
        if (!event.schedules || !Array.isArray(event.schedules)) return false;
        return event.schedules.some(schedule => 
          schedule.activities && schedule.activities.some(activity => 
            activity.category === categoryValue
          )
        );
      });
    }
  }
  
  const eventIds = events.map(e => e._id);
  
  // Get total events
  const totalEvents = eventIds.length;
  
  // Calculate current month period
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);
  
  // Get events created this month
  const eventsThisMonth = events.filter(e => {
    const created = new Date(e.createdAt);
    return created >= startOfMonth && created <= endOfMonth;
  }).length;
  
  // Calculate previous month period
  const startOfPreviousMonth = new Date(startOfMonth);
  startOfPreviousMonth.setMonth(startOfPreviousMonth.getMonth() - 1);
  const endOfPreviousMonth = new Date(startOfMonth);
  endOfPreviousMonth.setDate(0);
  endOfPreviousMonth.setHours(23, 59, 59, 999);
  
  // Get events created in previous month
  const eventsPreviousMonth = events.filter(e => {
    const created = new Date(e.createdAt);
    return created >= startOfPreviousMonth && created <= endOfPreviousMonth;
  }).length;
  
  // Get all events for this organizer with populated exhibitors and visitors
  const eventsWithDetails = await Event.find({ 
    _id: { $in: eventIds },
    organizerId, 
    isDeleted: false 
  }).populate('exhibitor.userId visitor.userId');
  
  // Count unique exhibitors and visitors across all events
  const uniqueExhibitors = new Set();
  const uniqueVisitors = new Set();
  
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfPreviousWeek = new Date(startOfWeek);
  startOfPreviousWeek.setDate(startOfPreviousWeek.getDate() - 7);
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const startOfPreviousDay = new Date(startOfDay);
  startOfPreviousDay.setDate(startOfPreviousDay.getDate() - 1);
  
  let exhibitorsThisWeek = 0;
  let exhibitorsPreviousWeek = 0;
  let visitorsToday = 0;
  let visitorsPreviousDay = 0;
  
  for (const event of eventsWithDetails) {
    // Count unique exhibitors
    if (event.exhibitor && Array.isArray(event.exhibitor)) {
      event.exhibitor.forEach(exhibitorEntry => {
        if (exhibitorEntry && exhibitorEntry.userId) {
          const exhibitor = exhibitorEntry.userId;
          if (exhibitor && !exhibitor.isDeleted) {
            uniqueExhibitors.add(exhibitor._id.toString());
            const regDate = new Date(exhibitorEntry.registeredAt || exhibitor.createdAt);
            if (regDate >= startOfWeek) {
              exhibitorsThisWeek++;
            } else if (regDate >= startOfPreviousWeek && regDate < startOfWeek) {
              exhibitorsPreviousWeek++;
            }
          }
        }
      });
    }
    
    // Count unique visitors
    if (event.visitor && Array.isArray(event.visitor)) {
      event.visitor.forEach(visitorEntry => {
        if (visitorEntry && visitorEntry.userId) {
          const visitor = visitorEntry.userId;
          if (visitor && !visitor.isDeleted) {
            uniqueVisitors.add(visitor._id.toString());
            const regDate = new Date(visitorEntry.registeredAt || visitor.createdAt);
            if (regDate >= startOfDay) {
              visitorsToday++;
            } else if (regDate >= startOfPreviousDay && regDate < startOfDay) {
              visitorsPreviousDay++;
            }
          }
        }
      });
    }
  }
  
  const totalExhibitors = uniqueExhibitors.size;
  const totalVisitors = uniqueVisitors.size;
  
  // Calculate revenue (mock calculation - you can implement actual revenue logic)
  const revenue = totalEvents * 1500 + totalExhibitors * 200 + totalVisitors * 50;
  const lastMonthRevenue = revenue * 0.89; // Mock 12% increase
  const revenueIncrease = ((revenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1);
  
  const stats = {
    totalEvents: {
      value: totalEvents,
      trend: formatTrendText(eventsThisMonth, eventsPreviousMonth, 'month'),
      trendUp: eventsThisMonth >= eventsPreviousMonth,
      previousMonthValue: eventsPreviousMonth,
      percentageChange: parseFloat(calculatePercentageChange(eventsThisMonth, eventsPreviousMonth))
    },
    activeExhibitors: {
      value: totalExhibitors,
      trend: formatTrendText(exhibitorsThisWeek, exhibitorsPreviousWeek, 'week'),
      trendUp: exhibitorsThisWeek >= exhibitorsPreviousWeek,
      previousWeekValue: exhibitorsPreviousWeek,
      percentageChange: parseFloat(calculatePercentageChange(exhibitorsThisWeek, exhibitorsPreviousWeek))
    },
    registeredVisitors: {
      value: totalVisitors,
      trend: formatTrendText(visitorsToday, visitorsPreviousDay, 'day'),
      trendUp: visitorsToday >= visitorsPreviousDay,
      previousDayValue: visitorsPreviousDay,
      percentageChange: parseFloat(calculatePercentageChange(visitorsToday, visitorsPreviousDay))
    },
    revenue: {
      value: `$${revenue.toLocaleString()}`,
      trend: `+${revenueIncrease}% vs last month`,
      trendUp: parseFloat(revenueIncrease) > 0
    }
  };
  
  successResponse(res, stats);
});

// Get dashboard stats for super admin
const getSuperAdminDashboardStats = asyncHandler(async (req, res) => {
  // Support both GET (query params) and POST (body) requests
  // Handle filters nested in body or directly in body/query
  let filters = {};
  if (req.method === 'POST') {
    filters = req.body?.filters || req.body || {};
  } else {
    filters = req.query || {};
  }
  const { startDate, endDate, organizerId, categoryId } = filters;
  
  // Build base queries
  let organizerQuery = { isDeleted: false };
  let eventQuery = { isDeleted: false };
  
  // Apply date range filter
  if (startDate || endDate) {
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    organizerQuery.createdAt = dateFilter;
    eventQuery.createdAt = dateFilter;
  }
  
  // Apply organizer filter
  if (organizerId) {
    eventQuery.organizerId = organizerId;
  }
  
  // Get total organizers
  const totalOrganizers = await Organizer.countDocuments(organizerQuery);
  
  // Calculate current month period
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);
  
  // Get organizers created this month
  const organizersThisMonthQuery = { ...organizerQuery, createdAt: { $gte: startOfMonth, $lte: endOfMonth } };
  const organizersThisMonth = await Organizer.countDocuments(organizersThisMonthQuery);
  
  // Calculate previous month period
  const startOfPreviousMonth = new Date(startOfMonth);
  startOfPreviousMonth.setMonth(startOfPreviousMonth.getMonth() - 1);
  const endOfPreviousMonth = new Date(startOfMonth);
  endOfPreviousMonth.setDate(0);
  endOfPreviousMonth.setHours(23, 59, 59, 999);
  
  // Get organizers created in previous month
  const organizersPreviousMonthQuery = { ...organizerQuery, createdAt: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth } };
  const organizersPreviousMonth = await Organizer.countDocuments(organizersPreviousMonthQuery);
  
  // Get events matching query
  let events = await Event.find(eventQuery);
  
  // Apply category filter if provided
  if (categoryId) {
    // Get category value from categoryId
    const category = await Category.findById(categoryId);
    if (category) {
      const categoryValue = category.value;
      events = events.filter(event => {
        if (!event.schedules || !Array.isArray(event.schedules)) return false;
        return event.schedules.some(schedule => 
          schedule.activities && schedule.activities.some(activity => 
            activity.category === categoryValue
          )
        );
      });
    }
  }
  
  const eventIds = events.map(e => e._id);
  const totalEvents = eventIds.length;
  
  // Get events created this month
  const eventsThisMonth = events.filter(e => {
    const created = new Date(e.createdAt);
    return created >= startOfMonth && created <= endOfMonth;
  }).length;
  
  // Get events created in previous month
  const eventsPreviousMonth = events.filter(e => {
    const created = new Date(e.createdAt);
    return created >= startOfPreviousMonth && created <= endOfPreviousMonth;
  }).length;
  
  // Get total active users (exhibitors + visitors)
  let exhibitorQuery = { isDeleted: false, isActive: true };
  let visitorQuery = { isDeleted: false, isActive: true };
  
  // Apply date filter for users if provided
  if (startDate || endDate) {
    const userDateFilter = {};
    if (startDate) {
      userDateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      userDateFilter.$lte = end;
    }
    exhibitorQuery.createdAt = userDateFilter;
    visitorQuery.createdAt = userDateFilter;
  }
  
  const totalExhibitors = await Exhibitor.countDocuments(exhibitorQuery);
  const totalVisitors = await Visitor.countDocuments(visitorQuery);
  const activeUsers = totalExhibitors + totalVisitors;
  
  // Calculate current week period
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date();
  endOfWeek.setHours(23, 59, 59, 999);
  
  // Calculate previous week period
  const startOfPreviousWeek = new Date(startOfWeek);
  startOfPreviousWeek.setDate(startOfPreviousWeek.getDate() - 7);
  const endOfPreviousWeek = new Date(startOfWeek);
  endOfPreviousWeek.setDate(endOfPreviousWeek.getDate() - 1);
  endOfPreviousWeek.setHours(23, 59, 59, 999);
  
  // Get users created this week
  const exhibitorsThisWeek = await Exhibitor.countDocuments({
    ...exhibitorQuery,
    createdAt: { $gte: startOfWeek, $lte: endOfWeek }
  });
  
  const visitorsThisWeek = await Visitor.countDocuments({
    ...visitorQuery,
    createdAt: { $gte: startOfWeek, $lte: endOfWeek }
  });
  
  const usersThisWeek = exhibitorsThisWeek + visitorsThisWeek;
  
  // Get users created in previous week
  const exhibitorsPreviousWeek = await Exhibitor.countDocuments({
    ...exhibitorQuery,
    createdAt: { $gte: startOfPreviousWeek, $lte: endOfPreviousWeek }
  });
  
  const visitorsPreviousWeek = await Visitor.countDocuments({
    ...visitorQuery,
    createdAt: { $gte: startOfPreviousWeek, $lte: endOfPreviousWeek }
  });
  
  const usersPreviousWeek = exhibitorsPreviousWeek + visitorsPreviousWeek;
  
  // Calculate platform revenue (mock calculation)
  const platformRevenue = totalEvents * 500 + totalOrganizers * 2000 + activeUsers * 25;
  const lastMonthRevenue = platformRevenue * 0.81; // Mock 23% increase
  const revenueIncrease = ((platformRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1);
  
  const stats = {
    totalOrganizers: {
      value: totalOrganizers,
      trend: formatTrendText(organizersThisMonth, organizersPreviousMonth, 'month'),
      trendUp: organizersThisMonth >= organizersPreviousMonth,
      previousMonthValue: organizersPreviousMonth,
      percentageChange: parseFloat(calculatePercentageChange(organizersThisMonth, organizersPreviousMonth))
    },
    totalEvents: {
      value: totalEvents,
      trend: formatTrendText(eventsThisMonth, eventsPreviousMonth, 'month'),
      trendUp: eventsThisMonth >= eventsPreviousMonth,
      previousMonthValue: eventsPreviousMonth,
      percentageChange: parseFloat(calculatePercentageChange(eventsThisMonth, eventsPreviousMonth))
    },
    activeUsers: {
      value: activeUsers,
      trend: formatTrendText(usersThisWeek, usersPreviousWeek, 'week'),
      trendUp: usersThisWeek >= usersPreviousWeek,
      previousWeekValue: usersPreviousWeek,
      percentageChange: parseFloat(calculatePercentageChange(usersThisWeek, usersPreviousWeek))
    },
    totalExhibitors: {
      value: totalExhibitors,
      trend: formatTrendText(exhibitorsThisWeek, exhibitorsPreviousWeek, 'week'),
      trendUp: exhibitorsThisWeek >= exhibitorsPreviousWeek,
      previousWeekValue: exhibitorsPreviousWeek,
      percentageChange: parseFloat(calculatePercentageChange(exhibitorsThisWeek, exhibitorsPreviousWeek))
    },
    totalVisitors: {
      value: totalVisitors,
      trend: formatTrendText(visitorsThisWeek, visitorsPreviousWeek, 'week'),
      trendUp: visitorsThisWeek >= visitorsPreviousWeek,
      previousWeekValue: visitorsPreviousWeek,
      percentageChange: parseFloat(calculatePercentageChange(visitorsThisWeek, visitorsPreviousWeek))
    },
    platformRevenue: {
      value: `$${platformRevenue.toLocaleString()}`,
      trend: `+${revenueIncrease}% vs last month`,
      trendUp: parseFloat(revenueIncrease) > 0
    }
  };
  
  successResponse(res, stats);
});

// Get recent activity for dashboard
const getRecentActivity = asyncHandler(async (req, res) => {
  // Support both GET (query params) and POST (body) requests
  // Handle filters nested in body or directly in body/query
  let filters = {};
  if (req.method === 'POST') {
    filters = req.body?.filters || req.body || {};
  } else {
    filters = req.query || {};
  }
  const { startDate, endDate, organizerId } = filters;
  
  // For organizer users, automatically filter by their organizerId
  let finalOrganizerId = organizerId;
  if (req.user.type === 'organizer' && req.user.id) {
    finalOrganizerId = req.user.id;
  }
  
  const activities = [];
  
  // Build event query
  let eventQuery = { isDeleted: false };
  if (finalOrganizerId) {
    eventQuery.organizerId = finalOrganizerId;
  }
  if (startDate || endDate) {
    eventQuery.updatedAt = {};
    if (startDate) {
      eventQuery.updatedAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      eventQuery.updatedAt.$lte = end;
    }
  }
  
  // Build exhibitor/visitor query
  let exhibitorQuery = { isDeleted: false };
  let visitorQuery = { isDeleted: false };
  if (startDate || endDate) {
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    exhibitorQuery.createdAt = dateFilter;
    visitorQuery.createdAt = dateFilter;
  }
  
  // Get recent events
  const recentEvents = await Event.find(eventQuery)
    .sort({ updatedAt: -1 })
    .limit(5)
    .select('title updatedAt createdAt');
  
  // Get recent exhibitors
  const recentExhibitors = await Exhibitor.find(exhibitorQuery)
    .sort({ createdAt: -1 })
    .limit(5)
    .select('companyName createdAt');
  
  // Get recent visitors
  const recentVisitors = await Visitor.find(visitorQuery)
    .sort({ createdAt: -1 })
    .limit(5)
    .select('name createdAt');
  
  // Format activities - only show creation activities, not updates
  recentEvents.forEach(event => {
    const isNew = event.createdAt.getTime() === event.updatedAt.getTime();
    // Only add activity if it's a new event, not an update
    if (isNew) {
      activities.push({
        action: `New event "${event.title}" was created`,
        time: getTimeAgo(event.createdAt),
        timestamp: event.createdAt,
        type: 'event'
      });
    }
  });
  
  recentExhibitors.forEach(exhibitor => {
    activities.push({
      action: `New exhibitor "${exhibitor.companyName}" registered`,
      time: getTimeAgo(exhibitor.createdAt),
      timestamp: exhibitor.createdAt,
      type: 'exhibitor'
    });
  });
  
  recentVisitors.forEach(visitor => {
    activities.push({
      action: `New visitor "${visitor.name}" registered`,
      time: getTimeAgo(visitor.createdAt),
      timestamp: visitor.createdAt,
      type: 'visitor'
    });
  });
  
  // Sort by timestamp and limit to 5
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  successResponse(res, activities.slice(0, 5));
});

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInMs = now - date;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minutes ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hours ago`;
  } else {
    return `${diffInDays} days ago`;
  }
}

// Get organizer's attendee overview
const getOrganizerAttendeeOverview = asyncHandler(async (req, res) => {
  const organizerId = req.user.id;
  
  // Get all events for this organizer
  const organizerEvents = await Event.find({ 
    organizerId, 
    isDeleted: false 
  }).select('_id title fromDate toDate');
  
  const eventIds = organizerEvents.map(event => event._id);
  
  if (eventIds.length === 0) {
    return successResponse(res, {
      totalEvents: 0,
      totalExhibitors: 0,
      totalVisitors: 0,
      recentAttendees: [],
      eventBreakdown: []
    });
  }
  
  // Get exhibitors who attended organizer's events
  const exhibitorAttendance = await Event.aggregate([
    { $match: { _id: { $in: eventIds } } },
    { $unwind: '$exhibitor' },
    {
      $lookup: {
        from: 'exhibitors',
        localField: 'exhibitor.userId',
        foreignField: '_id',
        as: 'exhibitorDetails'
      }
    },
    { $unwind: '$exhibitorDetails' },
    {
      $match: {
        'exhibitorDetails.isDeleted': false,
        'exhibitorDetails.isActive': true
      }
    },
    {
      $group: {
        _id: '$exhibitor.userId',
        exhibitor: { $first: '$exhibitorDetails' },
        events: { $push: { eventId: '$_id', title: '$title', registeredAt: '$exhibitor.registeredAt' } },
        totalEvents: { $sum: 1 },
        lastRegistration: { $max: '$exhibitor.registeredAt' }
      }
    }
  ]);
  
  // Get visitors who attended organizer's events
  const visitorAttendance = await Event.aggregate([
    { $match: { _id: { $in: eventIds } } },
    { $unwind: '$visitor' },
    {
      $lookup: {
        from: 'visitors',
        localField: 'visitor.userId',
        foreignField: '_id',
        as: 'visitorDetails'
      }
    },
    { $unwind: '$visitorDetails' },
    {
      $match: {
        'visitorDetails.isDeleted': false,
        'visitorDetails.isActive': true
      }
    },
    {
      $group: {
        _id: '$visitor.userId',
        visitor: { $first: '$visitorDetails' },
        events: { $push: { eventId: '$_id', title: '$title', registeredAt: '$visitor.registeredAt' } },
        totalEvents: { $sum: 1 },
        lastRegistration: { $max: '$visitor.registeredAt' }
      }
    }
  ]);
  
  // Get event breakdown
  const eventBreakdown = await Event.aggregate([
    { $match: { _id: { $in: eventIds } } },
    {
      $project: {
        title: 1,
        fromDate: 1,
        toDate: 1,
        exhibitorCount: { $size: '$exhibitor' },
        visitorCount: { $size: '$visitor' },
        totalAttendees: { $add: [{ $size: '$exhibitor' }, { $size: '$visitor' }] }
      }
    },
    { $sort: { fromDate: -1 } }
  ]);
  
  // Get recent attendees (last 10)
  const recentAttendees = [];
  
  // Add recent exhibitors
  exhibitorAttendance
    .sort((a, b) => new Date(b.lastRegistration) - new Date(a.lastRegistration))
    .slice(0, 5)
    .forEach(item => {
      recentAttendees.push({
        type: 'exhibitor',
        name: item.exhibitor.companyName,
        email: item.exhibitor.email,
        registeredAt: item.lastRegistration,
        totalEvents: item.totalEvents
      });
    });
  
  // Add recent visitors
  visitorAttendance
    .sort((a, b) => new Date(b.lastRegistration) - new Date(a.lastRegistration))
    .slice(0, 5)
    .forEach(item => {
      recentAttendees.push({
        type: 'visitor',
        name: item.visitor.name,
        email: item.visitor.email,
        registeredAt: item.lastRegistration,
        totalEvents: item.totalEvents
      });
    });
  
  // Sort recent attendees by registration date
  recentAttendees.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
  
  const overview = {
    totalEvents: organizerEvents.length,
    totalExhibitors: exhibitorAttendance.length,
    totalVisitors: visitorAttendance.length,
    totalAttendees: exhibitorAttendance.length + visitorAttendance.length,
    recentAttendees: recentAttendees.slice(0, 10),
    eventBreakdown: eventBreakdown,
    topExhibitors: exhibitorAttendance
      .sort((a, b) => b.totalEvents - a.totalEvents)
      .slice(0, 5)
      .map(item => ({
        name: item.exhibitor.companyName,
        email: item.exhibitor.email,
        eventsAttended: item.totalEvents,
        sector: item.exhibitor.Sector
      })),
    topVisitors: visitorAttendance
      .sort((a, b) => b.totalEvents - a.totalEvents)
      .slice(0, 5)
      .map(item => ({
        name: item.visitor.name,
        email: item.visitor.email,
        eventsAttended: item.totalEvents,
        company: item.visitor.companyName
      }))
  };
  
  successResponse(res, overview);
});

module.exports = {
  getOrganizerDashboardStats,
  getSuperAdminDashboardStats,
  getRecentActivity,
  getOrganizerAttendeeOverview
};
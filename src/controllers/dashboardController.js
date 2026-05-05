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
  let filters = {};
  if (req.method === 'POST') {
    filters = req.body?.filters || req.body || {};
  } else {
    filters = req.query || {};
  }
  const { startDate, endDate, categoryId } = filters;
  
  // Build base query for all organizer events
  let eventBaseQuery = { 
    organizerId, 
    isDeleted: false 
  };
  
  let matchingEvents = await Event.find(eventBaseQuery);
  
  // Apply category filter if provided
  if (categoryId) {
    const category = await Category.findById(categoryId);
    if (category) {
      const categoryValue = category.value;
      matchingEvents = matchingEvents.filter(event => {
        if (!event.schedules || !Array.isArray(event.schedules)) return false;
        return event.schedules.some(schedule => 
          schedule.activities && schedule.activities.some(activity => 
            activity.category === categoryValue
          )
        );
      });
    }
  }
  
  const matchingEventIds = matchingEvents.map(e => e._id);
  
  // Date filter for specific metrics
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }

  // 1. Total Events in period
  let eventPeriodQuery = { _id: { $in: matchingEventIds }, isDeleted: false };
  if (Object.keys(dateFilter).length > 0) eventPeriodQuery.createdAt = dateFilter;
  const totalEvents = await Event.countDocuments(eventPeriodQuery);
  
  // Calculate time periods
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  
  const startOfWeek = new Date();
  startOfWeek.setDate(now.getDate() - 7);
  const startOfPreviousWeek = new Date(startOfWeek);
  startOfPreviousWeek.setDate(startOfWeek.getDate() - 7);
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfPreviousDay = new Date(startOfDay);
  startOfPreviousDay.setDate(startOfDay.getDate() - 1);

  // Fetch details for filtering registrations
  const eventsWithDetails = await Event.find({ 
    _id: { $in: matchingEventIds },
    isDeleted: false 
  }).populate('exhibitor.userId visitor.userId');
  
  const uniqueExhibitors = new Set();
  const uniqueVisitors = new Set();
  const sectorCounts = {};
  const eventEngagement = [];
  
  for (const event of eventsWithDetails) {
    let exhibitorsInEventInPeriod = 0;
    let visitorsInEventInPeriod = 0;

    if (event.exhibitor) {
      event.exhibitor.forEach(entry => {
        if (entry.userId && !entry.userId.isDeleted) {
          const regDate = new Date(entry.registeredAt || entry.userId.createdAt);
          let inRange = true;
          if (startDate && regDate < new Date(startDate)) inRange = false;
          if (endDate && regDate > new Date(endDate)) inRange = false;
          
          if (inRange) {
            uniqueExhibitors.add(entry.userId._id.toString());
            exhibitorsInEventInPeriod++;
            
            // Track sectors (for filtered exhibitors)
            const sector = entry.userId.Sector || 'Other';
            sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
          }
        }
      });
    }
    
    if (event.visitor) {
      event.visitor.forEach(entry => {
        if (entry.userId && !entry.userId.isDeleted) {
          const regDate = new Date(entry.registeredAt || entry.userId.createdAt);
          let inRange = true;
          if (startDate && regDate < new Date(startDate)) inRange = false;
          if (endDate && regDate > new Date(endDate)) inRange = false;
          
          if (inRange) {
            uniqueVisitors.add(entry.userId._id.toString());
            visitorsInEventInPeriod++;
          }
        }
      });
    }

    eventEngagement.push({
      title: event.title,
      exhibitors: exhibitorsInEventInPeriod,
      visitors: visitorsInEventInPeriod,
      total: exhibitorsInEventInPeriod + visitorsInEventInPeriod
    });
  }
  
  const totalExhibitorsCount = uniqueExhibitors.size;
  const totalVisitorsCount = uniqueVisitors.size;
  
  // 3. Total Scans in period
  let scanQuery = { eventId: { $in: matchingEventIds } };
  if (Object.keys(dateFilter).length > 0) scanQuery.createdAt = dateFilter;
  const totalScans = await Scan.countDocuments(scanQuery);

  // Prepare sector data for charts
  const sectorData = Object.entries(sectorCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Prepare top events data
  const topEvents = eventEngagement
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Calculate trends (always relative to NOW)
  const eventsThisMonth = await Event.countDocuments({ _id: { $in: matchingEventIds }, createdAt: { $gte: startOfMonth } });
  const eventsPrevMonth = await Event.countDocuments({ _id: { $in: matchingEventIds }, createdAt: { $gte: startOfPreviousMonth, $lt: startOfMonth } });

  const stats = {
    totalEvents: {
      value: totalEvents,
      trend: formatTrendText(eventsThisMonth, eventsPrevMonth, 'month'),
      trendUp: eventsThisMonth >= eventsPrevMonth,
      percentageChange: parseFloat(calculatePercentageChange(eventsThisMonth, eventsPrevMonth))
    },
    activeExhibitors: {
      value: totalExhibitorsCount,
      trend: 'In selected period',
      trendUp: true
    },
    registeredVisitors: {
      value: totalVisitorsCount,
      trend: 'In selected period',
      trendUp: true
    },
    engagement: {
      value: totalScans,
      trend: 'Total scans in period',
      trendUp: true
    },
    insights: {
      sectorDistribution: sectorData,
      topEvents: topEvents,
      engagementOverview: {
        totalScans,
        periodScans: totalScans
      }
    }
  };
  
  successResponse(res, stats);
});

// Get dashboard stats for super admin
const getSuperAdminDashboardStats = asyncHandler(async (req, res) => {
  // Support both GET (query params) and POST (body) requests
  let filters = {};
  if (req.method === 'POST') {
    filters = req.body?.filters || req.body || {};
  } else {
    filters = req.query || {};
  }
  const { startDate, endDate, organizerId, categoryId } = filters;
  
  // Build base query for events to filter by category/organizer
  let eventBaseQuery = { isDeleted: false };
  if (organizerId) eventBaseQuery.organizerId = organizerId;
  
  let matchingEvents = await Event.find(eventBaseQuery);
  
  // Apply category filter if provided
  if (categoryId) {
    const category = await Category.findById(categoryId);
    if (category) {
      const categoryValue = category.value;
      matchingEvents = matchingEvents.filter(event => {
        if (!event.schedules || !Array.isArray(event.schedules)) return false;
        return event.schedules.some(schedule => 
          schedule.activities && schedule.activities.some(activity => 
            activity.category === categoryValue
          )
        );
      });
    }
  }

  const matchingEventIds = matchingEvents.map(e => e._id);
  
  // Date filter for specific metrics
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }

  // 1. Total Events in period
  let eventPeriodQuery = { _id: { $in: matchingEventIds }, isDeleted: false };
  if (Object.keys(dateFilter).length > 0) eventPeriodQuery.createdAt = dateFilter;
  const totalEvents = await Event.countDocuments(eventPeriodQuery);

  // 2. Total Organizers in period
  let organizerPeriodQuery = { isDeleted: false };
  if (Object.keys(dateFilter).length > 0) organizerPeriodQuery.createdAt = dateFilter;
  const totalOrganizers = await Organizer.countDocuments(organizerPeriodQuery);

  // 3. Total Exhibitors/Visitors in period (from matching events)
  let uniqueExhibitors = new Set();
  let uniqueVisitors = new Set();
  
  // Fetch all registrations for matching events to filter by date
  const eventsWithDetails = await Event.find({ _id: { $in: matchingEventIds } }).populate('exhibitor.userId visitor.userId');
  
  const eventEngagement = [];
  
  for (const event of eventsWithDetails) {
    let exhibitorsInPeriod = 0;
    let visitorsInPeriod = 0;

    event.exhibitor?.forEach(e => {
      if (e.userId && !e.userId.isDeleted) {
        const regDate = new Date(e.registeredAt || e.userId.createdAt);
        let inRange = true;
        if (startDate && regDate < new Date(startDate)) inRange = false;
        if (endDate && regDate > new Date(endDate)) inRange = false;
        if (inRange) {
          uniqueExhibitors.add(e.userId._id.toString());
          exhibitorsInPeriod++;
        }
      }
    });
    event.visitor?.forEach(v => {
      if (v.userId && !v.userId.isDeleted) {
        const regDate = new Date(v.registeredAt || v.userId.createdAt);
        let inRange = true;
        if (startDate && regDate < new Date(startDate)) inRange = false;
        if (endDate && regDate > new Date(endDate)) inRange = false;
        if (inRange) {
          uniqueVisitors.add(v.userId._id.toString());
          visitorsInPeriod++;
        }
      }
    });

    eventEngagement.push({
      title: event.title,
      exhibitors: exhibitorsInPeriod,
      visitors: visitorsInPeriod,
      total: exhibitorsInPeriod + visitorsInPeriod
    });
  }

  const totalExhibitorsCount = uniqueExhibitors.size;
  const totalVisitorsCount = uniqueVisitors.size;
  const activeUsers = totalExhibitorsCount + totalVisitorsCount + totalOrganizers;

  // 4. Total Scans in period
  let scanQuery = { eventId: { $in: matchingEventIds } };
  if (Object.keys(dateFilter).length > 0) scanQuery.createdAt = dateFilter;
  const totalScans = await Scan.countDocuments(scanQuery);

  // Calculate trends (always based on current time for growth perspective)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  const eventsThisMonth = await Event.countDocuments({ _id: { $in: matchingEventIds }, createdAt: { $gte: startOfMonth } });
  const eventsPrevMonth = await Event.countDocuments({ _id: { $in: matchingEventIds }, createdAt: { $gte: startOfPreviousMonth, $lt: startOfMonth } });
  
  const orgsThisMonth = await Organizer.countDocuments({ createdAt: { $gte: startOfMonth } });
  const orgsPrevMonth = await Organizer.countDocuments({ createdAt: { $gte: startOfPreviousMonth, $lt: startOfMonth } });

  // Sector Trends (filtered by date)
  const sectorMatch = { isDeleted: false };
  if (Object.keys(dateFilter).length > 0) sectorMatch.createdAt = dateFilter;
  
  const sectorTrends = await Exhibitor.aggregate([
    { $match: sectorMatch },
    { $group: { _id: '$Sector', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  const stats = {
    totalOrganizers: {
      value: totalOrganizers,
      trend: formatTrendText(orgsThisMonth, orgsPrevMonth, 'month'),
      trendUp: orgsThisMonth >= orgsPrevMonth,
      percentageChange: parseFloat(calculatePercentageChange(orgsThisMonth, orgsPrevMonth))
    },
    totalEvents: {
      value: totalEvents,
      trend: formatTrendText(eventsThisMonth, eventsPrevMonth, 'month'),
      trendUp: eventsThisMonth >= eventsPrevMonth,
      percentageChange: parseFloat(calculatePercentageChange(eventsThisMonth, eventsPrevMonth))
    },
    activeUsers: {
      value: activeUsers,
      trend: `${activeUsers.toLocaleString()} total platform users`,
      trendUp: true
    },
    totalExhibitors: {
      value: totalExhibitorsCount,
      trend: 'From filtered events',
      trendUp: true
    },
    totalVisitors: {
      value: totalVisitorsCount,
      trend: 'From filtered events',
      trendUp: true
    },
    engagement: {
      value: totalScans,
      trend: 'Total platform scans',
      trendUp: true
    },
    insights: {
      globalSectorTrends: sectorTrends.map(s => ({ name: s._id || 'Other', value: s.count })),
      topEvents: eventEngagement.sort((a, b) => b.total - a.total).slice(0, 5),
      platformGrowth: {
        totalExhibitors: totalExhibitorsCount,
        totalVisitors: totalVisitorsCount,
        totalScans
      }
    }
  };
  
  successResponse(res, stats);
});

// Get recent activity for dashboard
const getRecentActivity = asyncHandler(async (req, res) => {
  let filters = {};
  if (req.method === 'POST') {
    filters = req.body?.filters || req.body || {};
  } else {
    filters = req.query || {};
  }
  
  const { startDate, endDate, categoryId, organizerId } = filters;
  const userType = req.user?.type;
  const userId = req.user?.id;

  const activities = [];
  
  // Build base filters
  let eventQuery = { isDeleted: false };
  if (userType === 'organizer') eventQuery.organizerId = userId;
  else if (organizerId) eventQuery.organizerId = organizerId;

  const dateFilter = {};
  if (startDate || endDate) {
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    eventQuery.updatedAt = dateFilter;
  }

  // Get matching events
  let events = await Event.find(eventQuery);
  
  // Apply category filter if provided
  if (categoryId) {
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
  const recentEvents = events.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);

  // Get related IDs for user activities
  const exhibitorIds = new Set();
  const visitorIds = new Set();
  events.forEach(event => {
    event.exhibitor?.forEach(e => { if (e.userId) exhibitorIds.add(e.userId.toString()); });
    event.visitor?.forEach(v => { if (v.userId) visitorIds.add(v.userId.toString()); });
  });

  // Fetch activities in parallel
  const [recentExhibitors, recentVisitors, recentScans] = await Promise.all([
    exhibitorIds.size > 0 
      ? Exhibitor.find({ _id: { $in: Array.from(exhibitorIds) }, isDeleted: false }).sort({ createdAt: -1 }).limit(10).select('companyName createdAt')
      : [],
    visitorIds.size > 0 
      ? Visitor.find({ _id: { $in: Array.from(visitorIds) }, isDeleted: false }).sort({ createdAt: -1 }).limit(10).select('name createdAt')
      : [],
    Scan.find({ eventId: { $in: eventIds } }).sort({ createdAt: -1 }).limit(10).populate('scanner eventId')
  ]);

  // Format activities
  recentEvents.forEach(event => {
    activities.push({
      action: `Event "${event.title}" was ${event.createdAt.getTime() === event.updatedAt.getTime() ? 'created' : 'updated'}`,
      time: getTimeAgo(event.updatedAt),
      timestamp: event.updatedAt,
      type: 'event'
    });
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

  recentScans.forEach(scan => {
    if (scan.scanner && scan.eventId) {
      activities.push({
        action: `${scan.userModel} scanned an attendee at "${scan.eventId.title}"`,
        time: getTimeAgo(scan.createdAt),
        timestamp: scan.createdAt,
        type: 'scan'
      });
    }
  });
  
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  successResponse(res, activities.slice(0, 50));
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
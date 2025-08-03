const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const Organizer = require('../models/Organizer');
const Scan = require('../models/Scan');

// Get dashboard stats for organizers
const getOrganizerDashboardStats = asyncHandler(async (req, res) => {
  const organizerId = req.user._id;
  
  // Get total events for this organizer
  const totalEvents = await Event.countDocuments({ 
    organizerId, 
    isDeleted: false 
  });
  
  // Get events created this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const eventsThisMonth = await Event.countDocuments({
    organizerId,
    isDeleted: false,
    createdAt: { $gte: startOfMonth }
  });
  
  // Get all events for this organizer with populated exhibitors and visitors
  const events = await Event.find({ 
    organizerId, 
    isDeleted: false 
  }).populate('exhibitor visitor');
  
  // Count unique exhibitors and visitors across all events
  const uniqueExhibitors = new Set();
  const uniqueVisitors = new Set();
  
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  let exhibitorsThisWeek = 0;
  let visitorsToday = 0;
  
  for (const event of events) {
    // Count unique exhibitors
    if (event.exhibitor && Array.isArray(event.exhibitor)) {
      event.exhibitor.forEach(exhibitor => {
        if (exhibitor && !exhibitor.isDeleted) {
          uniqueExhibitors.add(exhibitor._id.toString());
          if (exhibitor.createdAt >= startOfWeek) {
            exhibitorsThisWeek++;
          }
        }
      });
    }
    
    // Count unique visitors
    if (event.visitor && Array.isArray(event.visitor)) {
      event.visitor.forEach(visitor => {
        if (visitor && !visitor.isDeleted) {
          uniqueVisitors.add(visitor._id.toString());
          if (visitor.createdAt >= startOfDay) {
            visitorsToday++;
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
      trend: `+${eventsThisMonth} this month`,
      trendUp: eventsThisMonth > 0
    },
    activeExhibitors: {
      value: totalExhibitors,
      trend: `+${exhibitorsThisWeek} this week`,
      trendUp: exhibitorsThisWeek > 0
    },
    registeredVisitors: {
      value: totalVisitors,
      trend: `+${visitorsToday} today`,
      trendUp: visitorsToday > 0
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
  // Get total organizers
  const totalOrganizers = await Organizer.countDocuments({ isDeleted: false });
  
  // Get organizers created this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const organizersThisMonth = await Organizer.countDocuments({
    isDeleted: false,
    createdAt: { $gte: startOfMonth }
  });
  
  // Get total events
  const totalEvents = await Event.countDocuments({ isDeleted: false });
  
  // Get events created this month
  const eventsThisMonth = await Event.countDocuments({
    isDeleted: false,
    createdAt: { $gte: startOfMonth }
  });
  
  // Get total active users (exhibitors + visitors)
  const totalExhibitors = await Exhibitor.countDocuments({ isDeleted: false, isActive: true });
  const totalVisitors = await Visitor.countDocuments({ isDeleted: false, isActive: true });
  const activeUsers = totalExhibitors + totalVisitors;
  
  // Get users created this week
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  
  const exhibitorsThisWeek = await Exhibitor.countDocuments({
    isDeleted: false,
    createdAt: { $gte: startOfWeek }
  });
  
  const visitorsThisWeek = await Visitor.countDocuments({
    isDeleted: false,
    createdAt: { $gte: startOfWeek }
  });
  
  const usersThisWeek = exhibitorsThisWeek + visitorsThisWeek;
  
  // Calculate platform revenue (mock calculation)
  const platformRevenue = totalEvents * 500 + totalOrganizers * 2000 + activeUsers * 25;
  const lastMonthRevenue = platformRevenue * 0.81; // Mock 23% increase
  const revenueIncrease = ((platformRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1);
  
  const stats = {
    totalOrganizers: {
      value: totalOrganizers,
      trend: `+${organizersThisMonth} this month`,
      trendUp: organizersThisMonth > 0
    },
    totalEvents: {
      value: totalEvents,
      trend: `+${eventsThisMonth} this month`,
      trendUp: eventsThisMonth > 0
    },
    activeUsers: {
      value: activeUsers,
      trend: `+${usersThisWeek} this week`,
      trendUp: usersThisWeek > 0
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
  const activities = [];
  
  // Get recent events
  const recentEvents = await Event.find({ isDeleted: false })
    .sort({ updatedAt: -1 })
    .limit(2)
    .select('title updatedAt createdAt');
  
  // Get recent exhibitors
  const recentExhibitors = await Exhibitor.find({ isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(2)
    .select('companyName createdAt');
  
  // Get recent visitors
  const recentVisitors = await Visitor.find({ isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(2)
    .select('name createdAt');
  
  // Format activities
  recentEvents.forEach(event => {
    const isNew = event.createdAt.getTime() === event.updatedAt.getTime();
    activities.push({
      action: isNew ? `New event "${event.title}" was created` : `Event "${event.title}" was updated`,
      time: getTimeAgo(event.updatedAt),
      type: 'event'
    });
  });
  
  recentExhibitors.forEach(exhibitor => {
    activities.push({
      action: `New exhibitor "${exhibitor.companyName}" registered`,
      time: getTimeAgo(exhibitor.createdAt),
      type: 'exhibitor'
    });
  });
  
  recentVisitors.forEach(visitor => {
    activities.push({
      action: `New visitor "${visitor.name}" registered`,
      time: getTimeAgo(visitor.createdAt),
      type: 'visitor'
    });
  });
  
  // Sort by time and limit to 10
  activities.sort((a, b) => new Date(b.time) - new Date(a.time));
  
  successResponse(res, activities.slice(0, 10));
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

module.exports = {
  getOrganizerDashboardStats,
  getSuperAdminDashboardStats,
  getRecentActivity
};
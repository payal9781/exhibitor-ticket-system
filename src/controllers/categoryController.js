const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Category = require('../models/Category');

// Create a new category
const createCategory = asyncHandler(async (req, res) => {
  const { name, value, description, color, icon, order } = req.body;

  if (!name || !value) {
    return errorResponse(res, 'Name and value are required', 400);
  }

  // Check if category with same value already exists for this organizer
  const existingCategory = await Category.findOne({ 
    value: value.toLowerCase().trim(), 
    organizerId: req.user.id 
  });

  if (existingCategory) {
    return errorResponse(res, 'Category with this value already exists', 400);
  }

  const category = new Category({
    name: name.trim(),
    value: value.toLowerCase().trim(),
    description: description?.trim(),
    color: color || '#6B7280',
    icon: icon?.trim(),
    order: order || 0,
    organizerId: req.user.id
  });

  await category.save();
  successResponse(res, category, 201);
});

// Get all categories for the current organizer
const getCategories = asyncHandler(async (req, res) => {
  const { includeInactive = false, search, organizerId } = req.body;
  
  let query = {};
  
  // Handle different user types
  if (req.user.type === 'organizer') {
    query.organizerId = req.user.id;
  } else if (req.user.type === 'superadmin' && organizerId) {
    query.organizerId = organizerId;
  } else if (req.user.type === 'exhibitor' || req.user.type === 'visitor') {
    // For mobile users, get categories from their associated organizer
    // This requires the organizerId to be passed in the request
    if (organizerId) {
      query.organizerId = organizerId;
    } else {
      return errorResponse(res, 'Organizer ID is required for mobile users', 400);
    }
  } else if (req.user.type === 'superadmin') {
    // Superadmin can see all categories if no organizerId specified
    // query remains empty to get all categories
  } else {
    query.organizerId = req.user.id; // fallback
  }
  
  if (!includeInactive) {
    query.isActive = true;
  }

  if (search && search.trim()) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const categories = await Category.find(query)
    .sort({ order: 1, name: 1 });

  successResponse(res, {
    categories,
    total: categories.length
  });
});

// Get a single category by ID
const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.body;
  
  const category = await Category.findOne({ 
    _id: id, 
    organizerId: req.user.id 
  });

  if (!category) {
    return errorResponse(res, 'Category not found', 404);
  }

  successResponse(res, category);
});

// Update a category
const updateCategory = asyncHandler(async (req, res) => {
  const { id, name, value, description, color, icon, order, isActive } = req.body;

  if (!id) {
    return errorResponse(res, 'Category ID is required', 400);
  }

  const category = await Category.findOne({ 
    _id: id, 
    organizerId: req.user.id 
  });

  if (!category) {
    return errorResponse(res, 'Category not found', 404);
  }

  // Check if new value conflicts with existing category
  if (value && value.toLowerCase().trim() !== category.value) {
    const existingCategory = await Category.findOne({ 
      value: value.toLowerCase().trim(), 
      organizerId: req.user.id,
      _id: { $ne: id }
    });

    if (existingCategory) {
      return errorResponse(res, 'Category with this value already exists', 400);
    }
  }

  // Update fields
  if (name !== undefined) category.name = name.trim();
  if (value !== undefined) category.value = value.toLowerCase().trim();
  if (description !== undefined) category.description = description?.trim();
  if (color !== undefined) category.color = color;
  if (icon !== undefined) category.icon = icon?.trim();
  if (order !== undefined) category.order = order;
  if (isActive !== undefined) category.isActive = isActive;

  await category.save();
  successResponse(res, category);
});

// Delete a category
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return errorResponse(res, 'Category ID is required', 400);
  }

  const category = await Category.findOne({ 
    _id: id, 
    organizerId: req.user.id 
  });

  if (!category) {
    return errorResponse(res, 'Category not found', 404);
  }

  await Category.findByIdAndDelete(id);
  successResponse(res, { message: 'Category deleted successfully' });
});

// Bulk create default categories for new organizers
const createDefaultCategories = asyncHandler(async (req, res) => {
  const defaultCategories = [
    { name: 'Keynote', value: 'keynote', description: 'Main presentation or speech', color: '#DC2626', order: 1 },
    { name: 'Session', value: 'session', description: 'Regular session or talk', color: '#2563EB', order: 2 },
    { name: 'Workshop', value: 'workshop', description: 'Interactive workshop', color: '#7C3AED', order: 3 },
    { name: 'Panel Discussion', value: 'panel', description: 'Panel discussion with multiple speakers', color: '#059669', order: 4 },
    { name: 'Presentation', value: 'presentation', description: 'Standard presentation', color: '#0891B2', order: 5 },
    { name: 'Networking', value: 'networking', description: 'Networking session', color: '#EA580C', order: 6 },
    { name: 'Break', value: 'break', description: 'Coffee or tea break', color: '#65A30D', order: 7 },
    { name: 'Lunch', value: 'lunch', description: 'Lunch break', color: '#CA8A04', order: 8 },
    { name: 'Dinner', value: 'dinner', description: 'Dinner event', color: '#A21CAF', order: 9 },
    { name: 'Exhibition', value: 'exhibition', description: 'Exhibition or showcase', color: '#BE185D', order: 10 },
    { name: 'Demo', value: 'demo', description: 'Product or service demonstration', color: '#0D9488', order: 11 },
    { name: 'Q&A Session', value: 'qa', description: 'Question and answer session', color: '#7C2D12', order: 12 },
    { name: 'Awards Ceremony', value: 'awards', description: 'Awards and recognition ceremony', color: '#B91C1C', order: 13 },
    { name: 'Opening Ceremony', value: 'opening', description: 'Event opening ceremony', color: '#1D4ED8', order: 14 },
    { name: 'Closing Ceremony', value: 'closing', description: 'Event closing ceremony', color: '#6D28D9', order: 15 },
    { name: 'Other', value: 'other', description: 'Other activities', color: '#6B7280', order: 16 }
  ];

  const categoriesToCreate = [];
  
  for (const categoryData of defaultCategories) {
    const existingCategory = await Category.findOne({ 
      value: categoryData.value, 
      organizerId: req.user.id 
    });

    if (!existingCategory) {
      categoriesToCreate.push({
        ...categoryData,
        organizerId: req.user.id
      });
    }
  }

  if (categoriesToCreate.length > 0) {
    const createdCategories = await Category.insertMany(categoriesToCreate);
    successResponse(res, {
      message: `${createdCategories.length} default categories created`,
      categories: createdCategories
    });
  } else {
    successResponse(res, {
      message: 'All default categories already exist',
      categories: []
    });
  }
});

// Reorder categories
const reorderCategories = asyncHandler(async (req, res) => {
  const { categoryOrders } = req.body; // Array of { id, order }

  if (!categoryOrders || !Array.isArray(categoryOrders)) {
    return errorResponse(res, 'Category orders array is required', 400);
  }

  const updatePromises = categoryOrders.map(({ id, order }) => 
    Category.findOneAndUpdate(
      { _id: id, organizerId: req.user.id },
      { order },
      { new: true }
    )
  );

  const updatedCategories = await Promise.all(updatePromises);
  
  successResponse(res, {
    message: 'Categories reordered successfully',
    categories: updatedCategories.filter(cat => cat !== null)
  });
});

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  createDefaultCategories,
  reorderCategories
};
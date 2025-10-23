const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Category = require('../models/Category');

// Create a new category
const createCategory = asyncHandler(async (req, res) => {
  console.log('Creating category with data:', req.body);
  console.log('User context:', req.user);
  
  const { name, value, description, color, icon, order } = req.body;

  if (!name || !value) {
    return errorResponse(res, 'Name and value are required', 400);
  }

  if (!req.user || !req.user.id) {
    return errorResponse(res, 'User authentication required', 401);
  }

  try {
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

    console.log('Saving category:', category);
    const savedCategory = await category.save();
    console.log('Category saved successfully:', savedCategory);
    
    successResponse(res, savedCategory, 201);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 11000) {
      return errorResponse(res, 'Category with this value already exists', 400);
    }
    return errorResponse(res, 'Failed to create category: ' + error.message, 500);
  }
});

// Get all categories for the current organizer
const getCategories = asyncHandler(async (req, res) => {
  console.log('Getting categories with params:', req.body);
  console.log('User context:', req.user);
  
  const { includeInactive = false, search, organizerId } = req.body;
  
  if (!req.user || !req.user.id) {
    return errorResponse(res, 'User authentication required', 401);
  }
  
  let query = {};
  
  // Handle different user types
  if (req.user.type === 'organizer') {
    query.organizerId = req.user.id;
  } else if (req.user.type === 'superadmin') {
    // Superadmin can see all categories or filter by organizerId
    if (organizerId) {
      query.organizerId = organizerId;
    }
    // If no organizerId specified, query remains empty to get all categories
  } else if (req.user.type === 'exhibitor' || req.user.type === 'visitor') {
    // For mobile users, get categories from their associated organizer
    // This requires the organizerId to be passed in the request
    if (organizerId) {
      query.organizerId = organizerId;
    } else {
      return errorResponse(res, 'Organizer ID is required for mobile users', 400);
    }
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

  console.log('Query:', query);
  
  try {
    const categories = await Category.find(query)
      .sort({ order: 1, name: 1 });
    
    console.log('Found categories:', categories.length);
    successResponse(res, {
      categories,
      total: categories.length
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    return errorResponse(res, 'Failed to get categories: ' + error.message, 500);
  }
});

// Get a single category by ID
const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.body;
  
  if (!id) {
    return errorResponse(res, 'Category ID is required', 400);
  }

  let query = { _id: id };
  
  // Handle different user types
  if (req.user.type === 'organizer') {
    query.organizerId = req.user.id;
  } else if (req.user.type === 'superadmin') {
    // Superadmin can access any category
    // query remains as is
  } else {
    query.organizerId = req.user.id; // fallback
  }
  
  const category = await Category.findOne(query);

  if (!category) {
    return errorResponse(res, 'Category not found', 404);
  }

  successResponse(res, category);
});

// Update a category
const updateCategory = asyncHandler(async (req, res) => {
  console.log('Updating category with data:', req.body);
  console.log('User context:', req.user);
  
  const { id, name, value, description, color, icon, order, isActive } = req.body;

  if (!id) {
    return errorResponse(res, 'Category ID is required', 400);
  }

  if (!req.user || !req.user.id) {
    return errorResponse(res, 'User authentication required', 401);
  }

  let query = { _id: id };
  
  // Handle different user types
  if (req.user.type === 'organizer') {
    query.organizerId = req.user.id;
  } else if (req.user.type === 'superadmin') {
    // Superadmin can update any category
    // query remains as is
  } else {
    query.organizerId = req.user.id; // fallback
  }

  try {
    const category = await Category.findOne(query);

    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    // Check if new value conflicts with existing category
    if (value && value.toLowerCase().trim() !== category.value) {
      const existingCategory = await Category.findOne({ 
        value: value.toLowerCase().trim(), 
        organizerId: category.organizerId,
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

    const updatedCategory = await category.save();
    console.log('Category updated successfully:', updatedCategory);
    successResponse(res, updatedCategory);
  } catch (error) {
    console.error('Error updating category:', error);
    return errorResponse(res, 'Failed to update category: ' + error.message, 500);
  }
});

// Delete a category
const deleteCategory = asyncHandler(async (req, res) => {
  console.log('Deleting category with data:', req.body);
  console.log('User context:', req.user);
  
  const { id } = req.body;

  if (!id) {
    return errorResponse(res, 'Category ID is required', 400);
  }

  if (!req.user || !req.user.id) {
    return errorResponse(res, 'User authentication required', 401);
  }

  let query = { _id: id };
  
  // Handle different user types
  if (req.user.type === 'organizer') {
    query.organizerId = req.user.id;
  } else if (req.user.type === 'superadmin') {
    // Superadmin can delete any category
    // query remains as is
  } else {
    query.organizerId = req.user.id; // fallback
  }

  try {
    const category = await Category.findOne(query);

    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    await Category.findByIdAndDelete(id);
    console.log('Category deleted successfully:', id);
    successResponse(res, { message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    return errorResponse(res, 'Failed to delete category: ' + error.message, 500);
  }
});


// Reorder categories
const reorderCategories = asyncHandler(async (req, res) => {
  const { categoryOrders } = req.body; // Array of { id, order }

  if (!categoryOrders || !Array.isArray(categoryOrders)) {
    return errorResponse(res, 'Category orders array is required', 400);
  }

  const updatePromises = categoryOrders.map(({ id, order }) => {
    let query = { _id: id };
    
    // Handle different user types
    if (req.user.type === 'organizer') {
      query.organizerId = req.user.id;
    } else if (req.user.type === 'superadmin') {
      // Superadmin can reorder any category
      // query remains as is
    } else {
      query.organizerId = req.user.id; // fallback
    }
    
    return Category.findOneAndUpdate(
      query,
      { order },
      { new: true }
    );
  });

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
  reorderCategories
};
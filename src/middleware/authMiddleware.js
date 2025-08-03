const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler'); // Assume installed
const authMiddleware = (roles = []) => asyncHandler(async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    if (roles.length && !roles.includes(decoded.type)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});
module.exports = authMiddleware;
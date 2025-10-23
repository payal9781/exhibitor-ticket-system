const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler'); // Assume installed
const authMiddleware = (roles = []) => asyncHandler(async (req, res, next) => {
  console.log("Auth middleware called for roles:", roles);
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    console.log("No token provided");
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("Token decoded successfully:", decoded);
    req.user = decoded;
    
    if (roles.length && !roles.includes(decoded.type)) {
      console.log("Access denied for role:", decoded.type, "Required:", roles);
      return res.status(403).json({ message: 'Access denied' });
    }
    
    console.log("Authentication successful, proceeding to next middleware");
    next();
  } catch (err) {
    console.log("Token verification failed:", err.message);
    res.status(401).json({ message: 'Invalid token' });
  }
});
module.exports = authMiddleware;
const successResponse = (res, data, status = 200) => res.status(status).json({ success: true, data });
const errorResponse = (res, message, status = 400) => {
    console.log(message);
    res.status(status).json({ success: false, message })
};

// Response object with methods for compatibility
const response = {
  success: (message, data, res, status = 200) => {
    return res.status(status).json({ success: true, message, data });
  },
  error: (message, res, status = 400) => {
    console.log(message);
    return res.status(status).json({ success: false, message });
  },
  badRequest: (message, res) => {
    return res.status(400).json({ success: false, message });
  },
  notFound: (message, res) => {
    return res.status(404).json({ success: false, message });
  },
  unauthorized: (message, res) => {
    return res.status(401).json({ success: false, message });
  },
  forbidden: (message, res) => {
    return res.status(403).json({ success: false, message });
  },
  serverError: (message, res) => {
    return res.status(500).json({ success: false, message });
  }
};

module.exports = { successResponse, errorResponse, response };
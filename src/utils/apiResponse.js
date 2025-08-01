const response = {
  success: (message, data, res) => {
    res.status(200).json({
      success: true,
      message,
      data
    });
  },
  create: (message, data, res) => {
    res.status(201).json({
      success: true,
      message,
      data
    });
  },
  badRequest: (message, res) => {
    res.status(400).json({
      success: false,
      message
    });
  },
  unauthorized: (message, res) => {
    res.status(401).json({
      success: false,
      message
    });
  },
  forbidden: (message, res) => {
    res.status(403).json({
      success: false,
      message
    });
  },
  notFound: (message, res) => {
    res.status(404).json({
      success: false,
      message
    });
  },
  conflict: (message, res) => {
    res.status(409).json({
      success: false,
      message
    });
  },
  error: (message, res) => {
    res.status(500).json({
      success: false,
      message
    });
  }
};

module.exports = { response };
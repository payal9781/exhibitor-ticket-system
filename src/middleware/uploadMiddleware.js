const upload = require('../config/multerConfig');
const uploadMiddleware = (fieldName) => upload.single(fieldName);
module.exports = uploadMiddleware;
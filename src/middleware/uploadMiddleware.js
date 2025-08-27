const upload = require('../config/multerConfig').upload;
const uploadMiddleware = (fieldName) => upload('uploads').single(fieldName);
module.exports = uploadMiddleware;
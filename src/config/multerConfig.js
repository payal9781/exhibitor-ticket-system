const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v1: uuidv1 } = require('uuid');

exports.upload = (folderPath) => {
  try {
    // Ensure folder exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    let storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, folderPath);
      },
      filename: function (req, file, cb) {
        cb(null, uuidv1() + path.extname(file.originalname));
      }
    });
    return multer({ storage: storage });
  } catch (err) {
    console.log(err);
    throw err; // Let the error handler catch this
  }
};
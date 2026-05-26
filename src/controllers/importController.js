const {
  bulkImportExhibitors,
  bulkImportVisitors,
  bulkImportOrganizers,
} = require('../services/bulkImportService');

const importExhibitors = async (req, res) => {
  try {
    const { rows, eventId } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows to import' });
    }
    if (rows.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum 500 rows per import' });
    }
    const data = await bulkImportExhibitors(req.user, { rows, eventId });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('importExhibitors error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Import failed',
    });
  }
};

const importVisitors = async (req, res) => {
  try {
    const { rows, eventId } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows to import' });
    }
    if (rows.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum 500 rows per import' });
    }
    const data = await bulkImportVisitors(req.user, { rows, eventId });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('importVisitors error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Import failed',
    });
  }
};

const importOrganizers = async (req, res) => {
  try {
    const { rows, defaultPassword } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows to import' });
    }
    if (rows.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum 500 rows per import' });
    }
    const data = await bulkImportOrganizers({ rows, defaultPassword });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('importOrganizers error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Import failed',
    });
  }
};

module.exports = {
  importExhibitors,
  importVisitors,
  importOrganizers,
};

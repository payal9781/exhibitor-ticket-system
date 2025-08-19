require('dotenv').config();
const connectDB = require('./config/database');
// connectDB();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const errorMiddleware = require('./middleware/errorMiddleware');
const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./swagger');
// CORS configuration
app.use(cors({}));
app.set('etag',false);
// Set up EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve React's index.html at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Registration page routes
app.get('/register/:registrationLink', async (req, res) => {
  try {
    const { registrationLink } = req.params;
    const Event = require('./models/Event');
    const event = await Event.findOne({
      registrationLink,
      isDeleted: false
    }).populate('organizerId', 'name email organizationName');
    if (!event) {
      return res.status(404).render('error', {
        title: 'Event Not Found',
        message: 'The registration link is invalid or the event no longer exists.',
        error: 'Event not found'
      });
    }
    // Check if event registration is still valid (before event start date)
    const currentDate = new Date();
    const eventStartDate = new Date(event.fromDate);
    if (currentDate > eventStartDate) {
      return res.status(400).render('error', {
        title: 'Registration Closed',
        message: 'Registration for this event has closed. The event has already started.',
        error: 'Registration closed'
      });
    }
    res.render('registration', { event });
  } catch (error) {
    console.error('Error loading registration page:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while loading the registration page.',
      error: error.message
    });
  }
});

// API routes
app.use('/api/v1', require('./routes/index'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.get('*', (req, res) => {
  // Avoid redirecting API routes
  if (!req.originalUrl.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ message: 'API route not found' });
  }
});
// Error middleware
app.use(errorMiddleware);

// Start the server
const PORT = process.env.PORT || 9900;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
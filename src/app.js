require('dotenv').config();
const connectDB = require('./config/database');
// connectDB();
const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const app = express();
const errorMiddleware = require('./middleware/errorMiddleware');
const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./swagger');

// CORS configuration
app.use(cors({}));
app.set('etag', false);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../Uploads')));

// Morgan logging configuration
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
  morgan.token('body', (req) => JSON.stringify(req.body));
  app.use(morgan(':method :url :status :response-time ms - :body'));
}

// Set up EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Registration page route
app.get('/register/:registrationLink', async (req, res) => {
  try {
    const { registrationLink } = req.params;
    const Event = require('./models/Event');
    const event = await Event.findOne({
      registrationLink,
      isDeleted: false,
    }).populate('organizerId', 'name email organizationName');
    if (!event) {
      return res.status(404).render('error', {
        title: 'Event Not Found',
        message: 'The registration link is invalid or the event no longer exists.',
        error: 'Event not found',
      });
    }
    const currentDate = new Date();
    const eventToDate = new Date(event.toDate);
    if (currentDate > eventToDate) {
      return res.status(400).render('error', {
        title: 'Registration Closed',
        message: 'Registration for this event has closed. The event has already started.',
        error: 'Registration closed',
      });
    }
    res.render('registration', { event });
  } catch (error) {
    console.error('Error loading registration page:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while loading the registration page.',
      error: error.message,
    });
  }
});

// API routes
app.use('/api/v1', require('./routes/index'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Exhibitor Ticket System API' });
});

// Catch-all for 404
app.get('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error middleware
app.use(errorMiddleware);

// Start the server
const PORT = process.env.PORT || 9900;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
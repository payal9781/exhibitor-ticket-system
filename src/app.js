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
const { sendNotification } = require('./utils/fcmToken_notification');
// CORS configuration
app.use(cors({}));
app.set('etag', false);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/', express.static(path.join(__dirname, 'public')));

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
    // Check if event registration is still valid (before event end date)
    const currentDate = new Date();
    const eventEndDate = new Date(event.toDate);
    if (currentDate > eventEndDate) {
      return res.status(400).render('error', {
        title: 'Registration Closed',
        message: 'Registration for this event has closed. The event has already ended.',
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


app.post('/send-notification', async (req, res) => {
  try {
    const { fcmToken, title, body, data } = req.body;

    // Validate required fields
    if (!fcmToken || !title || !body) {
      return res.status(400).json({
        message: 'Missing required fields: fcmToken, title, and body are required'
      });
    }

    // Prepare messages array for sendNotification function
    const messages = [title, body, data || {}];

    // Send notification using the provided function
    const result = await sendNotification(fcmToken, messages);

    // Return response based on notification result
    if (result.message === 'send successfull') {
      return res.status(200).json({
        message: 'Notification sent successfully',
        data: result.send
      });
    } else {
      return res.status(500).json({
        message: 'Failed to send notification',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in send-notification API:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
});


// Start the server
const PORT = process.env.PORT || 9900;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
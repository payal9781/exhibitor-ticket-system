// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const errorMiddleware = require('./middleware/errorMiddleware');
const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./swagger');

// CORS configuration
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Set up EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Registration page routes (before API routes)
app.get('/register/:registrationLink', async (req, res) => {
  try {
    const { registrationLink } = req.params;
    const Event = require('./models/Event');
    
    const event = await Event.findOne({ 
      registrationLink, 
      isDeleted: false 
    }).populate('organizerId', 'name email companyName');
    
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

app.use('/api/v1', require('./routes/index'));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
app.use(errorMiddleware);

module.exports = app;
// src/swagger.js
const swaggerDoc = {
  openapi: '3.0.0',
  info: {
    title: 'Event Management API',
    version: '1.0.0',
    description: 'API documentation for the event management system',
  },
  servers: [
    {
      url: 'http://localhost:5000/api/v1',
    },
  ],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new user (OTP for exhibitor/visitor, password for others)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['organizer', 'superAdmin', 'exhibitor', 'visitor'] },
                  email: { type: 'string' },
                  password: { type: 'string' },
                  phone: { type: 'string' },
                  // Add other fields as per schema
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User registered' },
          400: { description: 'Invalid role or data' },
        },
      },
    },
    '/auth/send-otp': {
      post: {
        summary: 'Send OTP for exhibitor/visitor login/registration',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['exhibitor', 'visitor'] },
                  phone: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'OTP sent' },
          400: { description: 'Invalid role' },
          404: { description: 'User not found' },
        },
      },
    },
    '/auth/verify-otp': {
      post: {
        summary: 'Verify OTP and login (optionally register for event)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['exhibitor', 'visitor'] },
                  userId: { type: 'string' },
                  otp: { type: 'string' },
                  eventId: { type: 'string' },
                  details: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'OTP verified, user logged in' },
          400: { description: 'Invalid OTP or data' },
          404: { description: 'User or event not found' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login organizer or superadmin with password',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['organizer', 'superAdmin'] },
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Logged in' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Logout user (client-side token removal)',
        responses: {
          200: { description: 'Logged out' },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    '/events/create': {
      post: {
        summary: 'Create a new event',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  fromDate: { type: 'string', format: 'date-time' },
                  toDate: { type: 'string', format: 'date-time' },
                  startTime: { type: 'string', format: 'date-time' },
                  endTime: { type: 'string', format: 'date-time' },
                  location: { type: 'string' },
                  // Add other fields
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Event created' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/events/list': {
      post: {
        summary: 'List events (organizer-wise for superadmin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  organizerId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Events listed' },
        },
      },
    },
    '/events/get': {
      post: {
        summary: 'Get event by ID',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Event details' },
          404: { description: 'Event not found' },
        },
      },
    },
    '/events/update': {
      post: {
        summary: 'Update event by ID',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  // Update fields
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Event updated' },
          404: { description: 'Event not found' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/events/delete': {
      post: {
        summary: 'Delete event by ID (soft delete)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Event deleted' },
          404: { description: 'Event not found' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/events/register': {
      post: {
        summary: 'Register user for event',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  userId: { type: 'string' },
                  userType: { type: 'string', enum: ['exhibitor', 'visitor'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Registered, QR generated' },
          404: { description: 'Event not found' },
          400: { description: 'Invalid data' },
        },
      },
    },
    '/organizers/create': {
      post: {
        summary: 'Create organizer (superadmin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  // Other fields
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Organizer created' },
        },
      },
    },
    '/organizers/list': {
      post: {
        summary: 'List organizers (superadmin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Organizers listed' },
        },
      },
    },
    '/organizers/get': {
      post: {
        summary: 'Get organizer by ID (superadmin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Organizer details' },
          404: { description: 'Organizer not found' },
        },
      },
    },
    '/organizers/update': {
      post: {
        summary: 'Update organizer by ID (superadmin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  // Update fields
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Organizer updated' },
          404: { description: 'Organizer not found' },
        },
      },
    },
    '/organizers/delete': {
      post: {
        summary: 'Delete organizer by ID (soft delete, superadmin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Organizer deleted' },
          404: { description: 'Organizer not found' },
        },
      },
    },
    '/exhibitors/create': {
      post: {
        summary: 'Create exhibitor (organizer/superadmin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  // Other fields
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Exhibitor created' },
        },
      },
    },
    '/exhibitors/list': {
      post: {
        summary: 'List exhibitors (organizer/superadmin)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Exhibitors listed' },
        },
      },
    },
    '/exhibitors/get': {
      post: {
        summary: 'Get exhibitor by ID (organizer/superadmin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor details' },
          404: { description: 'Exhibitor not found' },
        },
      },
    },
    '/exhibitors/update': {
      post: {
        summary: 'Update exhibitor by ID (organizer/superadmin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  // Update fields
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor updated' },
          404: { description: 'Exhibitor not found' },
        },
      },
    },
    '/exhibitors/delete': {
      post: {
        summary: 'Delete exhibitor by ID (soft delete, organizer/superadmin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor deleted' },
          404: { description: 'Exhibitor not found' },
        },
      },
    },
    '/exhibitors/organizers-event-wise': {
      post: {
        summary: 'Get organizers event-wise (exhibitor/visitor)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Organizers event-wise' },
        },
      },
    },
    '/exhibitors/events-organizer-wise': {
      post: {
        summary: 'Get events organizer-wise (exhibitor/visitor)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  organizerId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Events organizer-wise' },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    '/exhibitors/participants-event-wise': {
      post: {
        summary: 'Get participants event-wise (exhibitor/visitor)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  type: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Participants event-wise' },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    '/exhibitors/user-details': {
      post: {
        summary: 'Get user details (exhibitor/visitor)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  userType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User details' },
          404: { description: 'User not found' },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    '/visitors/create': {
      post: {
        summary: 'Create visitor (organizer/superadmin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  // Other fields
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Visitor created' },
        },
      },
    },
    '/visitors/list': {
      post: {
        summary: 'List visitors (organizer/superadmin)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Visitors listed' },
        },
      },
    },
    '/visitors/get': {
      post: {
        summary: 'Get visitor by ID (organizer/superadmin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor details' },
          404: { description: 'Visitor not found' },
        },
      },
    },
    '/visitors/update': {
      post: {
        summary: 'Update visitor by ID (organizer/superadmin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  // Update fields
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor updated' },
          404: { description: 'Visitor not found' },
        },
      },
    },
    '/visitors/delete': {
      post: {
        summary: 'Delete visitor by ID (soft delete, organizer/superadmin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor deleted' },
          404: { description: 'Visitor not found' },
        },
      },
    },
    '/visitors/organizers-event-wise': {
      post: {
        summary: 'Get organizers event-wise (exhibitor/visitor)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Organizers event-wise' },
        },
      },
    },
    '/visitors/events-organizer-wise': {
      post: {
        summary: 'Get events organizer-wise (exhibitor/visitor)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  organizerId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Events organizer-wise' },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    '/visitors/participants-event-wise': {
      post: {
        summary: 'Get participants event-wise (exhibitor/visitor)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  type: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Participants event-wise' },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    '/visitors/user-details': {
      post: {
        summary: 'Get user details (exhibitor/visitor)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  userType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User details' },
          404: { description: 'User not found' },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    '/attendance/mark': {
      post: {
        summary: 'Mark attendance via QR scan (organizer)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  userId: { type: 'string' },
                  role: { type: 'string', enum: ['visitor', 'exhibitor'] },
                  startDate: { type: 'string', format: 'date-time' },
                  endDate: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Attendance marked' },
          400: { description: 'Invalid data' },
          404: { description: 'Event or user not found' },
        },
      },
    },
    '/meetings/toggle': {
      post: {
        summary: 'Toggle show slots (exhibitor/visitor)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  show: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Toggle updated' },
          404: { description: 'Slots not found' },
        },
      },
    },
    '/meetings/slots': {
      post: {
        summary: 'Get user slots (exhibitor/visitor)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  targetUserId: { type: 'string' },
                  targetUserType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Available slots' },
          403: { description: 'Slots hidden' },
          404: { description: 'Slots not found' },
        },
      },
    },
    '/meetings/request': {
      post: {
        summary: 'Request meeting (exhibitor/visitor)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  requesteeId: { type: 'string' },
                  requesteeType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                  slotStart: { type: 'string', format: 'date-time' },
                  slotEnd: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Meeting requested' },
          400: { description: 'Slot not available' },
          404: { description: 'Slots not found' },
        },
      },
    },
    '/meetings/respond': {
      post: {
        summary: 'Respond to meeting request (exhibitor/visitor)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  meetingId: { type: 'string' },
                  status: { type: 'string', enum: ['accepted', 'rejected'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Meeting responded' },
          404: { description: 'Invalid meeting' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

module.exports = swaggerDoc;
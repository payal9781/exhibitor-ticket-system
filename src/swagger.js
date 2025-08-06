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
    // Authentication Routes
    '/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Authentication'],
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
                  name: { type: 'string' },
                  company: { type: 'string' },
                },
                required: ['role', 'email']
              },
            },
          },
        },
        responses: {
          201: { description: 'User registered successfully' },
          400: { description: 'Invalid role or data' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login with email and password',
        tags: ['Authentication'],
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
                required: ['role', 'email', 'password']
              },
            },
          },
        },
        responses: {
          200: { description: 'Logged in successfully' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/login-app': {
      post: {
        summary: 'Login for mobile app',
        tags: ['Authentication'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['exhibitor', 'visitor'] },
                  phone: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Logout user',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Logged out successfully' },
        },
      },
    },
    '/auth/otp/send': {
      post: {
        summary: 'Send OTP for verification',
        tags: ['Authentication'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  phone: { type: 'string' },
                  role: { type: 'string', enum: ['exhibitor', 'visitor'] },
                },
                required: ['phone', 'role']
              },
            },
          },
        },
        responses: {
          200: { description: 'OTP sent successfully' },
          400: { description: 'Invalid phone number or role' },
        },
      },
    },
    '/auth/otp/verify': {
      post: {
        summary: 'Verify OTP',
        tags: ['Authentication'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  phone: { type: 'string' },
                  otp: { type: 'string' },
                  role: { type: 'string', enum: ['exhibitor', 'visitor'] },
                },
                required: ['phone', 'otp', 'role']
              },
            },
          },
        },
        responses: {
          200: { description: 'OTP verified successfully' },
          400: { description: 'Invalid OTP' },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        summary: 'Request password reset',
        tags: ['Authentication'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                },
                required: ['email']
              },
            },
          },
        },
        responses: {
          200: { description: 'Password reset email sent' },
          404: { description: 'User not found' },
        },
      },
    },
    '/auth/verify-reset-token': {
      post: {
        summary: 'Verify password reset token',
        tags: ['Authentication'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string' },
                },
                required: ['token']
              },
            },
          },
        },
        responses: {
          200: { description: 'Token verified' },
          400: { description: 'Invalid or expired token' },
        },
      },
    },
    '/auth/verify-reset-token/{token}': {
      get: {
        summary: 'Verify password reset token via GET',
        tags: ['Authentication'],
        parameters: [
          {
            name: 'token',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          200: { description: 'Token verified' },
          400: { description: 'Invalid or expired token' },
        },
      },
    },
    '/auth/reset-password/{token}': {
      get: {
        summary: 'Reset password page',
        tags: ['Authentication'],
        parameters: [
          {
            name: 'token',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          200: { description: 'Reset password page' },
          400: { description: 'Invalid or expired token' },
        },
      },
    },
    // Event Management Routes
    '/events/create': {
      post: {
        summary: 'Create a new event',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'multipart/form-data': {
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
                  media: { type: 'string', format: 'binary' },
                },
                required: ['title', 'fromDate', 'toDate']
              },
            },
          },
        },
        responses: {
          201: { description: 'Event created successfully' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/events/list': {
      post: {
        summary: 'List events',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  organizerId: { type: 'string' },
                  page: { type: 'number' },
                  limit: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Events listed successfully' },
        },
      },
    },
    '/events/get': {
      post: {
        summary: 'Get event by ID',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Event details retrieved' },
          404: { description: 'Event not found' },
        },
      },
    },
    '/events/update': {
      post: {
        summary: 'Update event by ID',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  fromDate: { type: 'string', format: 'date-time' },
                  toDate: { type: 'string', format: 'date-time' },
                  location: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Event updated successfully' },
          404: { description: 'Event not found' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/events/delete': {
      post: {
        summary: 'Delete event by ID (soft delete)',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Event deleted successfully' },
          404: { description: 'Event not found' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/events/register': {
      post: {
        summary: 'Register user for event',
        tags: ['Events'],
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
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Registered successfully, QR generated' },
          404: { description: 'Event not found' },
          400: { description: 'Invalid data' },
        },
      },
    },
    '/events/stats': {
      post: {
        summary: 'Get event statistics',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Event statistics retrieved' },
        },
      },
    },
    '/events/upcoming': {
      post: {
        summary: 'Get upcoming events',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Upcoming events retrieved' },
        },
      },
    },
    '/events/all-participants': {
      post: {
        summary: 'Get all participants for events',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'All participants retrieved' },
        },
      },
    },
    '/events/add-participant': {
      post: {
        summary: 'Add participant to event',
        tags: ['Events'],
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
                required: ['eventId', 'userId', 'userType']
              },
            },
          },
        },
        responses: {
          200: { description: 'Participant added successfully' },
        },
      },
    },
    '/events/participants': {
      post: {
        summary: 'Get event participants',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Event participants retrieved' },
        },
      },
    },
    '/events/update-status': {
      post: {
        summary: 'Update event status',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  status: { type: 'string', enum: ['active', 'inactive', 'cancelled'] },
                },
                required: ['eventId', 'status']
              },
            },
          },
        },
        responses: {
          200: { description: 'Event status updated' },
        },
      },
    },
    '/events/status-stats': {
      post: {
        summary: 'Get event status statistics',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Event status statistics retrieved' },
        },
      },
    },
    '/events/available-participants': {
      post: {
        summary: 'Get available participants for event',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  userType: { type: 'string', enum: ['exhibitor', 'visitor'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Available participants retrieved' },
        },
      },
    },
    '/events/add-participant-comprehensive': {
      post: {
        summary: 'Add participant to event (comprehensive)',
        tags: ['Events'],
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
                required: ['eventId', 'userId', 'userType']
              },
            },
          },
        },
        responses: {
          200: { description: 'Participant added comprehensively' },
        },
      },
    },
    '/events/add-multiple-participants': {
      post: {
        summary: 'Add multiple participants to event',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  participants: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        userId: { type: 'string' },
                        userType: { type: 'string', enum: ['exhibitor', 'visitor'] },
                      }
                    }
                  },
                },
                required: ['eventId', 'participants']
              },
            },
          },
        },
        responses: {
          200: { description: 'Multiple participants added successfully' },
        },
      },
    },
    '/events/remove-participant': {
      post: {
        summary: 'Remove participant from event',
        tags: ['Events'],
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
                required: ['eventId', 'userId', 'userType']
              },
            },
          },
        },
        responses: {
          200: { description: 'Participant removed successfully' },
        },
      },
    },
    '/events/scan-qr-attendance': {
      post: {
        summary: 'Scan QR code for attendance',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  qrData: { type: 'string' },
                  eventId: { type: 'string' },
                },
                required: ['qrData', 'eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'QR scanned and attendance marked' },
        },
      },
    },
    '/events/attendance-stats': {
      post: {
        summary: 'Get attendance statistics for event',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Attendance statistics retrieved' },
        },
      },
    },
    // Organizer Management Routes
    '/organizers/create': {
      post: {
        summary: 'Create organizer (superadmin only)',
        tags: ['Organizers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  company: { type: 'string' },
                },
                required: ['email', 'password', 'name']
              },
            },
          },
        },
        responses: {
          201: { description: 'Organizer created successfully' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/organizers/list': {
      post: {
        summary: 'List organizers (superadmin only)',
        tags: ['Organizers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Organizers listed successfully' },
        },
      },
    },
    '/organizers/get': {
      post: {
        summary: 'Get organizer by ID (superadmin only)',
        tags: ['Organizers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Organizer details retrieved' },
          404: { description: 'Organizer not found' },
        },
      },
    },
    '/organizers/update': {
      post: {
        summary: 'Update organizer by ID (superadmin only)',
        tags: ['Organizers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  company: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Organizer updated successfully' },
          404: { description: 'Organizer not found' },
        },
      },
    },
    '/organizers/delete': {
      post: {
        summary: 'Delete organizer by ID (soft delete, superadmin only)',
        tags: ['Organizers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Organizer deleted successfully' },
          404: { description: 'Organizer not found' },
        },
      },
    },
    // Exhibitor Management Routes
    '/exhibitors/create': {
      post: {
        summary: 'Create exhibitor (organizer/superadmin)',
        tags: ['Exhibitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  name: { type: 'string' },
                  company: { type: 'string' },
                  designation: { type: 'string' },
                },
                required: ['email', 'phone', 'name']
              },
            },
          },
        },
        responses: {
          201: { description: 'Exhibitor created successfully' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/exhibitors/list': {
      post: {
        summary: 'List exhibitors (organizer/superadmin)',
        tags: ['Exhibitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  eventId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitors listed successfully' },
        },
      },
    },
    '/exhibitors/get': {
      post: {
        summary: 'Get exhibitor by ID (organizer/superadmin)',
        tags: ['Exhibitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor details retrieved' },
          404: { description: 'Exhibitor not found' },
        },
      },
    },
    '/exhibitors/update': {
      post: {
        summary: 'Update exhibitor by ID (organizer/superadmin)',
        tags: ['Exhibitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  company: { type: 'string' },
                  designation: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor updated successfully' },
          404: { description: 'Exhibitor not found' },
        },
      },
    },
    '/exhibitors/delete': {
      post: {
        summary: 'Delete exhibitor by ID (soft delete, organizer/superadmin)',
        tags: ['Exhibitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor deleted successfully' },
          404: { description: 'Exhibitor not found' },
        },
      },
    },
    '/exhibitors/organizers-event-wise': {
      post: {
        summary: 'Get organizers event-wise (exhibitor/visitor)',
        tags: ['Exhibitors'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Organizers event-wise retrieved' },
        },
      },
    },
    '/exhibitors/events-organizer-wise': {
      post: {
        summary: 'Get events organizer-wise (exhibitor/visitor)',
        tags: ['Exhibitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  organizerId: { type: 'string' },
                },
                required: ['organizerId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Events organizer-wise retrieved' },
        },
      },
    },
    '/exhibitors/participants-event-wise': {
      post: {
        summary: 'Get participants event-wise (exhibitor/visitor)',
        tags: ['Exhibitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  type: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Participants event-wise retrieved' },
        },
      },
    },
    '/exhibitors/user-details': {
      post: {
        summary: 'Get user details (exhibitor/visitor)',
        tags: ['Exhibitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  userType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
                required: ['userId', 'userType']
              },
            },
          },
        },
        responses: {
          200: { description: 'User details retrieved' },
          404: { description: 'User not found' },
        },
      },
    },
    // Visitor Management Routes
    '/visitors/create': {
      post: {
        summary: 'Create visitor (organizer/superadmin)',
        tags: ['Visitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  name: { type: 'string' },
                  company: { type: 'string' },
                  designation: { type: 'string' },
                },
                required: ['email', 'phone', 'name']
              },
            },
          },
        },
        responses: {
          201: { description: 'Visitor created successfully' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/visitors/list': {
      post: {
        summary: 'List visitors (organizer/superadmin)',
        tags: ['Visitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  eventId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitors listed successfully' },
        },
      },
    },
    '/visitors/get': {
      post: {
        summary: 'Get visitor by ID (organizer/superadmin)',
        tags: ['Visitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor details retrieved' },
          404: { description: 'Visitor not found' },
        },
      },
    },
    '/visitors/update': {
      post: {
        summary: 'Update visitor by ID (organizer/superadmin)',
        tags: ['Visitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  company: { type: 'string' },
                  designation: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor updated successfully' },
          404: { description: 'Visitor not found' },
        },
      },
    },
    '/visitors/delete': {
      post: {
        summary: 'Delete visitor by ID (soft delete, organizer/superadmin)',
        tags: ['Visitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                required: ['id']
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor deleted successfully' },
          404: { description: 'Visitor not found' },
        },
      },
    },
    '/visitors/organizers-event-wise': {
      post: {
        summary: 'Get organizers event-wise (exhibitor/visitor)',
        tags: ['Visitors'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Organizers event-wise retrieved' },
        },
      },
    },
    '/visitors/events-organizer-wise': {
      post: {
        summary: 'Get events organizer-wise (exhibitor/visitor)',
        tags: ['Visitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  organizerId: { type: 'string' },
                },
                required: ['organizerId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Events organizer-wise retrieved' },
        },
      },
    },
    '/visitors/participants-event-wise': {
      post: {
        summary: 'Get participants event-wise (exhibitor/visitor)',
        tags: ['Visitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  type: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Participants event-wise retrieved' },
        },
      },
    },
    '/visitors/user-details': {
      post: {
        summary: 'Get user details (exhibitor/visitor)',
        tags: ['Visitors'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  userType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
                required: ['userId', 'userType']
              },
            },
          },
        },
        responses: {
          200: { description: 'User details retrieved' },
          404: { description: 'User not found' },
        },
      },
    },
    // Dashboard Routes
    '/dashboard/organizer-stats': {
      get: {
        summary: 'Get organizer dashboard statistics',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Organizer dashboard statistics retrieved' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/dashboard/super-admin-stats': {
      get: {
        summary: 'Get super admin dashboard statistics',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Super admin dashboard statistics retrieved' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/dashboard/recent-activity': {
      get: {
        summary: 'Get recent activity',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Recent activity retrieved' },
        },
      },
    },
    '/dashboard/attendee-overview': {
      get: {
        summary: 'Get attendee overview for organizer',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Attendee overview retrieved' },
          403: { description: 'Access denied' },
        },
      },
    },

    // Attendance Routes
    '/attendance/mark': {
      post: {
        summary: 'Mark attendance via QR scan (organizer)',
        tags: ['Attendance'],
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
                required: ['eventId', 'userId', 'role']
              },
            },
          },
        },
        responses: {
          200: { description: 'Attendance marked successfully' },
          400: { description: 'Invalid data' },
          404: { description: 'Event or user not found' },
        },
      },
    },
    '/attendance/records': {
      post: {
        summary: 'Get attendance records',
        tags: ['Attendance'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  userId: { type: 'string' },
                  startDate: { type: 'string', format: 'date' },
                  endDate: { type: 'string', format: 'date' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Attendance records retrieved' },
        },
      },
    },
    '/attendance/statistics': {
      post: {
        summary: 'Get attendance statistics',
        tags: ['Attendance'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Attendance statistics retrieved' },
        },
      },
    },
    '/attendance/check-in': {
      post: {
        summary: 'Check in user',
        tags: ['Attendance'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  userId: { type: 'string' },
                  userType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
                required: ['eventId', 'userId', 'userType']
              },
            },
          },
        },
        responses: {
          200: { description: 'User checked in successfully' },
        },
      },
    },
    '/attendance/check-out': {
      post: {
        summary: 'Check out user',
        tags: ['Attendance'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  userId: { type: 'string' },
                  userType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
                required: ['eventId', 'userId', 'userType']
              },
            },
          },
        },
        responses: {
          200: { description: 'User checked out successfully' },
        },
      },
    },
    // Meeting Routes
    '/meetings/toggle': {
      post: {
        summary: 'Toggle show slots (exhibitor/visitor)',
        tags: ['Meetings'],
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
                required: ['eventId', 'show']
              },
            },
          },
        },
        responses: {
          200: { description: 'Toggle updated successfully' },
          404: { description: 'Slots not found' },
        },
      },
    },
    '/meetings/slots': {
      post: {
        summary: 'Get user slots (exhibitor/visitor)',
        tags: ['Meetings'],
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
                required: ['eventId', 'targetUserId', 'targetUserType']
              },
            },
          },
        },
        responses: {
          200: { description: 'Available slots retrieved' },
          403: { description: 'Slots hidden' },
          404: { description: 'Slots not found' },
        },
      },
    },
    '/meetings/request': {
      post: {
        summary: 'Request meeting (exhibitor/visitor)',
        tags: ['Meetings'],
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
                required: ['eventId', 'requesteeId', 'requesteeType', 'slotStart', 'slotEnd']
              },
            },
          },
        },
        responses: {
          201: { description: 'Meeting requested successfully' },
          400: { description: 'Slot not available' },
          404: { description: 'Slots not found' },
        },
      },
    },
    '/meetings/respond': {
      post: {
        summary: 'Respond to meeting request (exhibitor/visitor)',
        tags: ['Meetings'],
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
                required: ['meetingId', 'status']
              },
            },
          },
        },
        responses: {
          200: { description: 'Meeting responded successfully' },
          404: { description: 'Invalid meeting' },
        },
      },
    },
    '/meetings/by-date': {
      post: {
        summary: 'Get user meetings by date',
        tags: ['Meetings'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  date: { type: 'string', format: 'date' },
                },
                required: ['eventId', 'date']
              },
            },
          },
        },
        responses: {
          200: { description: 'Meetings by date retrieved' },
        },
      },
    },
    '/meetings/cancel': {
      post: {
        summary: 'Cancel meeting',
        tags: ['Meetings'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  meetingId: { type: 'string' },
                },
                required: ['meetingId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Meeting cancelled successfully' },
          404: { description: 'Meeting not found' },
        },
      },
    },
    // Mobile App Routes
    '/mobile/dashboard': {
      post: {
        summary: 'Get mobile dashboard data',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Mobile dashboard data retrieved' },
        },
      },
    },
    '/mobile/total-connections': {
      post: {
        summary: 'Get total connections for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Total connections retrieved' },
        },
      },
    },
    '/mobile/event-connections': {
      post: {
        summary: 'Get event connections for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Event connections retrieved' },
        },
      },
    },
    '/mobile/my-registered-events': {
      post: {
        summary: 'Get my registered events for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Registered events retrieved' },
        },
      },
    },
    '/mobile/attended-events': {
      post: {
        summary: 'Get attended events for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Attended events retrieved' },
        },
      },
    },
    '/mobile/record-scan': {
      post: {
        summary: 'Record scan for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  scannedUserId: { type: 'string' },
                  scannedUserType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                  eventId: { type: 'string' },
                },
                required: ['scannedUserId', 'scannedUserType', 'eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Scan recorded successfully' },
        },
      },
    },
    '/mobile/scan-statistics': {
      post: {
        summary: 'Get scan statistics for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Scan statistics retrieved' },
        },
      },
    },
    '/mobile/my-profile': {
      post: {
        summary: 'Get my profile for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Profile retrieved' },
        },
      },
    },
    '/mobile/update-profile': {
      post: {
        summary: 'Update my profile for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  company: { type: 'string' },
                  designation: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profile updated successfully' },
        },
      },
    },
    '/mobile/scanned-user-slots': {
      post: {
        summary: 'Get scanned user slots for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  scannedUserId: { type: 'string' },
                  scannedUserType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                  eventId: { type: 'string' },
                },
                required: ['scannedUserId', 'scannedUserType', 'eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Scanned user slots retrieved' },
        },
      },
    },
    '/mobile/send-meeting-request': {
      post: {
        summary: 'Send meeting request for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  requesteeId: { type: 'string' },
                  requesteeType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                  eventId: { type: 'string' },
                  slotStart: { type: 'string', format: 'date-time' },
                  slotEnd: { type: 'string', format: 'date-time' },
                },
                required: ['requesteeId', 'requesteeType', 'eventId', 'slotStart', 'slotEnd']
              },
            },
          },
        },
        responses: {
          200: { description: 'Meeting request sent successfully' },
        },
      },
    },
    '/mobile/pending-meeting-requests': {
      post: {
        summary: 'Get pending meeting requests for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Pending meeting requests retrieved' },
        },
      },
    },
    '/mobile/respond-meeting-request': {
      post: {
        summary: 'Respond to meeting request for mobile',
        tags: ['Mobile'],
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
                required: ['meetingId', 'status']
              },
            },
          },
        },
        responses: {
          200: { description: 'Meeting request responded successfully' },
        },
      },
    },
    '/mobile/confirmed-meetings': {
      post: {
        summary: 'Get confirmed meetings for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Confirmed meetings retrieved' },
        },
      },
    },
    '/mobile/toggle-slot-visibility': {
      post: {
        summary: 'Toggle slot visibility for mobile',
        tags: ['Mobile'],
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
                required: ['eventId', 'show']
              },
            },
          },
        },
        responses: {
          200: { description: 'Slot visibility toggled successfully' },
        },
      },
    },
    '/mobile/my-slot-status': {
      post: {
        summary: 'Get my slot status for mobile',
        tags: ['Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Slot status retrieved' },
        },
      },
    },

    // Exhibitor Mobile Routes
    '/exhibitor-mobile/profile': {
      post: {
        summary: 'Get exhibitor profile for mobile',
        tags: ['Exhibitor Mobile'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Exhibitor profile retrieved' },
        },
      },
    },
    '/exhibitor-mobile/profile/update': {
      post: {
        summary: 'Update exhibitor profile for mobile',
        tags: ['Exhibitor Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  company: { type: 'string' },
                  designation: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor profile updated successfully' },
        },
      },
    },
    '/exhibitor-mobile/events': {
      post: {
        summary: 'Get exhibitor events for mobile',
        tags: ['Exhibitor Mobile'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Exhibitor events retrieved' },
        },
      },
    },
    '/exhibitor-mobile/events/stats': {
      post: {
        summary: 'Get exhibitor event stats for mobile',
        tags: ['Exhibitor Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor event stats retrieved' },
        },
      },
    },
    '/exhibitor-mobile/slots': {
      post: {
        summary: 'Get exhibitor slots for mobile',
        tags: ['Exhibitor Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor slots retrieved' },
        },
      },
    },
    '/exhibitor-mobile/slots/toggle-visibility': {
      post: {
        summary: 'Toggle exhibitor slot visibility for mobile',
        tags: ['Exhibitor Mobile'],
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
                required: ['eventId', 'show']
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor slot visibility toggled successfully' },
        },
      },
    },
    '/exhibitor-mobile/meetings': {
      post: {
        summary: 'Get exhibitor meetings for mobile',
        tags: ['Exhibitor Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor meetings retrieved' },
        },
      },
    },
    '/exhibitor-mobile/meetings/pending': {
      post: {
        summary: 'Get exhibitor pending meeting requests for mobile',
        tags: ['Exhibitor Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Exhibitor pending meeting requests retrieved' },
        },
      },
    },
    '/exhibitor-mobile/meetings/respond': {
      post: {
        summary: 'Respond to meeting request for exhibitor mobile',
        tags: ['Exhibitor Mobile'],
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
                required: ['meetingId', 'status']
              },
            },
          },
        },
        responses: {
          200: { description: 'Meeting request responded successfully' },
        },
      },
    },

    // Visitor Mobile Routes
    '/visitor-mobile/profile': {
      post: {
        summary: 'Get visitor profile for mobile',
        tags: ['Visitor Mobile'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Visitor profile retrieved' },
        },
      },
    },
    '/visitor-mobile/profile/update': {
      post: {
        summary: 'Update visitor profile for mobile',
        tags: ['Visitor Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  company: { type: 'string' },
                  designation: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor profile updated successfully' },
        },
      },
    },
    '/visitor-mobile/events': {
      post: {
        summary: 'Get visitor events for mobile',
        tags: ['Visitor Mobile'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Visitor events retrieved' },
        },
      },
    },
    '/visitor-mobile/events/stats': {
      post: {
        summary: 'Get visitor event stats for mobile',
        tags: ['Visitor Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor event stats retrieved' },
        },
      },
    },
    '/visitor-mobile/slots': {
      post: {
        summary: 'Get visitor slots for mobile',
        tags: ['Visitor Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor slots retrieved' },
        },
      },
    },
    '/visitor-mobile/slots/toggle-visibility': {
      post: {
        summary: 'Toggle visitor slot visibility for mobile',
        tags: ['Visitor Mobile'],
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
                required: ['eventId', 'show']
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor slot visibility toggled successfully' },
        },
      },
    },
    '/visitor-mobile/meetings': {
      post: {
        summary: 'Get visitor meetings for mobile',
        tags: ['Visitor Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
                required: ['eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor meetings retrieved' },
        },
      },
    },
    '/visitor-mobile/meetings/pending': {
      post: {
        summary: 'Get visitor pending meeting requests for mobile',
        tags: ['Visitor Mobile'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Visitor pending meeting requests retrieved' },
        },
      },
    },
    '/visitor-mobile/meetings/respond': {
      post: {
        summary: 'Respond to meeting request for visitor mobile',
        tags: ['Visitor Mobile'],
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
                required: ['meetingId', 'status']
              },
            },
          },
        },
        responses: {
          200: { description: 'Meeting request responded successfully' },
        },
      },
    },

    // Registration Routes
    '/registration/event/{registrationLink}': {
      get: {
        summary: 'Get event by registration link',
        tags: ['Registration'],
        parameters: [
          {
            name: 'registrationLink',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          200: { description: 'Event details retrieved' },
          404: { description: 'Event not found' },
        },
      },
    },
    '/registration/event/{registrationLink}/exhibitor': {
      post: {
        summary: 'Register exhibitor for event via registration link',
        tags: ['Registration'],
        parameters: [
          {
            name: 'registrationLink',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  company: { type: 'string' },
                  designation: { type: 'string' },
                },
                required: ['name', 'email', 'phone']
              },
            },
          },
        },
        responses: {
          201: { description: 'Exhibitor registered successfully' },
          400: { description: 'Invalid data' },
        },
      },
    },
    '/registration/event/{registrationLink}/visitor': {
      post: {
        summary: 'Register visitor for event via registration link',
        tags: ['Registration'],
        parameters: [
          {
            name: 'registrationLink',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  company: { type: 'string' },
                  designation: { type: 'string' },
                },
                required: ['name', 'email', 'phone']
              },
            },
          },
        },
        responses: {
          201: { description: 'Visitor registered successfully' },
          400: { description: 'Invalid data' },
        },
      },
    },
    '/registration/upcoming-events': {
      get: {
        summary: 'Get upcoming events for registration',
        tags: ['Registration'],
        responses: {
          200: { description: 'Upcoming events retrieved' },
        },
      },
    },
    '/registration/multiple-events': {
      post: {
        summary: 'Register for multiple events',
        tags: ['Registration'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventIds: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  userDetails: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      email: { type: 'string' },
                      phone: { type: 'string' },
                      company: { type: 'string' },
                      designation: { type: 'string' },
                      userType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                    }
                  },
                },
                required: ['eventIds', 'userDetails']
              },
            },
          },
        },
        responses: {
          200: { description: 'Registered for multiple events successfully' },
        },
      },
    },
    '/registration/stats/{eventId}': {
      get: {
        summary: 'Get event registration statistics',
        tags: ['Registration'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          200: { description: 'Registration statistics retrieved' },
          403: { description: 'Access denied' },
        },
      },
    },

    // User Management Routes
    '/users/register-event': {
      post: {
        summary: 'Register user for event',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  userType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
                required: ['eventId', 'userType']
              },
            },
          },
        },
        responses: {
          200: { description: 'User registered for event successfully' },
        },
      },
    },
    '/users/scan-qr': {
      post: {
        summary: 'Scan QR code',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  qrData: { type: 'string' },
                  eventId: { type: 'string' },
                },
                required: ['qrData', 'eventId']
              },
            },
          },
        },
        responses: {
          200: { description: 'QR code scanned successfully' },
        },
      },
    },
    '/users/mark-attendance': {
      post: {
        summary: 'Mark user attendance',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  userId: { type: 'string' },
                  userType: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
                required: ['eventId', 'userId', 'userType']
              },
            },
          },
        },
        responses: {
          200: { description: 'Attendance marked successfully' },
        },
      },
    },
    '/users/list': {
      get: {
        summary: 'Get user list',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'role',
            in: 'query',
            schema: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] }
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'number' }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'number' }
          }
        ],
        responses: {
          200: { description: 'User list retrieved' },
        },
      },
      post: {
        summary: 'Get user list (POST)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] },
                  page: { type: 'number' },
                  limit: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User list retrieved' },
        },
      },
    },
    '/users/{role}/{userId}': {
      get: {
        summary: 'Get user details by role and ID',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'role',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] }
          },
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          200: { description: 'User details retrieved' },
          404: { description: 'User not found' },
        },
      },
      put: {
        summary: 'Update user by role and ID',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'role',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] }
          },
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  company: { type: 'string' },
                  designation: { type: 'string' },
                  profileImage: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User updated successfully' },
          404: { description: 'User not found' },
        },
      },
      delete: {
        summary: 'Delete user by role and ID',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'role',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] }
          },
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          200: { description: 'User deleted successfully' },
          404: { description: 'User not found' },
        },
      },
    },
    '/users/create': {
      post: {
        summary: 'Create new user',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  role: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] },
                  company: { type: 'string' },
                  designation: { type: 'string' },
                  profileImage: { type: 'string', format: 'binary' },
                },
                required: ['name', 'email', 'phone', 'role']
              },
            },
          },
        },
        responses: {
          201: { description: 'User created successfully' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/users/get': {
      post: {
        summary: 'Get user details',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  role: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] },
                },
                required: ['userId', 'role']
              },
            },
          },
        },
        responses: {
          200: { description: 'User details retrieved' },
          404: { description: 'User not found' },
        },
      },
    },
    '/users/stats': {
      post: {
        summary: 'Get user statistics',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  role: { type: 'string', enum: ['visitor', 'exhibitor'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User statistics retrieved' },
        },
      },
    },
    '/users/change-status': {
      post: {
        summary: 'Change user status',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  role: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] },
                  status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
                },
                required: ['userId', 'role', 'status']
              },
            },
          },
        },
        responses: {
          200: { description: 'User status changed successfully' },
        },
      },
    },
    '/users/change-role': {
      post: {
        summary: 'Change user role (superadmin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  currentRole: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] },
                  newRole: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] },
                },
                required: ['userId', 'currentRole', 'newRole']
              },
            },
          },
        },
        responses: {
          200: { description: 'User role changed successfully' },
          403: { description: 'Access denied' },
        },
      },
    },
    '/users/bulk-update-status': {
      post: {
        summary: 'Bulk update user status',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userIds: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  role: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] },
                  status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
                },
                required: ['userIds', 'role', 'status']
              },
            },
          },
        },
        responses: {
          200: { description: 'User statuses updated successfully' },
        },
      },
    },
    '/users/export': {
      post: {
        summary: 'Export users data',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] },
                  eventId: { type: 'string' },
                  format: { type: 'string', enum: ['csv', 'excel'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Users data exported successfully' },
        },
      },
    },

    // Super Admin Routes
    '/superadmin/users': {
      get: {
        summary: 'Get all users (superadmin only)',
        tags: ['Super Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'number' }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'number' }
          },
          {
            name: 'role',
            in: 'query',
            schema: { type: 'string', enum: ['visitor', 'exhibitor', 'organizer'] }
          }
        ],
        responses: {
          200: { description: 'All users retrieved' },
          403: { description: 'Access denied' },
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
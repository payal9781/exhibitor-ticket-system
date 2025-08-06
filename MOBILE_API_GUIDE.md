# Mobile App API Guide

## 🎯 Overview

This guide provides comprehensive documentation for the mobile app APIs designed specifically for **Exhibitors** and **Visitors**. The web panel is reserved for **Organizers** and **Superadmins** only.

## 🔐 Authentication

### Mobile App Login
```http
POST /api/auth/login-app
Content-Type: application/json

{
  "role": "exhibitor", // or "visitor"
  "phone": "+1234567890",
  "machineId": "unique_device_identifier"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user_id",
      "companyName": "Tech Corp", // for exhibitor
      "name": "John Doe", // for visitor
      "email": "contact@techcorp.com",
      "phone": "+1234567890",
      "role": "exhibitor",
      "isActive": true
    },
    "token": "jwt_token_here",
    "isVerified": true // false if machineId doesn't match or is first time
  }
}
```

**Machine ID Verification Logic:**
- If `machineId` is empty in database → Update with provided `machineId`, return `isVerified: false`
- If `machineId` matches stored value → Return `isVerified: true`
- If `machineId` doesn't match → Return `isVerified: false`

All mobile APIs require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## 📱 Exhibitor Mobile APIs

Base URL: `/api/v1/exhibitor-mobile`

### 👤 Profile Management

#### Get My Profile
```http
POST /api/v1/exhibitor-mobile/profile
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "exhibitor_id",
    "companyName": "Tech Corp",
    "email": "contact@techcorp.com",
    "phone": "+1234567890",
    "bio": "Leading technology company",
    "Sector": "Technology",
    "location": "New York",
    "website": "https://techcorp.com",
    "isActive": true,
    "createdAt": "2024-03-01T10:00:00.000Z"
  }
}
```

#### Update My Profile
```http
POST /api/v1/exhibitor-mobile/profile/update
Content-Type: application/json

{
  "companyName": "Updated Tech Corp",
  "email": "newemail@techcorp.com",
  "phone": "+1234567891",
  "bio": "Updated bio",
  "Sector": "AI Technology",
  "location": "San Francisco",
  "website": "https://newtechcorp.com"
}
```

### 🎪 Event Management

#### Get My Events
```http
POST /api/v1/exhibitor-mobile/events
Content-Type: application/json

{
  "includeEnded": false
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "event_id",
      "title": "Tech Exhibition 2024",
      "description": "Annual technology exhibition",
      "fromDate": "2024-03-15T00:00:00.000Z",
      "toDate": "2024-03-17T00:00:00.000Z",
      "location": "Convention Center",
      "status": "upcoming",
      "statusColor": "green",
      "myQRCode": "qr_code_string",
      "registeredAt": "2024-03-01T10:00:00.000Z",
      "organizerId": {
        "name": "Event Organizer",
        "email": "organizer@example.com"
      }
    }
  ]
}
```

#### Get My Event Statistics
```http
POST /api/v1/exhibitor-mobile/events/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEvents": 5,
    "upcomingEvents": 2,
    "ongoingEvents": 1,
    "endedEvents": 2,
    "activeEvents": 4,
    "totalMeetings": 15
  }
}
```

### ⏰ Slot Management

#### Get My Event Slots
```http
POST /api/v1/exhibitor-mobile/slots
Content-Type: application/json

{
  "eventId": "event_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "event": {
      "_id": "event_id",
      "title": "Tech Exhibition 2024",
      "fromDate": "2024-03-15T00:00:00.000Z",
      "toDate": "2024-03-17T00:00:00.000Z",
      "location": "Convention Center"
    },
    "slotsByDate": {
      "2024-03-15": {
        "available": [
          {
            "_id": "slot_id",
            "start": "2024-03-15T10:00:00.000Z",
            "end": "2024-03-15T10:30:00.000Z",
            "status": "available",
            "color": "green",
            "isAvailable": true,
            "isPending": false,
            "isBooked": false
          }
        ],
        "requested": [
          {
            "_id": "slot_id_2",
            "start": "2024-03-15T11:00:00.000Z",
            "end": "2024-03-15T11:30:00.000Z",
            "status": "requested",
            "color": "yellow",
            "isAvailable": false,
            "isPending": true,
            "isBooked": false
          }
        ],
        "booked": [
          {
            "_id": "slot_id_3",
            "start": "2024-03-15T14:00:00.000Z",
            "end": "2024-03-15T14:30:00.000Z",
            "status": "booked",
            "color": "red",
            "isAvailable": false,
            "isPending": false,
            "isBooked": true
          }
        ]
      }
    },
    "statusCounts": {
      "available": 10,
      "requested": 2,
      "booked": 3
    },
    "showSlots": true,
    "totalSlots": 15
  }
}
```

#### Toggle Slot Visibility
```http
POST /api/v1/exhibitor-mobile/slots/toggle-visibility
Content-Type: application/json

{
  "eventId": "event_id",
  "showSlots": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Slots enabled successfully",
    "showSlots": true
  }
}
```

### 🤝 Meeting Management

#### Get My Event Meetings
```http
POST /api/v1/exhibitor-mobile/meetings
Content-Type: application/json

{
  "eventId": "event_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "meetingsByDate": {
      "2024-03-15": [
        {
          "_id": "meeting_id",
          "slotStart": "2024-03-15T14:00:00.000Z",
          "slotEnd": "2024-03-15T14:30:00.000Z",
          "eventTitle": "Tech Exhibition 2024",
          "eventLocation": "Convention Center",
          "otherParticipant": {
            "_id": "visitor_id",
            "name": "John Doe",
            "email": "john@example.com",
            "phone": "+1234567890",
            "bio": "Technology enthusiast",
            "Sector": "IT"
          },
          "otherParticipantType": "visitor",
          "isRequester": false
        }
      ]
    },
    "totalMeetings": 1
  }
}
```

#### Get Pending Meeting Requests
```http
POST /api/v1/exhibitor-mobile/meetings/pending
Content-Type: application/json

{
  "eventId": "event_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "_id": "meeting_request_id",
        "slotStart": "2024-03-15T15:00:00.000Z",
        "slotEnd": "2024-03-15T15:30:00.000Z",
        "eventTitle": "Tech Exhibition 2024",
        "eventLocation": "Convention Center",
        "requester": {
          "_id": "visitor_id",
          "name": "Jane Smith",
          "email": "jane@example.com",
          "phone": "+1234567891",
          "bio": "Business analyst",
          "Sector": "Finance"
        },
        "requesterType": "visitor",
        "createdAt": "2024-03-14T10:00:00.000Z"
      }
    ],
    "totalRequests": 1
  }
}
```

#### Respond to Meeting Request
```http
POST /api/v1/exhibitor-mobile/meetings/respond
Content-Type: application/json

{
  "meetingId": "meeting_request_id",
  "status": "accepted"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Meeting request accepted successfully",
    "meetingId": "meeting_request_id",
    "status": "accepted"
  }
}
```

## 👥 Visitor Mobile APIs

Base URL: `/api/v1/visitor-mobile`

### 👤 Profile Management

#### Get My Profile
```http
POST /api/v1/visitor-mobile/profile
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "visitor_id",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "bio": "Technology enthusiast",
    "Sector": "IT",
    "location": "Boston",
    "companyName": "ABC Corp",
    "isActive": true,
    "createdAt": "2024-03-01T10:00:00.000Z"
  }
}
```

#### Update My Profile
```http
POST /api/v1/visitor-mobile/profile/update
Content-Type: application/json

{
  "name": "John Updated Doe",
  "email": "johnupdated@example.com",
  "phone": "+1234567891",
  "bio": "Updated bio",
  "Sector": "AI Technology",
  "location": "New York",
  "companyName": "XYZ Corp"
}
```

### 🎪 Event Management

The event management APIs for visitors are identical to exhibitors:
- `POST /api/v1/visitor-mobile/events`
- `POST /api/v1/visitor-mobile/events/stats`

### ⏰ Slot Management

The slot management APIs for visitors are identical to exhibitors:
- `POST /api/v1/visitor-mobile/slots`
- `POST /api/v1/visitor-mobile/slots/toggle-visibility`

### 🤝 Meeting Management

The meeting management APIs for visitors are identical to exhibitors:
- `POST /api/v1/visitor-mobile/meetings`
- `POST /api/v1/visitor-mobile/meetings/pending`
- `POST /api/v1/visitor-mobile/meetings/respond`

## 🎨 Status Color System

### Event Status
- **🟢 Green (upcoming)**: Event hasn't started yet
- **🟠 Orange (ongoing)**: Event is currently happening
- **🔴 Red (ended)**: Event has finished

### Slot Status
- **🟢 Green (available)**: Slot can be requested for meetings
- **🟡 Yellow (requested)**: Meeting request pending approval
- **🔴 Red (booked)**: Confirmed meeting scheduled

## 🔄 Event Status Management

The system automatically manages event status based on dates:

- **Active Events** (`isActive: true`): Available for all interactions
- **Inactive Events** (`isActive: false`): Ended events with limited functionality
- **Deleted Events** (`isDeleted: true`): Not returned in API responses

## 📊 API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

## 🚀 Mobile App Development Tips

### 1. **Real-time Updates**
Consider implementing WebSocket connections for real-time meeting request notifications.

### 2. **Offline Support**
Cache essential data like events and profile information for offline viewing.

### 3. **Push Notifications**
Implement push notifications for:
- New meeting requests
- Meeting request responses
- Event updates

### 4. **QR Code Integration**
Use the existing `/api/v1/mobile/*` endpoints for QR code scanning and meeting requests.

### 5. **Calendar Integration**
Allow users to add confirmed meetings to their device calendar using the meeting data.

### 6. **Color-coded UI**
Use the provided color indicators to create intuitive visual interfaces:
- Green buttons for available actions
- Yellow indicators for pending items
- Red indicators for booked/unavailable items

## 🔧 Error Handling

Common error scenarios:
- **401 Unauthorized**: Invalid or expired JWT token
- **403 Forbidden**: User doesn't have permission for the action
- **404 Not Found**: Event or resource not found
- **400 Bad Request**: Invalid request data

## 📱 Mobile App Flow

### Typical User Journey:
1. **Login** → Get JWT token
2. **View Events** → Get registered events with status
3. **Manage Slots** → View and toggle slot visibility
4. **Handle Requests** → View and respond to meeting requests
5. **View Meetings** → See confirmed meetings by date
6. **Update Profile** → Keep profile information current

The mobile APIs are now fully implemented and ready for mobile app development! 🎉
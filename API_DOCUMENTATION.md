# Exhibition System API Documentation

## Overview
This API provides comprehensive functionality for managing exhibitions, including organizer management, exhibitor/visitor registration, QR code generation, slot management, and meeting scheduling.

## Authentication
All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

## Base URL
```
http://localhost:3000/api
```

---

## Event Management APIs

### 1. Create Event
**POST** `/events/create`
- **Auth**: Organizer, Superadmin
- **Body**:
```json
{
  "title": "Tech Exhibition 2024",
  "description": "Annual technology exhibition",
  "fromDate": "2024-03-01",
  "toDate": "2024-03-03",
  "startTime": "09:00:00",
  "endTime": "18:00:00",
  "location": "Convention Center",
  "media": ["image1.jpg", "image2.jpg"]
}
```

### 2. Get Upcoming Events (for Dropdown)
**POST** `/events/upcoming`
- **Auth**: Organizer, Superadmin
- **Response**: List of upcoming events for dropdown selection

### 3. Get All Participants (for Dropdown)
**POST** `/events/all-participants`
- **Auth**: Organizer, Superadmin
- **Body** (optional):
```json
{
  "search": "search_term",
  "type": "exhibitor" // or "visitor" or omit for both
}
```
- **Response**: Searchable list of exhibitors and visitors

### 4. Add Participant to Event (by Organizer)
**POST** `/events/add-participant`
- **Auth**: Organizer, Superadmin
- **Body** (Option 1 - Existing Participant):
```json
{
  "eventId": "event_id",
  "participantId": "user_id",
  "participantType": "exhibitor" // or "visitor"
}
```
- **Body** (Option 2 - New Participant):
```json
{
  "eventId": "event_id",
  "participantType": "exhibitor", // or "visitor"
  "participantData": {
    "companyName": "Tech Corp", // for exhibitor
    "name": "John Doe", // for visitor
    "email": "contact@example.com",
    "phone": "+1234567890",
    "bio": "Description",
    "Sector": "Technology"
  }
}
```
- **Response**: Returns QR code and participant details

### 3. Get Event Participants
**POST** `/events/participants`
- **Auth**: Organizer, Superadmin
- **Body**:
```json
{
  "eventId": "event_id"
}
```

### 4. Register for Event (Self Registration)
**POST** `/events/register`
- **Auth**: Exhibitor, Visitor, Organizer, Superadmin
- **Body**:
```json
{
  "eventId": "event_id",
  "userId": "user_id",
  "userType": "exhibitor" // or "visitor"
}
```

---

## Registration APIs (Public Registration via Link)

### 1. Get Upcoming Events for Registration
**GET** `/registration/upcoming-events`
- **Auth**: None
- **Response**: List of upcoming events available for registration

### 2. Register for Multiple Events
**POST** `/registration/multiple-events`
- **Auth**: None
- **Body**:
```json
{
  "eventIds": ["event_id_1", "event_id_2"],
  "participantType": "exhibitor", // or "visitor"
  "participantData": {
    "companyName": "Tech Corp", // for exhibitor
    "name": "John Doe", // for visitor
    "email": "contact@example.com",
    "phone": "+1234567890",
    "bio": "Description",
    "Sector": "Technology"
  }
}
```

### 3. Get Event by Registration Link
**GET** `/registration/event/:registrationLink`
- **Auth**: None
- **Response**: Event details for registration page

### 4. Register Exhibitor via Link
**POST** `/registration/event/:registrationLink/exhibitor`
- **Auth**: None
- **Body**:
```json
{
  "companyName": "Tech Corp",
  "email": "contact@techcorp.com",
  "phone": "+1234567890",
  "bio": "Leading technology company",
  "Sector": "Technology",
  "website": "https://techcorp.com",
  "location": "New York"
}
```

### 5. Register Visitor via Link
**POST** `/registration/event/:registrationLink/visitor`
- **Auth**: None
- **Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "companyName": "ABC Inc",
  "bio": "Business professional",
  "Sector": "Finance"
}
```

---

## Mobile APIs (For Exhibitor/Visitor Apps)

### Connection & Scanning APIs

### 1. Record Scan
**POST** `/mobile/record-scan`
- **Auth**: Exhibitor, Visitor
- **Body**:
```json
{
  "scannedUserId": "user_id",
  "scannedUserType": "exhibitor", // or "visitor"
  "eventId": "event_id"
}
```

### 2. Get Total Connections
**POST** `/mobile/total-connections`
- **Auth**: Exhibitor, Visitor
- **Response**: Total connections across all events

### 3. Get Event Connections
**POST** `/mobile/event-connections`
- **Auth**: Exhibitor, Visitor
- **Body**:
```json
{
  "eventId": "event_id"
}
```

### Slot & Meeting Management APIs

### 4. Get Scanned User's Available Slots
**POST** `/mobile/scanned-user-slots`
- **Auth**: Exhibitor, Visitor
- **Body**:
```json
{
  "eventId": "event_id",
  "scannedUserId": "user_id",
  "scannedUserType": "exhibitor" // or "visitor"
}
```
- **Response**: Available slots grouped by date

### 5. Send Meeting Request
**POST** `/mobile/send-meeting-request`
- **Auth**: Exhibitor, Visitor
- **Body**:
```json
{
  "eventId": "event_id",
  "requesteeId": "user_id",
  "requesteeType": "exhibitor", // or "visitor"
  "slotStart": "2024-03-01T10:00:00.000Z",
  "slotEnd": "2024-03-01T10:30:00.000Z"
}
```

### 6. Get Pending Meeting Requests
**POST** `/mobile/pending-meeting-requests`
- **Auth**: Exhibitor, Visitor
- **Body** (optional):
```json
{
  "eventId": "event_id" // optional filter
}
```

### 7. Respond to Meeting Request
**POST** `/mobile/respond-meeting-request`
- **Auth**: Exhibitor, Visitor
- **Body**:
```json
{
  "meetingId": "meeting_id",
  "status": "accepted" // or "rejected"
}
```

### 8. Get Confirmed Meetings (Day-wise)
**POST** `/mobile/confirmed-meetings`
- **Auth**: Exhibitor, Visitor
- **Body** (optional):
```json
{
  "eventId": "event_id" // optional filter
}
```
- **Response**: Meetings grouped by date

### 9. Toggle Slot Visibility
**POST** `/mobile/toggle-slot-visibility`
- **Auth**: Exhibitor, Visitor
- **Body**:
```json
{
  "eventId": "event_id",
  "showSlots": true // or false
}
```

### 10. Get My Slot Status
**POST** `/mobile/my-slot-status`
- **Auth**: Exhibitor, Visitor
- **Body**:
```json
{
  "eventId": "event_id"
}
```
- **Response**: User's slots grouped by date and status

---

## Meeting Management APIs

### 1. Get User Meetings by Date
**POST** `/meetings/by-date`
- **Auth**: Exhibitor, Visitor
- **Body** (optional):
```json
{
  "eventId": "event_id" // optional filter
}
```
- **Response**: Meetings grouped by date and status

### 2. Cancel Meeting
**POST** `/meetings/cancel`
- **Auth**: Exhibitor, Visitor
- **Body**:
```json
{
  "meetingId": "meeting_id"
}
```

### 3. Toggle Show Slots (Legacy)
**POST** `/meetings/toggle`
- **Auth**: Exhibitor, Visitor
- **Body**:
```json
{
  "eventId": "event_id",
  "show": true // or false
}
```

---

## Key Features

### 1. Automatic Slot Generation
- When an exhibitor/visitor registers for an event, 30-minute slots are automatically generated
- Slots span from event start time to end time for each day of the event
- Slots are marked as 'available' by default

### 2. QR Code Generation
- Each registration generates a unique QR code containing:
  - Event ID
  - User ID
  - User Type (exhibitor/visitor)
  - Event start and end dates
  - Event title

### 3. Meeting Request Flow
1. User A scans User B's QR code
2. User A can view User B's available slots (if User B has enabled slot visibility)
3. User A sends a meeting request for a specific slot
4. Slot status changes to 'requested'
5. User B can accept/reject the request
6. If accepted: slot becomes 'booked' and appears in both users' confirmed meetings
7. If rejected: slot returns to 'available'

### 4. Slot Status Management with Color Coding
- **🟢 Available (Green)**: Can be requested for meetings
- **🟡 Requested (Yellow)**: Pending approval from slot owner
- **🔴 Booked (Red)**: Confirmed meeting scheduled
- **❌ Cancelled**: Meeting was cancelled, slot returns to available

All slot APIs now return color indicators:
```json
{
  "_id": "slot_id",
  "start": "2024-03-01T10:00:00.000Z",
  "end": "2024-03-01T10:30:00.000Z",
  "status": "available",
  "color": "green",
  "isAvailable": true,
  "isPending": false,
  "isBooked": false
}
```

### 5. Day-wise Organization
- All slots and meetings are organized by date
- Easy navigation through different days of the event
- Clear visual indication of slot availability

---

## Response Format

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

---

## Authentication Types
- **Organizer**: Can create events, add participants, view all event data
- **Exhibitor**: Can register for events, manage slots, send/receive meeting requests
- **Visitor**: Can register for events, manage slots, send/receive meeting requests
- **Superadmin**: Has all permissions

---

## Notes for Mobile App Development

1. **QR Code Scanning**: Implement QR code scanner to read participant QR codes
2. **Real-time Updates**: Consider implementing WebSocket connections for real-time meeting request notifications
3. **Offline Support**: Cache essential data for offline viewing
4. **Push Notifications**: Implement push notifications for meeting requests and responses
5. **Calendar Integration**: Allow users to add confirmed meetings to their device calendar

---

## Database Models

### Event Model
- Contains arrays of exhibitors and visitors with QR codes
- Each participant entry includes userId, qrCode, and registeredAt timestamp

### UserEventSlot Model
- Stores 30-minute time slots for each user per event
- Tracks slot status (available/requested/booked)
- Links to meeting IDs when booked

### Meeting Model
- Tracks meeting requests between participants
- Stores requester, requestee, time slot, and status
- Links to specific event and time slots

---

## 📱 Mobile App APIs

### **Exhibitor Mobile APIs**
Base URL: `/api/v1/exhibitor-mobile`

#### Profile Management
- **POST** `/profile` - Get exhibitor profile
- **POST** `/profile/update` - Update exhibitor profile

#### Event Management  
- **POST** `/events` - Get registered events with status
- **POST** `/events/stats` - Get event statistics

#### Slot Management
- **POST** `/slots` - Get slots for specific event with color coding
- **POST** `/slots/toggle-visibility` - Toggle slot visibility

#### Meeting Management
- **POST** `/meetings` - Get confirmed meetings by date
- **POST** `/meetings/pending` - Get pending meeting requests
- **POST** `/meetings/respond` - Accept/reject meeting requests

### **Visitor Mobile APIs**
Base URL: `/api/v1/visitor-mobile`

#### Profile Management
- **POST** `/profile` - Get visitor profile
- **POST** `/profile/update` - Update visitor profile

#### Event Management
- **POST** `/events` - Get registered events with status
- **POST** `/events/stats` - Get event statistics

#### Slot Management
- **POST** `/slots` - Get slots for specific event with color coding
- **POST** `/slots/toggle-visibility` - Toggle slot visibility

#### Meeting Management
- **POST** `/meetings` - Get confirmed meetings by date
- **POST** `/meetings/pending` - Get pending meeting requests
- **POST** `/meetings/respond` - Accept/reject meeting requests

### **Mobile API Examples**

#### Get My Events
```json
POST /api/v1/exhibitor-mobile/events
{
  "includeEnded": false
}

Response:
[
  {
    "_id": "event_id",
    "title": "Tech Exhibition 2024",
    "status": "upcoming",
    "statusColor": "green",
    "myQRCode": "qr_code_string",
    "registeredAt": "2024-03-01T10:00:00.000Z",
    "fromDate": "2024-03-15T00:00:00.000Z",
    "toDate": "2024-03-17T00:00:00.000Z"
  }
]
```

#### Get My Slots
```json
POST /api/v1/exhibitor-mobile/slots
{
  "eventId": "event_id"
}

Response:
{
  "slotsByDate": {
    "2024-03-15": {
      "available": [
        {
          "_id": "slot_id",
          "start": "2024-03-15T10:00:00.000Z",
          "end": "2024-03-15T10:30:00.000Z",
          "status": "available",
          "color": "green",
          "isAvailable": true
        }
      ],
      "requested": [],
      "booked": []
    }
  },
  "statusCounts": {
    "available": 10,
    "requested": 2,
    "booked": 3
  },
  "showSlots": true
}
```

#### Respond to Meeting Request
```json
POST /api/v1/exhibitor-mobile/meetings/respond
{
  "meetingId": "meeting_id",
  "status": "accepted"
}

Response:
{
  "success": true,
  "message": "Meeting request accepted successfully",
  "meetingId": "meeting_id",
  "status": "accepted"
}
```

### **Event Status Management**
All mobile APIs now handle event status properly:
- **🟢 Active Events**: `isActive: true` - Available for interactions
- **🔴 Inactive Events**: `isActive: false` - Ended events, limited functionality
- **❌ Deleted Events**: `isDeleted: true` - Not returned in API responses

### **Color-Coded Slot System**
- **🟢 Available (Green)**: Can be requested for meetings
- **🟡 Requested (Yellow)**: Pending approval from slot owner
- **🔴 Booked (Red)**: Confirmed meeting scheduled

### **Mobile App Integration Ready**
The backend now provides complete mobile app support:
- ✅ **Profile Management**: Update exhibitor/visitor profiles
- ✅ **Event Status Tracking**: Real-time event status with color indicators
- ✅ **Slot Management**: Color-coded availability with visibility controls
- ✅ **Meeting Flow**: Complete request/response cycle
- ✅ **Statistics**: Event and meeting statistics for dashboard

---

## 🎯 Comprehensive Participant Management

### **New Event Participant Management APIs**
Base URL: `/api/v1/events`

#### Get Available Participants for Event
```http
POST /api/v1/events/available-participants
Authorization: Bearer <organizer_or_superadmin_token>

{
  "eventId": "event_id",
  "search": "optional_search_term",
  "userType": "all|exhibitor|visitor"
}

Response:
{
  "success": true,
  "data": {
    "eventId": "event_id",
    "eventTitle": "Tech Exhibition 2024",
    "participants": [
      {
        "_id": "user_id",
        "name": "Company Name / User Name",
        "email": "user@example.com",
        "phone": "+1234567890",
        "userType": "exhibitor|visitor",
        "displayName": "Company Name (user@example.com)",
        "isRegistered": false,
        "Sector": "Technology",
        "location": "New York"
      }
    ],
    "totalAvailable": 25,
    "searchTerm": "tech",
    "userType": "all"
  }
}
```

#### Add Single Participant to Event
```http
POST /api/v1/events/add-participant-comprehensive
Authorization: Bearer <organizer_or_superadmin_token>

{
  "eventId": "event_id",
  "userId": "user_id",
  "userType": "exhibitor|visitor"
}

Response:
{
  "success": true,
  "data": {
    "message": "exhibitor added to event successfully",
    "participant": {
      "_id": "user_id",
      "name": "Company Name",
      "email": "user@example.com",
      "userType": "exhibitor",
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      "registeredAt": "2024-03-01T10:00:00.000Z"
    },
    "eventTitle": "Tech Exhibition 2024",
    "totalSlots": 48
  }
}
```

#### Add Multiple Participants to Event
```http
POST /api/v1/events/add-multiple-participants
Authorization: Bearer <organizer_or_superadmin_token>

{
  "eventId": "event_id",
  "participants": [
    {
      "userId": "user_id_1",
      "userType": "exhibitor"
    },
    {
      "userId": "user_id_2",
      "userType": "visitor"
    }
  ]
}

Response:
{
  "success": true,
  "data": {
    "message": "Processed 2 participants",
    "results": {
      "successful": [
        {
          "userId": "user_id_1",
          "userType": "exhibitor",
          "name": "Company A",
          "email": "company@example.com"
        }
      ],
      "failed": [
        {
          "userId": "user_id_2",
          "userType": "visitor",
          "error": "User not found or inactive"
        }
      ],
      "totalProcessed": 2
    },
    "eventTitle": "Tech Exhibition 2024",
    "successCount": 1,
    "failureCount": 1
  }
}
```

#### Remove Participant from Event
```http
POST /api/v1/events/remove-participant
Authorization: Bearer <organizer_or_superadmin_token>

{
  "eventId": "event_id",
  "userId": "user_id",
  "userType": "exhibitor|visitor"
}

Response:
{
  "success": true,
  "data": {
    "message": "exhibitor removed from event successfully",
    "eventTitle": "Tech Exhibition 2024"
  }
}
```

### **Automated Processes**

When adding participants to events, the system automatically:

#### 1. **Duplicate Check**
- Verifies participant isn't already registered for the event
- Prevents duplicate registrations

#### 2. **User Validation**
- Confirms user exists and is active
- Checks user permissions and status

#### 3. **QR Code Generation**
```json
{
  "eventId": "event_id",
  "userId": "user_id", 
  "userType": "exhibitor|visitor",
  "eventTitle": "Tech Exhibition 2024",
  "timestamp": "2024-03-01T10:00:00.000Z",
  "qrId": "unique_qr_identifier"
}
```

#### 4. **Time Slot Creation**
- Generates 30-minute slots for entire event duration
- Creates slots based on event `startTime` and `endTime`
- Default status: `available`
- Default visibility: `hidden` (user must enable)

#### 5. **Event Schema Update**
- Adds participant to event's `exhibitor` or `visitor` array
- Stores QR code and registration timestamp
- Updates participant counts

### **Frontend Components**

#### **ParticipantDashboard**
- Overview of all events and participants
- Statistics and quick actions
- Event selection for participant management

#### **EventParticipantSelector**
- Event selection interface
- Event status indicators
- Participant count display

#### **ParticipantManagement**
- Search and filter available participants
- Bulk selection and addition
- Current participant management
- QR code access and download

### **Search and Filter Features**

#### **Search Capabilities**
- **Exhibitors**: Company name, email, phone, sector
- **Visitors**: Name, email, phone, company, sector
- **Real-time search**: Updates as you type
- **Case-insensitive**: Flexible search matching

#### **Filter Options**
- **All Types**: Show both exhibitors and visitors
- **Exhibitors Only**: Filter to companies only
- **Visitors Only**: Filter to individuals only

### **Bulk Operations**

#### **Multi-Select Interface**
- Checkbox selection for multiple participants
- Select/Deselect all functionality
- Visual selection indicators

#### **Batch Processing**
- Process multiple participants simultaneously
- Individual success/failure tracking
- Detailed result reporting

### **Error Handling**

#### **Common Scenarios**
- **Already Registered**: Participant exists in event
- **User Not Found**: Invalid user ID
- **Inactive User**: User account disabled
- **Event Not Found**: Invalid event ID
- **Permission Denied**: Insufficient access rights
- **Event Inactive**: Cannot add to ended events

#### **Graceful Degradation**
- Slot generation failures don't block registration
- Partial success in bulk operations
- Detailed error reporting for troubleshooting

### **Mobile App Integration**

#### **Immediate Availability**
- Participants can use mobile app immediately after addition
- QR codes work instantly for scanning
- Time slots available for meeting requests

#### **Automatic Sync**
- Real-time updates across all platforms
- Consistent data between web and mobile
- Instant notification capabilities

This comprehensive participant management system provides complete control over event participation while maintaining data integrity and user experience! 🎉
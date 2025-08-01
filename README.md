// README.md
# Exhibition Ticketing System - Backend

## Overview
This is a Node.js/Express backend for an Exhibition Ticketing System with MongoDB, implementing OTP-based authentication, QR code system, and role-based access control with separate schemas for Superadmin, Organizer, Exhibitor, and Visitor.

## Setup
1. Install dependencies: `npm install`
2. Create `.env` file based on `.env.example`
3. Start MongoDB server
4. Run the application:
   - Development: `npm run dev`
   - Production: `npm start`

## API Endpoints
- Auth: `/api/auth/*`
- Events: `/api/events/*`
- Users: `/api/users/*`
- Superadmin: `/api/superadmin/*`

## Features
- OTP-based authentication
- Role-based access control (Superadmin, Organizer, Exhibitor, Visitor)
- Event management
- QR code generation and scanning
- Dashboard for past/upcoming events and scanned contacts
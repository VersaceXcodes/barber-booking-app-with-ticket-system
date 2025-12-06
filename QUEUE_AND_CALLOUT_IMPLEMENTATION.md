# Walk-In Queue & Call-Out Service Implementation

## Overview
This implementation adds a complete walk-in queue management system and call-out booking service to the barber shop application, including real-time admin dashboards, customer-facing forms, and full backend API support.

## Features Implemented

### 1. Database Schema Updates

#### New Tables Created:
- **`call_out_bookings`** - Stores call-out service bookings
  - Fields: callout_id, customer details, address, appointment date/time, status, price (€150), special requests, admin notes
  - Statuses: `scheduled`, `en_route`, `completed`, `cancelled`
  - Indexed on status and appointment_date

- **`walk_in_queue`** (updated) - Enhanced queue management
  - Statuses changed to: `waiting`, `in_service`, `completed`, `no_show`
  - Added position tracking and estimated wait time calculation

### 2. Backend API Endpoints

#### Walk-In Queue Endpoints:
- **POST `/api/queue/join`** - Join the walk-in queue
  - Calculates queue position based on current queue
  - Estimates wait time based on active barbers and queue length
  - Returns full queue entry with position and estimated wait

- **GET `/api/queue/status/:queue_id`** - Get queue entry status
- **POST `/api/queue/leave/:queue_id`** - Leave the queue
- **GET `/api/queue`** - Public endpoint to view current queue
- **GET `/api/admin/queue`** (Admin) - View all queue entries
- **PATCH `/api/admin/queue/:queue_id`** (Admin) - Update queue entry status

#### Call-Out Booking Endpoints:
- **POST `/api/callouts/book`** - Book a call-out service
  - Fixed price of €150
  - Requires name, phone, email, address, date, time
  - Returns full booking object

- **GET `/api/callouts/:callout_id`** - Get call-out booking details
- **GET `/api/admin/callouts`** (Admin) - List all call-out bookings
  - Supports filtering by status, date range
  - Pagination support

- **PATCH `/api/admin/callouts/:callout_id`** (Admin) - Update call-out status
  - Status transitions: scheduled → en_route → completed
  - Can cancel with reason

#### Wait Time Service:
- Enhanced `WaitTimeService` class
- Real-time calculation based on:
  - Active barbers (currently 2)
  - Current queue length
  - Upcoming scheduled appointments
  - Service duration estimates (~30 min default)

### 3. Frontend Customer Forms

#### Join Walk-In Queue (`/queue/join`)
- Clean, modern form collecting:
  - Customer name
  - Mobile phone number
- Shows current queue stats:
  - People in queue
  - Estimated wait time
- Success screen displays:
  - Queue position (e.g., #3)
  - Estimated wait time
  - SMS notification promise
  - Option to leave queue

#### Book Call-Out Service (`/callout/book`)
- Two-step booking process:
  1. **Details Step**: Name, email, phone, service address, date/time, special requests
  2. **Confirmation Step**: Review all details before booking
- Shows premium service badge (€150 fixed price)
- Validates all inputs with helpful error messages
- Address field accepts full details including apartment numbers, parking instructions

### 4. Admin Dashboard (`/admin/queue`)

#### Features:
- **Real-time Updates**: Auto-refreshes every 15-30 seconds
- **Two-Column Layout**:
  - Left: Live Walk-In Queue
  - Right: Call-Out Jobs

#### Live Walk-In Queue Section:
- Displays all waiting customers
- Shows for each entry:
  - Position number (#1, #2, etc.)
  - Customer name and phone
  - Estimated wait time
  - Status (color-coded badges)
  - Time joined
- **Status Controls** (buttons):
  - `Start Service` - Changes status to `in_service`
  - `Complete` - Marks as `completed`
  - `No-Show` - Marks as `no_show`
- Live indicator (green pulsing dot)
- Empty state when no queue

#### Call-Out Jobs Section:
- Filter tabs: All / Today / Upcoming
- Shows for each booking:
  - Customer name, phone, email
  - Service address with map pin icon
  - Appointment date & time (formatted)
  - Price (€150)
  - Special requests (if any)
  - Status badge
- **Status Controls** (buttons):
  - `On the Way` - Changes status to `en_route`
  - `Complete` - Marks as `completed`
  - `Cancel` - Marks as `cancelled` (prompts for reason)

### 5. Integration & Sync

#### Public UI Sync:
- Wait time calculations used across:
  - Homepage "Current Wait" card
  - Join Queue form
  - Queue status page
- Admin queue updates trigger wait time recalculation
- Status changes automatically update positions for all waiting customers

#### Real-Time Polling:
- Queue dashboard: 15 seconds
- Call-outs dashboard: 30 seconds
- Uses React Query for efficient caching and updates

### 6. UX & Permissions

#### Admin Access:
- Only admin users can access `/admin/queue`
- Protected with `authenticateAdmin` middleware
- Admin navigation includes "Queue & Call-Outs" link with live indicator

#### Customer Access:
- Customers can only see:
  - Their own queue position
  - Aggregated wait estimates
  - Public queue length
- No access to other customers' data or admin functions

### 7. Schema Validation

All endpoints use Zod schemas for validation:
- `joinQueueInputSchema`
- `updateQueueStatusInputSchema`
- `bookCallOutInputSchema`
- `updateCallOutStatusInputSchema`

## File Changes

### Backend:
- `backend/schema.ts` - Added schemas for queue and call-out entities
- `backend/server.ts` - Added all API endpoints
- `backend/db.sql` - Updated database schema
- `backend/waitTimeService.ts` - Already existed, used for calculations

### Frontend:
- `vitereact/src/components/views/UV_JoinQueue.tsx` - Already existed, works with new API
- `vitereact/src/components/views/UV_CallOutBooking.tsx` - Updated to use new API endpoint
- `vitereact/src/components/views/UV_AdminQueueDashboard.tsx` - NEW comprehensive admin dashboard
- `vitereact/src/App.tsx` - Added route for `/admin/queue`
- `vitereact/src/components/views/GV_TopNav.tsx` - Added "Queue & Call-Outs" link to admin nav

## API Endpoint Summary

### Public Endpoints:
```
GET    /api/wait-time                  - Get current wait time
POST   /api/queue/join                 - Join walk-in queue
GET    /api/queue/status/:queue_id     - Check queue status
POST   /api/queue/leave/:queue_id      - Leave queue
GET    /api/queue                      - View current queue
POST   /api/callouts/book              - Book call-out service
GET    /api/callouts/:callout_id       - Get call-out details
```

### Admin Endpoints:
```
GET    /api/admin/queue                - List all queue entries
PATCH  /api/admin/queue/:queue_id      - Update queue status
GET    /api/admin/callouts             - List all call-outs (with filters)
PATCH  /api/admin/callouts/:callout_id - Update call-out status
```

## Status Workflows

### Walk-In Queue Statuses:
1. `waiting` → Customer joins queue
2. `in_service` → Staff starts serving customer
3. `completed` OR `no_show` → Final states

### Call-Out Statuses:
1. `scheduled` → Initial booking
2. `en_route` → Barber on the way
3. `completed` OR `cancelled` → Final states

## Testing Checklist

- [ ] Join queue form validation
- [ ] Queue position calculation
- [ ] Wait time estimation
- [ ] Call-out booking form validation
- [ ] Call-out €150 price display
- [ ] Admin queue status updates
- [ ] Admin call-out status updates
- [ ] Real-time polling on admin dashboard
- [ ] Queue position recalculation after status changes
- [ ] Admin navigation link
- [ ] Permission checks (admin-only access)

## Next Steps / Future Enhancements

1. **SMS Notifications**: Integrate Twilio or similar to actually send SMS when customer is next
2. **Barber Assignment**: Allow multiple barbers and assign queue entries to specific barbers
3. **Queue History**: Track completed queue entries for analytics
4. **Call-Out Pricing**: Make pricing configurable per service type
5. **Map Integration**: Show call-out address on map in admin dashboard
6. **Push Notifications**: Real-time alerts for admins when new bookings arrive

## Notes

- Wait time calculations use a simple algorithm based on 30-minute average service time
- Queue positions auto-update when customers leave or are served
- All timestamps stored in ISO 8601 format
- Price for call-out service is fixed at €150
- Real-time features use polling (could be upgraded to WebSockets)

---

**Implementation Date**: December 2024
**Status**: Complete ✅

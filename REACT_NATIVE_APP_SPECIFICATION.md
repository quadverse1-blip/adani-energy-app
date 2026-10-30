# React Native Mobile App Specification
## Adani Smart Meter Project — GPS Workforce & Attendance Management Platform

---

## 📌 Document Overview
This document serves as the **master product and technical specification** to develop a 1:1 identical mobile application in **React Native** (compatible with iOS and Android) based on the web platform. It details all features, screen layouts, design tokens, business rules, native device integrations, and REST API specifications.

---

## 1. System Roles & Access Matrix

| Feature / Screen | Technician | Supervisor | Operations Admin |
|---|:---:|:---:|:---:|
| **Login & Password Reset** | ✅ | ✅ | ✅ |
| **Technician Home Dashboard** | ✅ | ✅ | ❌ |
| **Field Check-In (GPS & Camera)** | ✅ | ✅ | ❌ |
| **Shift Check-Out** | ✅ | ✅ (No 6 PM limit) | ❌ |
| **Today's Attendance Status** | ✅ | ✅ | ❌ |
| **Monthly Attendance History** | ✅ | ✅ | ❌ |
| **Assigned Substation & Navigation** | ✅ | ✅ | ❌ |
| **Salary & Monthly Pay Slips** | ✅ | ✅ | ✅ |
| **Admin Operations KPI Hub** | ❌ | ❌ | ✅ |
| **Employee Roster Management** | ❌ | ❌ | ✅ |
| **Substations & Sites Management**| ❌ | ✅ | ✅ |
| **Fleet Radar & Live Map Tracking**| ❌ | ❌ | ✅ |
| **Reports & Excel (.xlsx) Export**| ❌ | ❌ | ✅ |
| **System & Geofence Settings** | ❌ | ❌ | ✅ |

---

## 2. Design System & Visual Tokens

### 2.1 Color Palette
Use these exact hex codes in your mobile stylesheet or `tailwind.config.js` (NativeWind):

- **Primary Corporate Blue:**
  - `brand-50`: `#EFF6FF` (Soft blue card background)
  - `brand-100`: `#DBEAFE` (Subtle selection / active pill)
  - `brand-500`: `#1E63F0` (**Main Corporate Action Color**)
  - `brand-600`: `#1952CB` (Pressed / Active states)
  - `brand-700`: `#1541A7` (Header gradients, borders)
- **Status & Feedback Colors:**
  - **Success (Green):**
    - Main: `#22C55E`
    - Light Background: `#DCFCE7`
    - Dark Text/Border: `#16A34A`
    - *Usage:* Present status, Inside Geofence badge, Check-in confirmation.
  - **Danger (Rose/Red):**
    - Main: `#EF4444`
    - Light Background: `#FEE2E2`
    - Dark Text/Border: `#DC2626`
    - *Usage:* Check-out CTA, Absent status, Outside Geofence warning.
  - **Warning (Amber):**
    - Main: `#F59E0B`
    - Light Background: `#FEF3C7`
    - Dark Text/Border: `#D97706`
    - *Usage:* Late arrival, Pending approval, Grace period warnings.
- **Neutrals & Surfaces:**
  - **App Canvas Background:** `#F8FAFC` (Slate-50)
  - **Card / Surface Background:** `#FFFFFF` (Pure White)
  - **Primary Text:** `#0F172A` (Slate-900)
  - **Secondary Text / Subtitles:** `#64748B` (Slate-500)
  - **Muted Text / Placeholders:** `#94A3B8` (Slate-400)
  - **Borders & Dividers:** `#E2E8F0` (Slate-200)

### 2.2 Typography Hierarchy
- **Font Family:** `Inter`, `system-ui`, or platform default (`Roboto` on Android, `San Francisco` on iOS).
- **Display / Headers:** `20px` to `24px`, SemiBold (600) or Bold (700).
- **Section Titles:** `16px` to `18px`, SemiBold (600).
- **Body Text:** `14px`, Regular (400) or Medium (500).
- **Captions & Metadata:** `12px`, Regular (400).
- **Badges / Status Chips:** `10px` to `11px`, Bold (700) or ExtraBold (800), Uppercase tracking.

### 2.3 Visual Elements & Geometry
- **Card Corners:** `16px` border radius (`rounded-2xl`).
- **Button Corners:** `12px` border radius (`rounded-xl`).
- **Pill Badges:** `9999px` border radius (`rounded-full`).
- **Shadows:** Soft diffuse drop shadows (Android `elevation: 2`, iOS `shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4`).
- **Icons:** Feather/Lucide styled stroke icons (`lucide-react-native`).

---

## 3. Screen-by-Screen Detailed Specifications

---

### SCREEN 1: Login & Authentication (`LoginScreen`)

#### Purpose
Secure entry into the enterprise application with role detection and credential caching.

#### Visual Elements
1. **Top Banner:** High-resolution image of sunset transmission towers with Adani logo overlay.
2. **Title Block:** "Adani Energy Solutions" with subtitle "Smart Meter Workforce Portal".
3. **Input 1 (User Identifier):**
   - Placeholder: "Employee ID or Mobile Number"
   - Left Icon: User / Smartphone icon
   - Validation: Required field.
4. **Input 2 (Password):**
   - Placeholder: "Enter your password"
   - Left Icon: Lock icon
   - Right Icon: Eye / Eye-Off toggle to reveal or mask characters.
5. **Remember Me & Forgot Password:**
   - Toggle/Checkbox: "Remember Me" (saves username to `AsyncStorage`).
   - Text Link: "Forgot Password?" (opens verification modal).
6. **Submit Button:**
   - Text: "Sign In to Operations Portal"
   - Style: Full-width `#1E63F0` background, white bold text, spinner during submission.
7. **Demo Role Quick-Switcher (Testing Mode):**
   - Quick-fill buttons for demo credentials (Technician, Supervisor, Admin).

#### Business Logic & Native Behavior
- On submit: Calls `POST /auth/login`.
- Saves JWT Bearer token into Secure Store / `AsyncStorage`.
- Stores user profile (`role`, `assignedSiteId`, `assignedSiteName`, `employeeId`).
- If user role is `admin`, navigates to Admin Stack; otherwise navigates to Technician Tab Navigator.

---

### SCREEN 2: Technician Home Dashboard (`DashboardScreen`)

#### Purpose
Primary operational cockpit for field engineers, displaying today's shift status, digital clock, quick actions, and assigned site preview.

#### Visual Elements
1. **Header App Bar:**
   - User Avatar with initials or photo.
   - Technician Name and Employee ID (e.g., `Rohit Sharma • b4S/Adani/01`).
   - Designation chip ("Field Technician") and Assigned Substation Pill with green online dot.
2. **Live Digital Clock Card:**
   - Real-time digital clock updating every second (HH:MM:SS AM/PM).
   - Current Date: (e.g., "Saturday, 24 October 2026").
3. **Shift Status Card (Dynamic 3-State Card):**
   - **State A: Not Checked In**
     - Amber theme banner: "Shift Not Started".
     - Message: "You have not marked attendance for today yet."
     - Action CTA: Green prominent "Punch In / Check In" button.
   - **State B: Active Shift (On Duty)**
     - Green theme banner with pulsing dot: "Active Shift (On Duty)".
     - Live Shift Stopwatch: Elapsed working hours (e.g., `05h 24m 12s`).
     - Check-In Timestamp: (e.g., `10:24 AM at Pune - Phase 1`).
     - Action CTA: Red "Shift Check-Out" button.
   - **State C: Shift Completed (Checked Out)**
     - Slate/Blue theme banner: "Shift Completed Today".
     - Summary: Check-in `10:24 AM` • Check-out `06:15 PM` • Total: `7h 51m`.
     - Status: Green "Present" badge.
4. **Today's Stats Summary Row (3 Mini Cards):**
   - Card 1: Check-in Time.
   - Card 2: Check-out Time.
   - Card 3: Working Hours tally.
5. **Quick Action Grid (2x2 or 2x3 Grid):**
   - 🟢 **Field Check-In:** Navigate to Check-In screen.
   - 🔴 **Shift Check-Out:** Navigate to Check-Out screen.
   - ⏱️ **Today's Summary:** Navigate to Attendance details.
   - 📅 **Attendance History:** Navigate to Monthly calendar/history.
   - 📍 **Assigned Substation:** View substation specs & directions.
   - 💵 **Salary Slip:** View monthly earnings & payslip download.
6. **Assigned Substation Mini-Card:**
   - Substation Name (e.g., "Pune - Phase 1 Substation").
   - Site Code (`ADN-PS-001`).
   - Distance from current GPS position (e.g., `240 m away`).
   - "Get Directions" button to launch native navigation apps.

---

### SCREEN 3: Field Check-In (`CheckInScreen`)

#### Purpose
GPS-verified on-site punch-in with mandatory selfie/camera verification and geofence distance calculation.

#### Visual Elements
1. **Header:** "Field Attendance Check-In" with back button.
2. **Assigned Site Card:**
   - Displays target substation name, code, and address.
   - Dropdown site selector (if user is assigned to multiple substations).
3. **GPS Geofence Status Card:**
   - Animated satellite radar pulse indicator.
   - Live coordinates: Latitude, Longitude, and GPS Accuracy (meters).
   - Distance indicator: "Distance to Substation: XX meters".
   - **Proximity Pill:**
     - 🟢 **Inside Geofence:** "Verified Inside Geofence (Within 500m)"
     - 🔴 **Outside Geofence:** "Outside Substation Geofence (Distance > 500m)"
4. **Mandatory Verification Photo Section:**
   - If no photo: Placeholder box with Camera icon and "Take Verification Photo" button.
   - On tap: Launches device camera directly.
   - If photo captured: Square preview of photo, timestamp watermark, and "Retake / Delete" button.
   - Note label: "* Front-facing field selfie required for attendance approval."
5. **Optional Remarks Input:**
   - Text field: "Add operational shift notes (Optional)".
6. **Main Punch Button:**
   - Label: "Confirm & Punch In"
   - Disabled state: Greyed out if photo has not been captured.
   - Active state: Large green gradient button with tactile haptic feedback.

#### Business Logic & Rules
- Requests `ACCESS_FINE_LOCATION` and `CAMERA` permissions.
- Calculates distance using Haversine formula between device location and site coordinates.
- Validates that photo file size is under 10MB.
- Submits `POST /attendance/check-in` with payload:
  `{ siteId, latitude, longitude, accuracy, photoBase64, remarks }`.
- Auto-updates local shift status in storage.

---

### SCREEN 4: Shift Check-Out (`CheckOutScreen`)

#### Purpose
Formal departure and shift conclusion with working hours tally and early departure restriction.

#### Visual Elements
1. **Header:** "Shift Check-Out & Departure".
2. **Shift Elapsed Summary Card:**
   - Check-in timestamp and origin substation.
   - Total hours and minutes worked during the shift.
3. **Shift Timing Rule Banner:**
   - **Rule:** Standard technician shifts conclude at **06:00 PM (18:00)**.
   - If current time < 18:00: Shows amber warning card:
     *"Early Departure Warning: Shift scheduled until 06:00 PM. Early check-out requires supervisor approval."*
   - Note: Supervisors and Admins have permission to override the 6:00 PM limitation.
4. **Live Check-Out GPS Status:**
   - Current device coordinates.
   - Distance from morning check-in point.
5. **Confirmation Modal / Bottom Sheet:**
   - Prompts: *"Are you sure you want to conclude your shift?"*
   - Displays summary: Total working duration (e.g. `8h 12m`).
   - Actions: "Cancel" vs Red "Confirm Check-Out" button.

#### Business Logic
- Submits `POST /attendance/check-out` with current coordinates.
- Purges temporary verification image from device memory.
- Updates daily status to `checked_out`.

---

### SCREEN 5: Today's Shift Audit (`AttendanceScreen`)

#### Purpose
Detailed breakdown of the day's attendance record for auditing and employee transparency.

#### Visual Elements
1. **Attendance Status Banner:**
   - Big Status Chip: `PRESENT` (Green), `LATE` (Amber), `HALF DAY` (Orange), or `ABSENT` (Red).
   - Date and day of week.
2. **Timeline Cards:**
   - **Punch In:** Time (e.g., `10:24 AM`), GPS Coordinates, Substation name.
   - **Punch Out:** Time (e.g., `06:15 PM`), GPS Coordinates.
   - **Net Working Time:** e.g., `7 hrs 51 mins` (vs standard 8-hour shift).
3. **Verification Snapshot:**
   - Thumbnail of the check-in photo.
   - Tap to expand full screen.
4. **Location Verification Badge:**
   - Confirms: "Geofence Compliance: Verified within 500m radius of Substation".
5. **Map Snapshot:**
   - Mini map displaying check-in pin and check-out pin.

---

### SCREEN 6: Monthly Attendance History (`HistoryScreen`)

#### Purpose
Calendar and list view of historical attendance, working hours, and monthly payroll readiness.

#### Visual Elements
1. **Segmented Control:** Tabs for `Daily`, `Weekly`, and `Monthly`.
2. **Month Selector Bar:**
   - Left arrow (`<`), Month Name ("October 2026"), Right arrow (`>`).
3. **Monthly KPI Counter Strip (Horizontal Scroll or 4-Card Grid):**
   - Total Working Days: `24`
   - Days Present: `22`
   - Days Absent: `1`
   - Half Days / Late: `1`
   - Total Hours Logged: `176 hrs`
4. **Attendance List / Cards (Grouped by Date):**
   - Each card displays:
     - Date number & Day (e.g. `24 Fri`).
     - Status Badge (`Present`, `Absent`, `Half Day`, `Holiday`, `Weekly Off`).
     - In-Time and Out-Time.
     - Total duration bar (visual percentage of 8h standard).
   - Tapping an item opens a **Shift Detail Modal** with GPS coordinates, site name, and verification photo.

---

### SCREEN 7: Salary & Payslips (`SalaryScreen`)

#### Purpose
Transparency in employee compensation, attendance-based salary calculations, and downloadable payslips.

#### Visual Elements
1. **Month & Year Selector:** Dropdown or carousel (e.g., "October 2026").
2. **Net Take-Home Pay Card:**
   - Large bold figure (e.g., `₹ 28,450`).
   - Subtitle: "Net Payable for October 2026".
   - Status Tag: `PAID` (Green) or `PROCESSING` (Amber).
3. **Days Summary Pill:**
   - `26 Payable Days` • `22 Present` • `4 Paid Leaves / Offs` • `0 Loss of Pay`.
4. **Earnings Table / Section:**
   - Basic Salary
   - House Rent Allowance (HRA)
   - Dearness Allowance (DA)
   - Conveyance / Travel Allowance
   - Site Field Allowance
   - **Total Gross Earnings**
5. **Deductions Table / Section:**
   - Provident Fund (PF) (12%)
   - Employee State Insurance (ESIC) (0.75%)
   - Professional Tax (PT)
   - TDS / Tax Deducted at Source
   - **Total Deductions**
6. **Action Buttons:**
   - "Download Pay Slip (PDF)"
   - "Share via WhatsApp / Email"

---

### SCREEN 8: Assigned Substation & Directions (`SiteDetailsScreen`)

#### Purpose
Complete operational specifications of the assigned power substation, safety guidelines, manager contacts, and direct GPS navigation.

#### Visual Elements
1. **Substation Photo Banner:** Picture of electrical transformer yard / control room.
2. **Title Block:** Substation Name, Facility Code (`ADN-PS-001`), Voltage Class (`220/33 kV`).
3. **Address & Geolocation:**
   - Full street address with landmark.
   - Latitude & Longitude badge.
4. **Site Manager Card:**
   - Manager Name (e.g., "Suresh Patil - Operations Lead").
   - Action Button 1: **"Call Manager"** (launches native phone dialer).
   - Action Button 2: **"Email Lead"** (launches native mail client).
5. **Interactive Map:**
   - Pin at Substation coordinates.
   - Shaded circle representing the 500m geofence radius.
   - User's live location blue dot.
6. **Action CTA:**
   - Big `#1E63F0` button: **"Get Turn-by-Turn Directions"**
   - Automatically opens Google Maps or Apple Maps with destination pre-filled.

---

### SCREEN 9: Admin Operations Hub (`AdminDashboardScreen`)

#### Purpose
Executive overview of workforce telemetry, attendance rates, and operational status for supervisors and admins.

#### Visual Elements
1. **4 Top KPI Cards:**
   - **Total Field Staff:** Total employees registered (e.g. `48`).
   - **Currently Present:** Number & % checked in today (e.g. `42 (87%)`).
   - **Absent / Off-Duty:** Employees not reported (e.g. `6`).
   - **Completed Shift:** Technicians checked out (e.g. `14`).
2. **Operational Charts:**
   - Attendance Trend (Weekly bar chart: Mon - Sat).
   - Workforce Status Donut (Present vs Late vs Absent).
3. **Real-Time Live Punch Stream:**
   - Feed of the latest check-in events.
   - Displays technician name, photo thumbnail, site name, punch time, and inside/outside geofence tag.
4. **Quick Navigation Tiles:**
   - "Manage Employees"
   - "Substations & Geofences"
   - "Fleet Radar Map"
   - "Export Attendance Reports"

---

### SCREEN 10: Employee Management (`EmployeesScreen`)

#### Purpose
Admin CRUD interface to manage workforce records, credentials, and substation assignments.

#### Visual Elements
1. **Search & Filter Bar:**
   - Search input (by Name, Employee ID, or Phone).
   - Filter chips: All, Active, Inactive, Technicians, Supervisors.
2. **"+ Add Employee" Floating Action Button or Top Action:**
   - Modal form: Full Name, Employee ID, Mobile Number, Password, Role, Assigned Substation(s).
3. **Employee Card List:**
   - Avatar with initials.
   - Name and Employee ID.
   - Assigned Substation pill.
   - Status badge (Active in green, Inactive in red).
   - Context Menu (3 dots): Edit details, Reassign Substation, Reset Password, Delete/Deactivate.

---

### SCREEN 11: Fleet Radar & Live Map Tracking (`TrackingScreen`)

#### Purpose
GIS map tracking field technicians across power substations.

#### Visual Elements
1. **Interactive Full-Screen Map (`react-native-maps`):**
   - Substation markers with 500m geofence circles.
   - Technician markers:
     - 🟢 Green Pin: Punched in & currently on-site.
     - 🟡 Amber Pin: Punched in but outside geofence.
     - ⚪ Grey Pin: Checked out / Offline.
2. **Bottom Sheet / Drawer:**
   - List of technicians with search filter.
   - Tapping any technician animates and zooms the map to their current location.
   - Displays their check-in time and distance from assigned substation.

---

### SCREEN 12: Reports & Excel Export (`ReportsScreen`)

#### Purpose
Data filtering and automated `.xlsx` spreadsheet generation.

#### Visual Elements
1. **Filter Controls:**
   - Date Range: "From Date" and "To Date" date pickers.
   - Substation Selector: "All Sites" or specific substation.
   - Status Selector: "All Statuses", "Present", "Absent", "Late".
2. **Live Data Table:**
   - Preview of matching records (Date, Employee ID, Name, In-Time, Out-Time, Site, Status).
3. **Primary Action:**
   - **"Export to Excel (.xlsx)"** button.
   - Downloads spreadsheet and triggers native Share Sheet (WhatsApp, Google Drive, Gmail).

---

## 4. Mobile Hardware & Native Permissions

Configure these native permissions in your React Native project:

### Android (`android/app/src/main/AndroidManifest.xml`)
```xml
<!-- High-precision GPS Geofencing -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Camera for Verification Selfie -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

<!-- Storage & Network -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.VIBRATE" />
```

### iOS (`ios/Podfile` & `Info.plist`)
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Adani Smart Meter App requires your GPS location to verify attendance within substation geofence boundaries.</string>

<key>NSCameraUsageDescription</key>
<string>Adani Smart Meter App requires camera access to take a live verification selfie when marking attendance.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Required to attach site verification photos.</string>
```

---

## 5. Core Business Logic & Algorithms

### 5.1 Haversine Distance Formula (500m Geofence Engine)
Used in Check-In and Check-Out to verify distance to the substation:

$$\Delta\phi = \frac{(\text{lat}_2 - \text{lat}_1) \cdot \pi}{180}, \quad \Delta\lambda = \frac{(\text{lon}_2 - \text{lon}_1) \cdot \pi}{180}$$

$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\left(\frac{\text{lat}_1 \cdot \pi}{180}\right) \cdot \cos\left(\frac{\text{lat}_2 \cdot \pi}{180}\right) \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$

$$c = 2 \cdot \text{atan2}(\sqrt{a}, \sqrt{1 - a})$$

$$\text{Distance (meters)} = R \cdot c \quad \text{where } R = 6,371,000 \text{ meters}$$

- **Condition:** If $\text{Distance} \le \text{Site.radiusMeters}$ (default 500m), status is **VERIFIED INSIDE GEOFENCE**.
- **Exception:** If $\text{Distance} > 500\text{m}$, UI displays warning and marks check-in as out-of-boundary.

### 5.2 Shift Timing Rules
- **Standard Shift Start:** `09:30 AM` (Grace period up to `09:45 AM`; punches after 09:45 AM are flagged as `LATE`).
- **Standard Shift End:** `06:00 PM (18:00)`.
- **Early Checkout Restriction:** Check-out is restricted before 18:00 unless the user has role `supervisor` or `admin`.
- **Minimum Shift Duration:**
  - $\ge 8\text{ hours}$: Full Day Present
  - $4\text{ to }7.9\text{ hours}$: Half Day
  - $< 4\text{ hours}$: Incomplete / Absent

---

## 6. Mobile Application Navigation Hierarchy

```
NavigationContainer
├── AuthStack (Shown when user is logged out)
│   ├── LoginScreen
│   └── ForgotPasswordModal
│
└── AppStack (Shown when user is authenticated)
    ├── TechnicianTabNavigator (Bottom Tabs for Technicians & Supervisors)
    │   ├── Tab 1: DashboardScreen (Home, digital clock, quick actions)
    │   ├── Tab 2: CheckInScreen (GPS satellite radar, camera selfie)
    │   ├── Tab 3: CheckOutScreen (Shift conclusion & duration)
    │   ├── Tab 4: AttendanceScreen (Today's shift audit)
    │   └── Tab 5: HistoryScreen (Monthly attendance logs)
    │
    ├── AdminTabNavigator (Bottom Tabs when user.role === 'admin')
    │   ├── Tab 1: AdminDashboardScreen (KPI metrics & charts)
    │   ├── Tab 2: EmployeesScreen (Staff directory & CRUD)
    │   ├── Tab 3: SitesScreen (Substations & geofence radius)
    │   ├── Tab 4: TrackingScreen (Live fleet radar map)
    │   └── Tab 5: ReportsScreen (Date range filters & Excel export)
    │
    └── Modal & Detail Stack Screens
        ├── SiteDetailsScreen (Substation specs, call lead, directions)
        ├── SalaryScreen (Earnings, deductions, PDF pay slip)
        └── ProfileSettingsScreen (App info, cache, logout)
```

---

## 7. Backend REST API Reference

Your React Native application connects directly to the existing FastAPI backend:

### 1. Authentication
- `POST /auth/login`
  - Body: `{ "username": "b4S/Adani/01", "password": "password123" }`
  - Response: `{ "access_token": "jwt_string", "token_type": "bearer", "user": { ... } }`
- `GET /auth/me`
  - Headers: `Authorization: Bearer <token>`
  - Response: Authenticated user profile, role, assigned sites.

### 2. Attendance & Geofencing
- `POST /attendance/check-in`
  - Body:
    ```json
    {
      "siteId": "site_pune_1",
      "latitude": 18.59127,
      "longitude": 73.73891,
      "accuracy": 12.5,
      "photoBase64": "data:image/jpeg;base64,...",
      "remarks": "On site for smart meter rollout"
    }
    ```
- `POST /attendance/check-out`
  - Body:
    ```json
    {
      "latitude": 18.59130,
      "longitude": 73.73888,
      "accuracy": 10.0
    }
    ```
- `GET /attendance/today`
  - Response: Today's check-in/out timestamps, duration, status, and verification image URL.
- `GET /attendance/history?month=10&year=2026`
  - Response: Array of daily shift logs for the specified month.

### 3. Substations & Sites
- `GET /sites`
  - Response: List of all operational substations, codes, coordinates, and geofence radii.
- `POST /sites` (Admin/Supervisor)
  - Body: `{ "name": "...", "code": "...", "latitude": 18.59, "longitude": 73.73, "radius": 500, "manager": "..." }`

### 4. Salary & Payroll
- `GET /salary/slip/{employeeId}?month=10&year=2026`
  - Response: Breakdown of Basic, HRA, DA, PF, ESIC, Net Salary, and attendance days.
- `GET /salary/summary?month=10&year=2026`
  - Response: Monthly company-wide payroll aggregate.

### 5. Fleet Telemetry & Reports (Admin)
- `GET /dashboard/stats`
  - Response: Counts for Total Staff, Present, Absent, and Checked Out.
- `GET /locations/live`
  - Response: Latest GPS positions of active field engineers.
- `GET /reports/export?from=2026-10-01&to=2026-10-31`
  - Response: Binary `.xlsx` Excel spreadsheet.

---

## 8. Offline & Edge Case Handling Guidelines

1. **No Network / Offline Mode:**
   - Cache user profile, assigned site coordinates, and current shift state in `AsyncStorage`.
   - If offline when checking in, store punch record with timestamp and base64 photo in an **offline queue**, and sync automatically when internet connectivity returns.
2. **GPS Accuracy & Spoofing Protection:**
   - Check `location.mocked` or `isFromMockProvider` to detect fake GPS location apps.
   - If GPS accuracy is $> 50$ meters, prompt the user to step into an open area for a more accurate satellite fix.
3. **Low Battery / Background Privacy:**
   - The app uses **on-demand GPS only** during punch-in and punch-out. It does **not** track continuous background location, protecting technician battery life and privacy.

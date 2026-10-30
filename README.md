# Adani Smart Meter Workforce & Attendance Management Platform

Production-ready cross-platform mobile application and enterprise FastAPI backend for high-voltage electricity substation and smart meter workforce attendance management.

---

## ⚡ Technology Architecture

```text
React Native Mobile App (Expo SDK 58 + TypeScript)
        ↓
    Axios + SecureStore JWT Auth Interceptor
        ↓
FastAPI REST API (Port 8000)
        ↓
Firebase Cloud Firestore (adani-energy) + Local SQLite Queue
        ↓
Firebase Storage / Local Managed File Storage (Verification Selfies & Payslips)
```

- **Frontend**: React Native, Expo, TypeScript, React Navigation (Tabs + Stacks), Zustand, Axios, Firebase JS SDK, react-native-maps, Expo Camera, Expo Location, Expo SecureStore, Expo SQLite, Expo Haptics, Expo Sharing.
- **Backend**: Python 3.10+, FastAPI, Firebase Admin / Google Cloud Firestore, Pydantic, Python-JOSE (JWT), passlib/bcrypt, openpyxl for styled Excel report generation.

---

## 👥 User Roles & Demo Credentials

Three distinct roles are configured out-of-the-box:

| Role | Username / Employee ID | Password | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Field Technician** | `b4S/Adani/01` | `password` | Dashboard, 500m Geofenced Check-In, Verification Selfie, Shift Check-Out, Today's Summary & Radar, Attendance History, Assigned Substation, Salary Slip (Net ₹28,450) |
| **Zonal Supervisor** | `b4S/Adani/02` | `password` | All Technician features + Zonal Team Overview, Managed Substations, Shift Timing Override |
| **Operations Admin** | `b4S/Adani/03` | `password` | Command & Control Dashboard, Employee Management (CRUD), Substation Geofence Management (100m–2000m), Fleet Radar Live Telemetry, Excel Compliance Reports |

---

## 🧭 Application Structure

```text
e:/comp-proj-app/
├── backend/
│   ├── app/
│   │   ├── core/           # Config, JWT Security, Database & Seeds
│   │   ├── models/         # Data models
│   │   ├── schemas/        # Pydantic validation schemas
│   │   ├── routers/        # Auth, Attendance, Sites, Employees, Salary, Dashboard, Tracking, Reports
│   │   ├── services/       # Geofence, Attendance, Salary, Storage, Report services
│   │   ├── utils/          # Haversine distance, Shift datetime rules
│   │   └── main.py         # FastAPI application entry point
│   ├── requirements.txt
│   └── .env
│
└── mobile/
    ├── src/
    │   ├── components/     # AppButton, AppInput, AppCard, StatusBadge, LoadingSpinner, EmptyState, KPICard, BottomSheet, SiteCard, AttendanceCard, EmployeeCard
    │   ├── screens/
    │   │   ├── auth/       # LoginScreen, ForgotPasswordScreen
    │   │   ├── technician/ # DashboardScreen, CheckInScreen, CheckOutScreen, TodayAttendanceScreen, HistoryScreen, SalaryScreen, SiteDetailsScreen
    │   │   ├── supervisor/ # SupervisorTeamScreen
    │   │   ├── admin/      # AdminDashboardScreen, EmployeesScreen, SitesScreen, TrackingScreen, ReportsScreen
    │   │   └── common/     # ProfileScreen
    │   ├── navigation/     # RootNavigator, AuthNavigator, TechnicianNavigator, AdminNavigator
    │   ├── services/       # Axios API client, Auth, Attendance, Sites, Employees, Salary, Dashboard, Reports
    │   ├── store/          # Zustand useAuthStore, useAttendanceStore
    │   ├── utils/          # Haversine formula, Haptics, SQLite offline queue
    │   ├── constants/      # Adani brand theme, color tokens (#1E63F0, #1541A7, #22C55E, etc.), shadows, typography
    │   ├── types/          # TypeScript interfaces & models
    │   └── config/         # App network configuration
    ├── App.tsx             # Root SafeAreaProvider + NavigationContainer
    └── package.json
```

---

## 🚀 Running Locally

### 1. Start the FastAPI Backend

```bash
cd backend
# Activate virtual environment
.\venv\Scripts\activate
# Start server with hot-reload
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- API Base URL: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

### 2. Start the React Native Mobile Application

```bash
cd mobile
# Start Expo development server
npm start

# For Android Emulator
npm run android

# For iOS Simulator (macOS)
npm run ios

# For Web Browser preview
npm run web
```

---

## 🔒 Security, Geofencing & Offline Integrity

1. **Server-Side Geofence Validation**: Device-side GPS is calculated via Haversine formula, and the server independently re-calculates the distance and strictly enforces the substation radius (`<= 500m`).
2. **GPS Anti-Spoofing & Accuracy Filter**: Rejects mock locations (`isMocked`) and GPS accuracy worse than 50 meters.
3. **Mandatory Photo Verification**: Front-facing selfie photo is validated on-device and stored via server storage with maximum 10MB threshold.
4. **Offline Resilience**: When internet connectivity drops, punch transactions and photo references are saved to a local SQLite database queue (`attendance_queue`) and synced automatically when network restores.
5. **No Client Secrets**: React Native code communicates exclusively with the FastAPI layer; no database credentials or private API keys are bundled inside client code.

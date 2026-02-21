import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, RequireAdmin } from './auth/AuthProvider'
import AdminLogin from './auth/AdminLogin'
import ResetPassword from './auth/ResetPassword'
import Dashboard from './Dashboard'
import CustomerForm from './CustomerForm'
import QuotePreview from './QuotePreview'
import CleanerPortal from './CleanerPortal'
import FloorPlanPage from './clients/FloorPlanPage'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login"            element={<AdminLogin />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/form"       element={<CustomerForm />} />
          <Route path="/quote/:id"  element={<QuotePreview />} />
          <Route path="/cleaner"    element={<CleanerPortal />} />
          <Route path="/" element={<Navigate to="/dashboard/today" replace />} />
          <Route path="/dashboard/clients/:id/floorplan" element={
            <RequireAdmin>
              <FloorPlanPage />
            </RequireAdmin>
          } />

          {/* Protected admin route */}
          <Route path="/dashboard/*" element={
            <RequireAdmin>
              <Dashboard />
            </RequireAdmin>
          } />
          <Route path="/*" element={<Navigate to="/dashboard/today" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)

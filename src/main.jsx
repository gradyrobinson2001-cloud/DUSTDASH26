import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, RequireAdmin } from './auth/AuthProvider'
import AdminLogin from './auth/AdminLogin'
import Dashboard from './Dashboard'
import CustomerForm from './CustomerForm'
import QuotePreview from './QuotePreview'
import CleanerPortal from './CleanerPortal'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login"      element={<AdminLogin />} />
          <Route path="/form"       element={<CustomerForm />} />
          <Route path="/quote/:id"  element={<QuotePreview />} />
          <Route path="/cleaner"    element={<CleanerPortal />} />

          {/* Protected admin route */}
          <Route path="/*" element={
            <RequireAdmin>
              <Dashboard />
            </RequireAdmin>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)

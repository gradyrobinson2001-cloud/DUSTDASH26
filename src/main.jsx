import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import CustomerForm from './CustomerForm'
import QuotePreview from './QuotePreview'
import CleanerPortal from './CleanerPortal'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/form" element={<CustomerForm />} />
        <Route path="/quote/:id" element={<QuotePreview />} />
        <Route path="/cleaner" element={<CleanerPortal />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)

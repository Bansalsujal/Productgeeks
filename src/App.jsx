import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/Home'
import InterviewPage from './pages/Interview'
import FeedbackPage from './pages/Feedback'
import ProfilePage from './pages/Profile'
import { Toaster } from './components/ui/toaster'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/interview" element={<InterviewPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </Layout>
      <Toaster />
    </Router>
  )
}

export default App
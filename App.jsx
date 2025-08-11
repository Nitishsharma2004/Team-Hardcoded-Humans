import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import CreateTripPage from './pages/CreateTripPage';
import MyTripsPage from './pages/MyTripsPage';
import ItineraryBuilderPage from './pages/ItineraryBuilderPage';
import ItineraryViewPage from './pages/ItineraryViewPage';
import SearchPage from './pages/SearchPage';
import BudgetPage from './pages/BudgetPage';
import PublicItineraryPage from './pages/PublicItineraryPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/public/:tripId" element={<PublicItineraryPage />} />
              
              {/* Protected Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/create-trip" element={
                <ProtectedRoute>
                  <CreateTripPage />
                </ProtectedRoute>
              } />
              <Route path="/my-trips" element={
                <ProtectedRoute>
                  <MyTripsPage />
                </ProtectedRoute>
              } />
              <Route path="/trip/:tripId/builder" element={
                <ProtectedRoute>
                  <ItineraryBuilderPage />
                </ProtectedRoute>
              } />
              <Route path="/trip/:tripId/view" element={
                <ProtectedRoute>
                  <ItineraryViewPage />
                </ProtectedRoute>
              } />
              <Route path="/search" element={
                <ProtectedRoute>
                  <SearchPage />
                </ProtectedRoute>
              } />
              <Route path="/budget/:tripId" element={
                <ProtectedRoute>
                  <BudgetPage />
                </ProtectedRoute>
              } />
              
              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

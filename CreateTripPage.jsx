import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getDateRangeInclusive } from '../utils/helpers';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export function CreateTripPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    tripName: '',
    description: '',
    coverPhotoUrl: '',
    startDate: new Date(),
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    isPublic: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleDateChange = (field, date) => {
    setFormData(prev => ({
      ...prev,
      [field]: date
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.tripName.trim()) {
      setError('Trip name is required');
      return;
    }

    if (formData.tripName.length < 3) {
      setError('Trip name must be at least 3 characters long');
      return;
    }

    if (formData.startDate >= formData.endDate) {
      setError('End date must be after start date');
      return;
    }

    try {
      setLoading(true);

      // Create trip document
      const tripRef = await addDoc(collection(db, 'trips'), {
        userId: currentUser.uid,
        tripName: formData.tripName.trim(),
        description: formData.description.trim(),
        coverPhotoUrl: formData.coverPhotoUrl.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        isPublic: formData.isPublic,
        createdAt: serverTimestamp(),
      });

      // Create itinerary documents for each day
      const dateRange = getDateRangeInclusive(formData.startDate, formData.endDate);
      
      for (let i = 0; i < dateRange.length; i++) {
        await addDoc(collection(db, 'itineraries'), {
          tripId: tripRef.id,
          day: i + 1,
          date: dateRange[i],
          cities: [],
          activities: [],
          createdAt: serverTimestamp(),
        });
      }

      // Navigate to itinerary builder
      navigate(`/trip/${tripRef.id}/builder`);
    } catch (error) {
      console.error('Error creating trip:', error);
      setError('Failed to create trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create a New Trip</h1>
        <p className="text-gray-600">Plan your next adventure with GlobeTrotter</p>
      </div>

      <div className="card p-8">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-red-700 text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Trip Name */}
          <div>
            <label htmlFor="tripName" className="form-label">Trip Name *</label>
            <input
              id="tripName"
              name="tripName"
              type="text"
              value={formData.tripName}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g., Summer in Europe, Japan Adventure, Road Trip West Coast"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="form-label">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input-field"
              rows={4}
              placeholder="Tell us about your trip... What are your goals? Who's traveling with you? Any special interests or themes?"
            />
          </div>

          {/* Cover Photo */}
          <div>
            <label htmlFor="coverPhotoUrl" className="form-label">Cover Photo URL (optional)</label>
            <input
              id="coverPhotoUrl"
              name="coverPhotoUrl"
              type="url"
              value={formData.coverPhotoUrl}
              onChange={handleChange}
              className="input-field"
              placeholder="https://example.com/image.jpg"
            />
            <p className="mt-1 text-xs text-gray-500">
              Add a beautiful image to represent your trip
            </p>
          </div>

          {/* Date Range */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="startDate" className="form-label">Start Date *</label>
              <DatePicker
                selected={formData.startDate}
                onChange={(date) => handleDateChange('startDate', date)}
                selectsStart
                startDate={formData.startDate}
                endDate={formData.endDate}
                minDate={new Date()}
                className="input-field"
                dateFormat="MMMM d, yyyy"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="form-label">End Date *</label>
              <DatePicker
                selected={formData.endDate}
                onChange={(date) => handleDateChange('endDate', date)}
                selectsEnd
                startDate={formData.startDate}
                endDate={formData.endDate}
                minDate={formData.startDate}
                className="input-field"
                dateFormat="MMMM d, yyyy"
              />
            </div>
          </div>

          {/* Trip Duration Info */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2 text-blue-800">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">
                Trip Duration: {Math.ceil((formData.endDate - formData.startDate) / (1000 * 60 * 60 * 24))} days
              </span>
            </div>
          </div>

          {/* Public/Private */}
          <div className="flex items-center space-x-3">
            <input
              id="isPublic"
              name="isPublic"
              type="checkbox"
              checked={formData.isPublic}
              onChange={handleChange}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="isPublic" className="text-sm text-gray-700">
              Make this trip public (others can view and copy it)
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating Trip...</span>
                </div>
              ) : (
                'Create Trip & Start Planning'
              )}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-secondary px-8 py-3 text-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTripPage;

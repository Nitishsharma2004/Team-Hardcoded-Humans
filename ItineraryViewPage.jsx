import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner, PageLoader } from '../components/LoadingSpinner';
import { formatDate, formatCurrency } from '../utils/helpers';

const ItineraryViewPage = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [trip, setTrip] = useState(null);
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [selectedDay, setSelectedDay] = useState(null);
  const [mapCenter, setMapCenter] = useState([51.505, -0.09]); // Default to London
  const [mapZoom, setMapZoom] = useState(10);

  useEffect(() => {
    if (!tripId || !currentUser) return;

    const unsubscribeTrip = onSnapshot(
      doc(db, 'trips', tripId),
      (doc) => {
        if (doc.exists()) {
          const tripData = doc.data();
          if (tripData.userId === currentUser.uid) {
            setTrip(tripData);
          } else {
            setError('You do not have permission to view this trip');
            setLoading(false);
          }
        } else {
          setError('Trip not found');
          setLoading(false);
        }
      },
      (error) => {
        setError('Error loading trip: ' + error.message);
        setLoading(false);
      }
    );

    const unsubscribeItineraries = onSnapshot(
      collection(db, 'itineraries'),
      (querySnapshot) => {
        const itinerariesData = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(item => item.tripId === tripId)
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        setItineraries(itinerariesData);
        
        // Set map center based on first activity with location
        if (itinerariesData.length > 0) {
          const firstDay = itinerariesData[0];
          if (firstDay.activities && firstDay.activities.length > 0) {
            const firstActivity = firstDay.activities[0];
            if (firstActivity.location) {
              // In a real app, you'd geocode the location
              // For now, we'll use a placeholder
              setMapCenter([51.505, -0.09]);
            }
          }
        }
        
        setLoading(false);
      },
      (error) => {
        setError('Error loading itineraries: ' + error.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeTrip();
      unsubscribeItineraries();
    };
  }, [tripId, currentUser]);

  const getTotalCost = () => {
    return itineraries.reduce((total, day) => {
      return total + (day.activities || []).reduce((dayTotal, activity) => {
        return dayTotal + (activity.cost || 0);
      }, 0);
    }, 0);
  };

  const getActivityCount = () => {
    return itineraries.reduce((total, day) => {
      return total + (day.activities || []).length;
    }, 0);
  };

  const getCategoryBreakdown = () => {
    const categories = {};
    itineraries.forEach(day => {
      (day.activities || []).forEach(activity => {
        const category = activity.category || 'activity';
        categories[category] = (categories[category] || 0) + 1;
      });
    });
    return categories;
  };

  if (loading) return <PageLoader />;
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error}</div>
          <button
            onClick={() => navigate('/my-trips')}
            className="btn-primary"
          >
            Back to My Trips
          </button>
        </div>
      </div>
    );
  }

  if (!trip) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {trip.name} - Itinerary
            </h1>
            <p className="text-gray-600">
              {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/trip/${tripId}/builder`)}
              className="btn-primary"
            >
              Edit Itinerary
            </button>
            <button
              onClick={() => navigate(`/budget/${tripId}`)}
              className="btn-secondary"
            >
              Budget
            </button>
          </div>
        </div>

        {/* Trip Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-primary">{itineraries.length}</div>
            <div className="text-sm text-gray-600">Days</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-primary">{getActivityCount()}</div>
            <div className="text-sm text-gray-600">Activities</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-primary">{formatCurrency(getTotalCost())}</div>
            <div className="text-sm text-gray-600">Total Cost</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-primary">{trip.isPublic ? 'Public' : 'Private'}</div>
            <div className="text-sm text-gray-600">Status</div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">View Options</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Calendar View
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Itinerary Content */}
        <div className="lg:col-span-2">
          {viewMode === 'list' ? (
            /* List View */
            <div className="space-y-6">
              {itineraries.map((day, dayIndex) => (
                <div key={day.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-primary to-primary-dark p-4 text-white">
                    <div className="flex items-center gap-3">
                      <div className="bg-white bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                        {dayIndex + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{day.title}</h3>
                        <p className="text-sm opacity-90">{formatDate(day.date)}</p>
                      </div>
                    </div>
                    {day.description && (
                      <p className="mt-2 text-sm opacity-90">{day.description}</p>
                    )}
                  </div>

                  <div className="p-4">
                    {day.activities && day.activities.length > 0 ? (
                      <div className="space-y-3">
                        {day.activities.map((activity, activityIndex) => (
                          <div
                            key={activity.id}
                            className="border-l-4 border-primary bg-gray-50 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-semibold text-gray-900">
                                    {activity.name}
                                  </h4>
                                  <span className="px-2 py-1 bg-primary text-white text-xs rounded-full">
                                    {activity.category}
                                  </span>
                                </div>
                                {activity.description && (
                                  <p className="text-gray-600 text-sm mb-2">
                                    {activity.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  {activity.location && (
                                    <span>📍 {activity.location}</span>
                                  )}
                                  {activity.startTime && (
                                    <span>🕐 {activity.startTime}</span>
                                  )}
                                  {activity.endTime && (
                                    <span>🕐 {activity.endTime}</span>
                                  )}
                                  {activity.cost > 0 && (
                                    <span>💰 {formatCurrency(activity.cost)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No activities planned for this day</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {itineraries.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🗺️</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No Itinerary Yet
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Start building your itinerary to see it here
                  </p>
                  <button
                    onClick={() => navigate(`/trip/${tripId}/builder`)}
                    className="btn-primary"
                  >
                    Build Itinerary
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Calendar View */
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Calendar View</h3>
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 p-2">
                    {day}
                  </div>
                ))}
                
                {/* Calendar days would go here */}
                <div className="text-center text-gray-400 p-2">
                  Calendar implementation would go here
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Map Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Trip Map</h3>
              <p className="text-sm text-gray-600">View your trip locations</p>
            </div>
            <div className="h-96">
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {itineraries.map((day) => (
                  (day.activities || []).map((activity, activityIndex) => (
                    activity.location && (
                      <Marker
                        key={`${day.id}-${activity.id}`}
                        position={mapCenter} // In real app, geocode the location
                      >
                        <Popup>
                          <div>
                            <h4 className="font-semibold">{activity.name}</h4>
                            <p className="text-sm text-gray-600">{day.title}</p>
                            <p className="text-sm text-gray-500">{activity.location}</p>
                            {activity.startTime && (
                              <p className="text-sm text-gray-500">🕐 {activity.startTime}</p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    )
                  ))
                ))}
              </MapContainer>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-lg shadow-lg mt-6 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Categories</h3>
            <div className="space-y-3">
              {Object.entries(getCategoryBreakdown()).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="capitalize text-gray-700">{category}</span>
                  <span className="bg-primary text-white px-2 py-1 rounded-full text-sm">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-lg mt-6 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate(`/trip/${tripId}/builder`)}
                className="w-full btn-primary text-sm"
              >
                Edit Itinerary
              </button>
              <button
                onClick={() => navigate(`/budget/${tripId}`)}
                className="w-full btn-secondary text-sm"
              >
                View Budget
              </button>
              {trip.isPublic && (
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/public/${tripId}`)}
                  className="w-full btn-secondary text-sm"
                >
                  Copy Share Link
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItineraryViewPage;

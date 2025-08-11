import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner, PageLoader } from '../components/LoadingSpinner';
import { formatDate, formatCurrency, generateId } from '../utils/helpers';

const PublicItineraryPage = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [trip, setTrip] = useState(null);
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [mapCenter, setMapCenter] = useState([51.505, -0.09]);
  const [mapZoom, setMapZoom] = useState(10);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (!tripId) return;

    // Set the share URL
    setShareUrl(`${window.location.origin}/public/${tripId}`);

    const unsubscribeTrip = onSnapshot(
      doc(db, 'trips', tripId),
      (doc) => {
        if (doc.exists()) {
          const tripData = doc.data();
          if (tripData.isPublic) {
            setTrip(tripData);
          } else {
            setError('This trip is private and cannot be viewed');
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
  }, [tripId]);

  const copyTrip = async () => {
    if (!currentUser) {
      navigate('/login', { state: { redirect: `/public/${tripId}` } });
      return;
    }

    setCopying(true);
    try {
      // Create a new trip based on the public one
      const newTripData = {
        name: `${trip.name} (Copy)`,
        description: trip.description,
        startDate: trip.startDate,
        endDate: trip.endDate,
        coverPhoto: trip.coverPhoto,
        isPublic: false,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        copiedFrom: tripId
      };

      const newTripRef = await addDoc(collection(db, 'trips'), newTripData);

      // Copy all itineraries
      for (const itinerary of itineraries) {
        const newItineraryData = {
          tripId: newTripRef.id,
          date: itinerary.date,
          title: itinerary.title,
          description: itinerary.description,
          activities: itinerary.activities || [],
          order: itinerary.order,
          createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'itineraries'), newItineraryData);
      }

      setCopySuccess(true);
      setTimeout(() => {
        setShowCopyModal(false);
        setCopySuccess(false);
        navigate(`/trip/${newTripRef.id}/builder`);
      }, 2000);
    } catch (error) {
      setError('Error copying trip: ' + error.message);
    } finally {
      setCopying(false);
    }
  };

  const shareToSocial = (platform) => {
    const text = `Check out this amazing trip: ${trip.name}`;
    const url = shareUrl;

    let shareUrl;
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
        break;
      default:
        return;
    }

    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      // Show a brief success message
      const originalText = 'Copy Link';
      const button = document.getElementById('copy-link-btn');
      if (button) {
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

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
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Back to Home
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
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {trip.name}
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
          </p>
          {trip.description && (
            <p className="text-gray-600 max-w-2xl mx-auto">{trip.description}</p>
          )}
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
            <div className="text-2xl font-bold text-primary">Public</div>
            <div className="text-sm text-gray-600">Status</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          <button
            onClick={() => setShowCopyModal(true)}
            className="btn-primary"
          >
            🗂️ Copy This Trip
          </button>
          <button
            onClick={copyToClipboard}
            id="copy-link-btn"
            className="btn-secondary"
          >
            🔗 Copy Link
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
            className="btn-secondary"
          >
            {viewMode === 'list' ? '📅 Calendar View' : '📋 List View'}
          </button>
        </div>

        {/* Social Sharing */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Share This Trip</h3>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => shareToSocial('twitter')}
              className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
              title="Share on Twitter"
            >
              🐦
            </button>
            <button
              onClick={() => shareToSocial('facebook')}
              className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              title="Share on Facebook"
            >
              📘
            </button>
            <button
              onClick={() => shareToSocial('linkedin')}
              className="p-3 bg-blue-700 text-white rounded-full hover:bg-blue-800 transition-colors"
              title="Share on LinkedIn"
            >
              💼
            </button>
            <button
              onClick={() => shareToSocial('whatsapp')}
              className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
              title="Share on WhatsApp"
            >
              📱
            </button>
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
                    No Itinerary Available
                  </h3>
                  <p className="text-gray-600 mb-6">
                    This trip doesn't have any planned activities yet
                  </p>
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
              <p className="text-sm text-gray-600">View trip locations</p>
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

          {/* Trip Info */}
          <div className="bg-white rounded-lg shadow-lg mt-6 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Trip Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">{itineraries.length} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Cost:</span>
                <span className="font-medium">{formatCurrency(getTotalCost())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Activities:</span>
                <span className="font-medium">{getActivityCount()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="font-medium">{formatDate(trip.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copy Trip Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Copy This Trip</h3>
            <p className="text-gray-600 mb-6">
              {currentUser 
                ? "This will create a copy of this trip in your account. You can then modify it as needed."
                : "You need to be logged in to copy this trip. We'll redirect you to the login page."
              }
            </p>
            
            {copySuccess ? (
              <div className="text-center">
                <div className="text-6xl mb-4">✅</div>
                <h4 className="text-lg font-semibold text-green-600 mb-2">Trip Copied Successfully!</h4>
                <p className="text-gray-600">Redirecting to your copy...</p>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={copyTrip}
                  disabled={copying}
                  className="btn-primary flex-1"
                >
                  {copying ? <LoadingSpinner size="sm" /> : 'Copy Trip'}
                </button>
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicItineraryPage;

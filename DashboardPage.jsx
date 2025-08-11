import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatDate } from '../utils/helpers';
import { LoadingSpinner, PageLoader } from '../components/LoadingSpinner';

export function DashboardPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'trips'),
      where('userId', '==', currentUser.uid),
      orderBy('startDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tripsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTrips(tripsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const recommendedDestinations = [
    { name: 'Kyoto', country: 'Japan', image: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&h=300&fit=crop' },
    { name: 'Lisbon', country: 'Portugal', image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&h=300&fit=crop' },
    { name: 'Vancouver', country: 'Canada', image: 'https://images.unsplash.com/photo-1545586592-807bcd35f6b0?w=400&h=300&fit=crop' },
    { name: 'Cusco', country: 'Peru', image: 'https://images.unsplash.com/photo-1582036398427-19f63d2a9c41?w=400&h=300&fit=crop' }
  ];

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Traveler'}! 👋
        </h1>
        <p className="text-gray-600 text-lg">
          Ready to plan your next adventure? Let's get started!
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => navigate('/create-trip')}
            className="btn-primary px-6 py-3 text-lg flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Plan New Trip</span>
          </button>
          
          <Link to="/search" className="btn-secondary px-6 py-3 text-lg flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Search Destinations</span>
          </Link>
        </div>
      </div>

      {/* Recent Trips */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Your Recent Trips</h2>
          <Link to="/my-trips" className="text-primary-600 hover:text-primary-700 font-medium">
            View all trips →
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No trips yet</h3>
            <p className="text-gray-600 mb-4">Start planning your first adventure!</p>
            <button
              onClick={() => navigate('/create-trip')}
              className="btn-primary"
            >
              Create Your First Trip
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.slice(0, 6).map((trip) => (
              <div key={trip.id} className="card p-6 hover:shadow-lg transition-shadow duration-200">
                {trip.coverPhotoUrl ? (
                  <img 
                    src={trip.coverPhotoUrl} 
                    alt={trip.tripName}
                    className="w-full h-40 object-cover rounded-lg mb-4"
                  />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-primary-100 to-travel-100 rounded-lg mb-4 flex items-center justify-center">
                    <svg className="w-16 h-16 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                    </svg>
                  </div>
                )}
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{trip.tripName}</h3>
                <p className="text-sm text-gray-600 mb-3">
                  {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                </p>
                
                {trip.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{trip.description}</p>
                )}

                <div className="flex gap-2">
                  <Link 
                    to={`/trip/${trip.id}/builder`} 
                    className="btn-secondary text-sm px-3 py-2"
                  >
                    Edit
                  </Link>
                  <Link 
                    to={`/trip/${trip.id}/view`} 
                    className="btn-primary text-sm px-3 py-2"
                  >
                    View
                  </Link>
                  <Link 
                    to={`/budget/${trip.id}`} 
                    className="bg-travel-600 text-white text-sm px-3 py-2 rounded-md hover:bg-travel-700 transition-colors"
                  >
                    Budget
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recommended Destinations */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Recommended Destinations</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {recommendedDestinations.map((destination, index) => (
            <div key={index} className="card overflow-hidden hover:shadow-lg transition-shadow duration-200">
              <img 
                src={destination.image} 
                alt={destination.name}
                className="w-full h-32 object-cover"
              />
              <div className="p-4">
                <h3 className="font-semibold text-gray-900">{destination.name}</h3>
                <p className="text-sm text-gray-600">{destination.country}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Stats */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Your Travel Stats</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="card p-6 text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">{trips.length}</div>
            <div className="text-gray-600">Total Trips</div>
          </div>
          <div className="card p-6 text-center">
            <div className="text-3xl font-bold text-travel-600 mb-2">
              {trips.filter(trip => trip.isPublic).length}
            </div>
            <div className="text-gray-600">Public Trips</div>
          </div>
          <div className="card p-6 text-center">
            <div className="text-3xl font-bold text-gray-600 mb-2">
              {trips.filter(trip => {
                const startDate = trip.startDate?.toDate ? trip.startDate.toDate() : new Date(trip.startDate);
                return startDate > new Date();
              }).length}
            </div>
            <div className="text-gray-600">Upcoming Trips</div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatDate } from '../utils/helpers';
import { LoadingSpinner, PageLoader } from '../components/LoadingSpinner';

export function MyTripsPage() {
  const { currentUser } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(null);

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

  const handleDelete = async (tripId) => {
    if (!window.confirm('Are you sure you want to delete this trip? This action cannot be undone and will also delete all associated itineraries.')) {
      return;
    }

    try {
      setDeleteLoading(tripId);
      
      // Delete all itineraries for this trip
      const itinerariesQuery = query(
        collection(db, 'itineraries'),
        where('tripId', '==', tripId)
      );
      
      const itinerariesSnapshot = await itinerariesQuery.get();
      const deletePromises = itinerariesSnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(deletePromises);
      
      // Delete the trip
      await deleteDoc(doc(db, 'trips', tripId));
      
    } catch (error) {
      console.error('Error deleting trip:', error);
      alert('Failed to delete trip. Please try again.');
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Trips</h1>
        <p className="text-gray-600">Manage and organize all your travel plans</p>
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">No trips yet</h3>
          <p className="text-gray-600 mb-6">Start planning your first adventure!</p>
          <Link to="/create-trip" className="btn-primary">
            Create Your First Trip
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => (
            <div key={trip.id} className="card p-6 hover:shadow-lg transition-shadow duration-200">
              {/* Cover Image */}
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
              
              {/* Trip Info */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{trip.tripName}</h3>
                <p className="text-sm text-gray-600 mb-2">
                  {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                </p>
                
                {trip.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">{trip.description}</p>
                )}
              </div>

              {/* Status Badge */}
              <div className="mb-4">
                {trip.isPublic ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Public
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Private
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Link 
                  to={`/trip/${trip.id}/builder`} 
                  className="btn-secondary text-sm px-3 py-2 flex-1 text-center"
                >
                  Edit
                </Link>
                <Link 
                  to={`/trip/${trip.id}/view`} 
                  className="btn-primary text-sm px-3 py-2 flex-1 text-center"
                >
                  View
                </Link>
                <Link 
                  to={`/budget/${trip.id}`} 
                  className="bg-travel-600 text-white text-sm px-3 py-2 rounded-md hover:bg-travel-700 transition-colors flex-1 text-center"
                >
                  Budget
                </Link>
                <button
                  onClick={() => handleDelete(trip.id)}
                  disabled={deleteLoading === trip.id}
                  className="btn-danger text-sm px-3 py-2 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteLoading === trip.id ? (
                    <div className="flex items-center justify-center space-x-1">
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-12 text-center">
        <Link to="/create-trip" className="btn-primary px-8 py-3 text-lg">
          Plan Another Trip
        </Link>
      </div>
    </div>
  );
}

export default MyTripsPage;

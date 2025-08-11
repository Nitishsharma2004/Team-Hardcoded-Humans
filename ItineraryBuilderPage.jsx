import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, onSnapshot, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner, PageLoader } from '../components/LoadingSpinner';
import { generateId, formatDate } from '../utils/helpers';

const ItineraryBuilderPage = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [trip, setTrip] = useState(null);
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingActivity, setEditingActivity] = useState(null);
  const [editingDay, setEditingDay] = useState(null);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddDay, setShowAddDay] = useState(false);
  const [newActivity, setNewActivity] = useState({
    name: '',
    description: '',
    location: '',
    startTime: '',
    endTime: '',
    cost: '',
    category: 'activity'
  });
  const [newDay, setNewDay] = useState({
    date: '',
    title: '',
    description: ''
  });

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
            setError('You do not have permission to edit this trip');
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

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'day') {
      // Reorder days
      const reorderedItineraries = Array.from(itineraries);
      const [removed] = reorderedItineraries.splice(source.index, 1);
      reorderedItineraries.splice(destination.index, 0, removed);

      // Update order in Firestore
      const updates = reorderedItineraries.map((item, index) => 
        updateDoc(doc(db, 'itineraries', item.id), { order: index })
      );
      
      try {
        await Promise.all(updates);
      } catch (error) {
        setError('Error reordering days: ' + error.message);
      }
    } else if (type === 'activity') {
      // Reorder activities within a day or move between days
      const sourceDayId = source.droppableId;
      const destDayId = destination.droppableId;
      
      if (sourceDayId === destDayId) {
        // Reorder within same day
        const day = itineraries.find(item => item.id === sourceDayId);
        if (!day || !day.activities) return;

        const reorderedActivities = Array.from(day.activities);
        const [removed] = reorderedActivities.splice(source.index, 1);
        reorderedActivities.splice(destination.index, 0, removed);

        try {
          await updateDoc(doc(db, 'itineraries', sourceDayId), {
            activities: reorderedActivities
          });
        } catch (error) {
          setError('Error reordering activities: ' + error.message);
        }
      } else {
        // Move activity between days
        const sourceDay = itineraries.find(item => item.id === sourceDayId);
        const destDay = itineraries.find(item => item.id === destDayId);
        
        if (!sourceDay || !destDay) return;

        const sourceActivities = Array.from(sourceDay.activities || []);
        const destActivities = Array.from(destDay.activities || []);
        
        const [movedActivity] = sourceActivities.splice(source.index, 1);
        destActivities.splice(destination.index, 0, movedActivity);

        try {
          await Promise.all([
            updateDoc(doc(db, 'itineraries', sourceDayId), {
              activities: sourceActivities
            }),
            updateDoc(doc(db, 'itineraries', destDayId), {
              activities: destActivities
            })
          ]);
        } catch (error) {
          setError('Error moving activity: ' + error.message);
        }
      }
    }
  };

  const addNewDay = async () => {
    if (!newDay.date || !newDay.title) return;

    try {
      const dayData = {
        tripId,
        date: newDay.date,
        title: newDay.title,
        description: newDay.description,
        activities: [],
        order: itineraries.length,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'itineraries'), dayData);
      setNewDay({ date: '', title: '', description: '' });
      setShowAddDay(false);
    } catch (error) {
      setError('Error adding day: ' + error.message);
    }
  };

  const addNewActivity = async (dayId) => {
    if (!newActivity.name || !newActivity.startTime) return;

    try {
      const day = itineraries.find(item => item.id === dayId);
      if (!day) return;

      const activityData = {
        id: generateId(),
        ...newActivity,
        cost: parseFloat(newActivity.cost) || 0
      };

      const updatedActivities = [...(day.activities || []), activityData];
      
      await updateDoc(doc(db, 'itineraries', dayId), {
        activities: updatedActivities
      });

      setNewActivity({
        name: '',
        description: '',
        location: '',
        startTime: '',
        endTime: '',
        cost: '',
        category: 'activity'
      });
      setShowAddActivity(false);
    } catch (error) {
      setError('Error adding activity: ' + error.message);
    }
  };

  const updateActivity = async (dayId, activityId, updates) => {
    try {
      const day = itineraries.find(item => item.id === dayId);
      if (!day) return;

      const updatedActivities = day.activities.map(activity =>
        activity.id === activityId ? { ...activity, ...updates } : activity
      );

      await updateDoc(doc(db, 'itineraries', dayId), {
        activities: updatedActivities
      });

      setEditingActivity(null);
    } catch (error) {
      setError('Error updating activity: ' + error.message);
    }
  };

  const deleteActivity = async (dayId, activityId) => {
    try {
      const day = itineraries.find(item => item.id === dayId);
      if (!day) return;

      const updatedActivities = day.activities.filter(
        activity => activity.id !== activityId
      );

      await updateDoc(doc(db, 'itineraries', dayId), {
        activities: updatedActivities
      });
    } catch (error) {
      setError('Error deleting activity: ' + error.message);
    }
  };

  const updateDay = async (dayId, updates) => {
    try {
      await updateDoc(doc(db, 'itineraries', dayId), updates);
      setEditingDay(null);
    } catch (error) {
      setError('Error updating day: ' + error.message);
    }
  };

  const deleteDay = async (dayId) => {
    try {
      await deleteDoc(doc(db, 'itineraries', dayId));
    } catch (error) {
      setError('Error deleting day: ' + error.message);
    }
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
              {trip.name} - Itinerary Builder
            </h1>
            <p className="text-gray-600">
              {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/trip/${tripId}/view`)}
              className="btn-secondary"
            >
              View Itinerary
            </button>
            <button
              onClick={() => navigate(`/budget/${tripId}`)}
              className="btn-secondary"
            >
              Budget
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Trip Overview</h2>
            <button
              onClick={() => setShowAddDay(true)}
              className="btn-primary"
            >
              Add Day
            </button>
          </div>
          <p className="text-gray-600">{trip.description}</p>
        </div>
      </div>

      {/* Add Day Modal */}
      {showAddDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Day</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newDay.date}
                  onChange={(e) => setNewDay({ ...newDay, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newDay.title}
                  onChange={(e) => setNewDay({ ...newDay, title: e.target.value })}
                  placeholder="e.g., Day 1 - Arrival"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newDay.description}
                  onChange={(e) => setNewDay({ ...newDay, description: e.target.value })}
                  placeholder="Optional description for this day"
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={addNewDay}
                className="btn-primary flex-1"
              >
                Add Day
              </button>
              <button
                onClick={() => setShowAddDay(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Itinerary Days */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="days" type="day">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-6"
            >
              {itineraries.map((day, dayIndex) => (
                <Draggable key={day.id} draggableId={day.id} index={dayIndex}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="bg-white rounded-lg shadow-lg overflow-hidden"
                    >
                      {/* Day Header */}
                      <div
                        {...provided.dragHandleProps}
                        className="bg-gradient-to-r from-primary to-primary-dark p-4 text-white cursor-move"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-white bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                              {dayIndex + 1}
                            </div>
                            <div>
                              {editingDay === day.id ? (
                                <input
                                  type="text"
                                  value={day.title}
                                  onChange={(e) => updateDay(day.id, { title: e.target.value })}
                                  className="bg-white bg-opacity-20 rounded px-2 py-1 text-white font-semibold"
                                  onBlur={() => setEditingDay(null)}
                                  onKeyPress={(e) => e.key === 'Enter' && setEditingDay(null)}
                                />
                              ) : (
                                <h3 
                                  className="text-lg font-semibold cursor-pointer"
                                  onClick={() => setEditingDay(day.id)}
                                >
                                  {day.title}
                                </h3>
                              )}
                              <p className="text-sm opacity-90">
                                {formatDate(day.date)}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowAddActivity(day.id)}
                              className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded px-3 py-1 text-sm transition-colors"
                            >
                              + Activity
                            </button>
                            <button
                              onClick={() => deleteDay(day.id)}
                              className="bg-red-500 hover:bg-red-600 rounded px-3 py-1 text-sm transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {day.description && (
                          <p className="mt-2 text-sm opacity-90">{day.description}</p>
                        )}
                      </div>

                      {/* Activities */}
                      <div className="p-4">
                        <Droppable droppableId={day.id} type="activity">
                          {(provided) => (
                            <div
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className="space-y-3"
                            >
                              {day.activities && day.activities.map((activity, activityIndex) => (
                                <Draggable
                                  key={activity.id}
                                  draggableId={activity.id}
                                  index={activityIndex}
                                >
                                  {(provided) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className="bg-gray-50 rounded-lg p-4 border-l-4 border-primary cursor-move"
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          {editingActivity === activity.id ? (
                                            <div className="space-y-3">
                                              <input
                                                type="text"
                                                value={activity.name}
                                                onChange={(e) => updateActivity(day.id, activity.id, { name: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                placeholder="Activity name"
                                              />
                                              <textarea
                                                value={activity.description}
                                                onChange={(e) => updateActivity(day.id, activity.id, { description: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                placeholder="Description"
                                                rows="2"
                                              />
                                              <div className="grid grid-cols-2 gap-3">
                                                <input
                                                  type="text"
                                                  value={activity.location}
                                                  onChange={(e) => updateActivity(day.id, activity.id, { location: e.target.value })}
                                                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                  placeholder="Location"
                                                />
                                                <input
                                                  type="number"
                                                  value={activity.cost}
                                                  onChange={(e) => updateActivity(day.id, activity.id, { cost: parseFloat(e.target.value) || 0 })}
                                                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                  placeholder="Cost"
                                                />
                                              </div>
                                              <div className="grid grid-cols-2 gap-3">
                                                <input
                                                  type="time"
                                                  value={activity.startTime}
                                                  onChange={(e) => updateActivity(day.id, activity.id, { startTime: e.target.value })}
                                                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                />
                                                <input
                                                  type="time"
                                                  value={activity.endTime}
                                                  onChange={(e) => updateActivity(day.id, activity.id, { endTime: e.target.value })}
                                                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                />
                                              </div>
                                              <div className="flex gap-2">
                                                <button
                                                  onClick={() => setEditingActivity(null)}
                                                  className="btn-secondary text-sm"
                                                >
                                                  Save
                                                </button>
                                                <button
                                                  onClick={() => setEditingActivity(null)}
                                                  className="btn-secondary text-sm"
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div>
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
                                                  <span>💰 ${activity.cost}</span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex gap-2 ml-4">
                                          <button
                                            onClick={() => setEditingActivity(activity.id)}
                                            className="text-primary hover:text-primary-dark transition-colors"
                                          >
                                            ✏️
                                          </button>
                                          <button
                                            onClick={() => deleteActivity(day.id, activity.id)}
                                            className="text-red-500 hover:text-red-600 transition-colors"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>

                        {(!day.activities || day.activities.length === 0) && (
                          <div className="text-center py-8 text-gray-500">
                            <p>No activities planned for this day</p>
                            <button
                              onClick={() => setShowAddActivity(day.id)}
                              className="text-primary hover:text-primary-dark mt-2"
                            >
                              + Add your first activity
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Activity Modal */}
      {showAddActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Activity</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Activity Name
                </label>
                <input
                  type="text"
                  value={newActivity.name}
                  onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                  placeholder="e.g., Visit Eiffel Tower"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  placeholder="Optional description"
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={newActivity.location}
                    onChange={(e) => setNewActivity({ ...newActivity, location: e.target.value })}
                    placeholder="e.g., Paris, France"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newActivity.category}
                    onChange={(e) => setNewActivity({ ...newActivity, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="activity">Activity</option>
                    <option value="food">Food</option>
                    <option value="transport">Transport</option>
                    <option value="accommodation">Accommodation</option>
                    <option value="shopping">Shopping</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newActivity.startTime}
                    onChange={(e) => setNewActivity({ ...newActivity, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newActivity.endTime}
                    onChange={(e) => setNewActivity({ ...newActivity, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Cost ($)
                </label>
                <input
                  type="number"
                  value={newActivity.cost}
                  onChange={(e) => setNewActivity({ ...newActivity, cost: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => addNewActivity(showAddActivity)}
                className="btn-primary flex-1"
              >
                Add Activity
              </button>
              <button
                onClick={() => setShowAddActivity(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {itineraries.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Start Building Your Itinerary
          </h3>
          <p className="text-gray-600 mb-6">
            Add days to your trip and start planning your activities
          </p>
          <button
            onClick={() => setShowAddDay(true)}
            className="btn-primary"
          >
            Add Your First Day
          </button>
        </div>
      )}
    </div>
  );
};

export default ItineraryBuilderPage;

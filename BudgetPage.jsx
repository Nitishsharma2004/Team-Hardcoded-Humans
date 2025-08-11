import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, updateDoc } from 'firebase/firestore';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner, PageLoader } from '../components/LoadingSpinner';
import { formatDate, formatCurrency, calculateTotalCost, getCostBreakdown, isOverBudget } from '../utils/helpers';

const BudgetPage = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [trip, setTrip] = useState(null);
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [budget, setBudget] = useState(0);
  const [editingBudget, setEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState('');
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'daily', 'category'
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    if (!tripId || !currentUser) return;

    const unsubscribeTrip = onSnapshot(
      doc(db, 'trips', tripId),
      (doc) => {
        if (doc.exists()) {
          const tripData = doc.data();
          if (tripData.userId === currentUser.uid) {
            setTrip(tripData);
            setBudget(tripData.budget || 0);
            setNewBudget(tripData.budget || 0);
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

  const updateBudget = async () => {
    if (!newBudget || isNaN(newBudget)) return;

    try {
      await updateDoc(doc(db, 'trips', tripId), {
        budget: parseFloat(newBudget)
      });
      setBudget(parseFloat(newBudget));
      setEditingBudget(false);
    } catch (error) {
      setError('Error updating budget: ' + error.message);
    }
  };

  const getTotalCost = () => {
    return calculateTotalCost(itineraries);
  };

  const getCostBreakdownData = () => {
    return getCostBreakdown(itineraries);
  };

  const getDailyCosts = () => {
    return itineraries.map(day => ({
      day: day.title,
      date: formatDate(day.date),
      cost: (day.activities || []).reduce((total, activity) => total + (activity.cost || 0), 0),
      activities: day.activities?.length || 0
    }));
  };

  const getCategoryCosts = () => {
    const categories = {};
    itineraries.forEach(day => {
      (day.activities || []).forEach(activity => {
        const category = activity.category || 'activity';
        categories[category] = (categories[category] || 0) + (activity.cost || 0);
      });
    });

    return Object.entries(categories).map(([category, cost]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      cost,
      percentage: (cost / getTotalCost()) * 100
    }));
  };

  const getBudgetStatus = () => {
    const totalCost = getTotalCost();
    const remaining = budget - totalCost;
    const percentage = budget > 0 ? (totalCost / budget) * 100 : 0;

    if (percentage >= 100) {
      return { status: 'over', color: 'text-red-600', bgColor: 'bg-red-100' };
    } else if (percentage >= 80) {
      return { status: 'warning', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    } else {
      return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-100' };
    }
  };

  const getBudgetAlerts = () => {
    const alerts = [];
    const totalCost = getTotalCost();
    const remaining = budget - totalCost;

    if (budget > 0) {
      if (remaining < 0) {
        alerts.push({
          type: 'error',
          message: `You're ${formatCurrency(Math.abs(remaining))} over budget!`,
          icon: '⚠️'
        });
      } else if (remaining < budget * 0.1) {
        alerts.push({
          type: 'warning',
          message: `Only ${formatCurrency(remaining)} remaining in your budget`,
          icon: '⚠️'
        });
      }
    }

    // Check for expensive activities
    itineraries.forEach(day => {
      (day.activities || []).forEach(activity => {
        if (activity.cost > budget * 0.2 && budget > 0) {
          alerts.push({
            type: 'info',
            message: `${activity.name} costs ${formatCurrency(activity.cost)} (${((activity.cost / budget) * 100).toFixed(1)}% of budget)`,
            icon: '💡'
          });
        }
      });
    });

    return alerts;
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

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

  const budgetStatus = getBudgetStatus();
  const budgetAlerts = getBudgetAlerts();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {trip.name} - Budget
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
              onClick={() => navigate(`/trip/${tripId}/builder`)}
              className="btn-primary"
            >
              Edit Itinerary
            </button>
          </div>
        </div>

        {/* Budget Overview Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Budget Overview</h2>
            <button
              onClick={() => setEditingBudget(true)}
              className="text-primary hover:text-primary-dark"
            >
              ✏️ Edit
            </button>
          </div>
          
          {editingBudget ? (
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Budget
                </label>
                <input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  placeholder="Enter budget amount"
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={updateBudget}
                  className="btn-primary text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingBudget(false);
                    setNewBudget(budget);
                  }}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(budget)}</div>
                <div className="text-sm text-gray-600">Total Budget</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{formatCurrency(getTotalCost())}</div>
                <div className="text-sm text-gray-600">Total Spent</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${budgetStatus.color}`}>
                  {formatCurrency(budget - getTotalCost())}
                </div>
                <div className="text-sm text-gray-600">Remaining</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${budgetStatus.color}`}>
                  {budget > 0 ? ((getTotalCost() / budget) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-sm text-gray-600">Used</div>
              </div>
            </div>
          )}
        </div>

        {/* Budget Alerts */}
        {budgetAlerts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Budget Alerts</h3>
            <div className="space-y-2">
              {budgetAlerts.map((alert, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border-l-4 ${
                    alert.type === 'error' ? 'border-red-500 bg-red-50' :
                    alert.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{alert.icon}</span>
                    <span className="text-sm">{alert.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Mode Toggle */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Budget Analysis</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('overview')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'overview'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setViewMode('daily')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'daily'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Daily Breakdown
              </button>
              <button
                onClick={() => setViewMode('category')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'category'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                By Category
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Charts and Data */}
        <div className="lg:col-span-2">
          {viewMode === 'overview' && (
            <div className="space-y-6">
              {/* Cost Breakdown Chart */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getCategoryCosts()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ category, percentage }) => `${category} ${percentage.toFixed(1)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="cost"
                      >
                        {getCategoryCosts().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Budget vs Actual Chart */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      {
                        name: 'Budget',
                        planned: budget,
                        actual: getTotalCost()
                      }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="planned" fill="#8884d8" name="Planned Budget" />
                      <Bar dataKey="actual" fill="#82ca9d" name="Actual Spending" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'daily' && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Cost Breakdown</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getDailyCosts()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="cost" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-6 space-y-3">
                {getDailyCosts().map((day, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{day.day}</div>
                      <div className="text-sm text-gray-600">{day.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-primary">{formatCurrency(day.cost)}</div>
                      <div className="text-sm text-gray-600">{day.activities} activities</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'category' && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost by Category</h3>
              <div className="space-y-4">
                {getCategoryCosts().map((category, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <div>
                        <div className="font-medium text-gray-900">{category.category}</div>
                        <div className="text-sm text-gray-600">{category.percentage.toFixed(1)}% of total</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-primary">{formatCurrency(category.cost)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          {/* Budget Status */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Status</h3>
            <div className={`p-4 rounded-lg ${budgetStatus.bgColor} mb-4`}>
              <div className="text-center">
                <div className={`text-2xl font-bold ${budgetStatus.color} mb-2`}>
                  {budgetStatus.status === 'over' ? 'Over Budget' :
                   budgetStatus.status === 'warning' ? 'Warning' : 'On Track'}
                </div>
                <div className="text-sm text-gray-600">
                  {budgetStatus.status === 'over' ? 'Consider adjusting your plans' :
                   budgetStatus.status === 'warning' ? 'Watch your spending' : 'Great job staying within budget!'}
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Budget Used:</span>
                <span className="font-medium">{budget > 0 ? ((getTotalCost() / budget) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    budgetStatus.status === 'over' ? 'bg-red-500' :
                    budgetStatus.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((getTotalCost() / budget) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Top Expenses */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Expenses</h3>
            <div className="space-y-3">
              {itineraries
                .flatMap(day => (day.activities || []).map(activity => ({ ...activity, day: day.title })))
                .filter(activity => activity.cost > 0)
                .sort((a, b) => b.cost - a.cost)
                .slice(0, 5)
                .map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{activity.name}</div>
                      <div className="text-sm text-gray-600">{activity.day}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-primary">{formatCurrency(activity.cost)}</div>
                      <div className="text-xs text-gray-500">{activity.category}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate(`/trip/${tripId}/builder`)}
                className="w-full btn-primary text-sm"
              >
                Add/Edit Activities
              </button>
              <button
                onClick={() => setEditingBudget(true)}
                className="w-full btn-secondary text-sm"
              >
                Adjust Budget
              </button>
              <button
                onClick={() => navigate(`/trip/${tripId}/view`)}
                className="w-full btn-secondary text-sm"
              >
                View Itinerary
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetPage;

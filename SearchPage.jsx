import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { geocodeCity, getAISuggestionsForCity, debounce } from '../utils/helpers';

const SearchPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('cities'); // 'cities' or 'activities'
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const saveSearch = (query, type) => {
    const newSearch = { query, type, timestamp: Date.now() };
    const updated = [newSearch, ...recentSearches.filter(s => s.query !== query)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const handleSearch = async (query = searchQuery) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (searchType === 'cities') {
        await searchCities(query);
      } else {
        await searchActivities(query);
      }
      
      saveSearch(query, searchType);
    } catch (error) {
      setError('Search failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const searchCities = async (query) => {
    try {
      // Search in Firestore trips collection for cities
      const tripsRef = collection(db, 'trips');
      const q = query(
        tripsRef,
        where('isPublic', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      const cities = new Set();
      
      querySnapshot.forEach((doc) => {
        const tripData = doc.data();
        // Extract cities from trip data (this would be more sophisticated in a real app)
        if (tripData.name.toLowerCase().includes(query.toLowerCase()) ||
            tripData.description.toLowerCase().includes(query.toLowerCase())) {
          cities.add(tripData.name.split(' ')[0]); // Simple city extraction
        }
      });

      // Also search in itineraries for activity locations
      const itinerariesRef = collection(db, 'itineraries');
      const itinerariesSnapshot = await getDocs(itinerariesRef);
      
      itinerariesSnapshot.forEach((doc) => {
        const itineraryData = doc.data();
        if (itineraryData.activities) {
          itineraryData.activities.forEach(activity => {
            if (activity.location && activity.location.toLowerCase().includes(query.toLowerCase())) {
              cities.add(activity.location.split(',')[0].trim());
            }
          });
        }
      });

      const results = Array.from(cities).map(city => ({
        id: city,
        name: city,
        type: 'city',
        description: `Discover amazing trips and activities in ${city}`,
        image: `https://source.unsplash.com/400x200/?${city}`,
        tripCount: Math.floor(Math.random() * 50) + 5 // Placeholder
      }));

      setSearchResults(results);
    } catch (error) {
      throw new Error('Failed to search cities: ' + error.message);
    }
  };

  const searchActivities = async (query) => {
    try {
      // Search in itineraries for activities
      const itinerariesRef = collection(db, 'itineraries');
      const itinerariesSnapshot = await getDocs(itinerariesRef);
      
      const activities = new Map();
      
      itinerariesSnapshot.forEach((doc) => {
        const itineraryData = doc.data();
        if (itineraryData.activities) {
          itineraryData.activities.forEach(activity => {
            if (activity.name.toLowerCase().includes(query.toLowerCase()) ||
                activity.description?.toLowerCase().includes(query.toLowerCase()) ||
                activity.category?.toLowerCase().includes(query.toLowerCase())) {
              
              if (!activities.has(activity.name)) {
                activities.set(activity.name, {
                  id: activity.name,
                  name: activity.name,
                  type: 'activity',
                  category: activity.category || 'activity',
                  description: activity.description || 'Amazing activity to try',
                  image: `https://source.unsplash.com/400x200/?${activity.name}`,
                  popularity: Math.floor(Math.random() * 100) + 1
                });
              }
            }
          });
        }
      });

      const results = Array.from(activities.values());
      setSearchResults(results);
    } catch (error) {
      throw new Error('Failed to search activities: ' + error.message);
    }
  };

  const getAISuggestions = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const suggestions = await getAISuggestionsForCity(searchQuery);
      setAiSuggestions(suggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = debounce(handleSearch, 300);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (value.trim()) {
      debouncedSearch(value);
    } else {
      setSearchResults([]);
    }
  };

  const handleResultClick = (result) => {
    if (result.type === 'city') {
      // Navigate to search results filtered by city
      navigate('/search', { 
        state: { 
          cityFilter: result.name,
          searchType: 'activities'
        }
      });
    } else {
      // Navigate to activity details or search results
      navigate('/search', { 
        state: { 
          activityFilter: result.name,
          searchType: 'cities'
        }
      });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setAiSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Discover Amazing Destinations
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Search for cities, activities, and get AI-powered travel suggestions to inspire your next adventure
        </p>
      </div>

      {/* Search Interface */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Search Type Toggle */}
          <div className="flex justify-center mb-6">
            <div className="bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSearchType('cities')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  searchType === 'cities'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🏙️ Cities
              </button>
              <button
                onClick={() => setSearchType('activities')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  searchType === 'activities'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🎯 Activities
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleInputChange}
                  placeholder={`Search for ${searchType === 'cities' ? 'cities and destinations' : 'activities and experiences'}...`}
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  🔍
                </div>
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={() => handleSearch()}
                disabled={!searchQuery.trim() || loading}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Search'}
              </button>
            </div>

            {/* AI Suggestions Button */}
            {searchQuery.trim() && searchType === 'cities' && (
              <div className="mt-3 text-center">
                <button
                  onClick={getAISuggestions}
                  disabled={loading}
                  className="text-primary hover:text-primary-dark text-sm font-medium flex items-center gap-2 mx-auto"
                >
                  🤖 Get AI Travel Suggestions
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Suggestions */}
      {showSuggestions && aiSuggestions.length > 0 && (
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              🤖 AI Travel Suggestions for {searchQuery}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aiSuggestions.map((suggestion, index) => (
                <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                  <h4 className="font-semibold text-gray-900 mb-2">{suggestion.title}</h4>
                  <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>⭐ {suggestion.rating}</span>
                    <span>💰 {suggestion.cost}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Search Results ({searchResults.length})
            </h2>
            <p className="text-gray-600">
              Found {searchResults.length} {searchType === 'cities' ? 'destinations' : 'activities'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((result) => (
              <div
                key={result.id}
                onClick={() => handleResultClick(result)}
                className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300"
              >
                <div className="h-48 overflow-hidden">
                  <img
                    src={result.image}
                    alt={result.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-primary text-white text-xs rounded-full">
                      {result.type}
                    </span>
                    {result.category && (
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full">
                        {result.category}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {result.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">
                    {result.description}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    {result.tripCount && (
                      <span>🗺️ {result.tripCount} trips</span>
                    )}
                    {result.popularity && (
                      <span>🔥 {result.popularity}% popular</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && searchResults.length === 0 && !loading && (
        <div className="max-w-4xl mx-auto">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Searches</h3>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => {
                  setSearchQuery(search.query);
                  setSearchType(search.type);
                  handleSearch(search.query);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors text-sm"
              >
                {search.query}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Popular Destinations */}
      {searchResults.length === 0 && !loading && (
        <div className="max-w-6xl mx-auto mt-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Popular Destinations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Paris', country: 'France', image: 'https://source.unsplash.com/400x300/?paris' },
              { name: 'Tokyo', country: 'Japan', image: 'https://source.unsplash.com/400x300/?tokyo' },
              { name: 'New York', country: 'USA', image: 'https://source.unsplash.com/400x300/?newyork' },
              { name: 'Barcelona', country: 'Spain', image: 'https://source.unsplash.com/400x300/?barcelona' }
            ].map((destination) => (
              <div
                key={destination.name}
                onClick={() => {
                  setSearchQuery(destination.name);
                  setSearchType('cities');
                  handleSearch(destination.name);
                }}
                className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300"
              >
                <div className="h-32 overflow-hidden">
                  <img
                    src={destination.image}
                    alt={destination.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4 text-center">
                  <h4 className="font-semibold text-gray-900">{destination.name}</h4>
                  <p className="text-sm text-gray-600">{destination.country}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {searchResults.length === 0 && searchQuery && !loading && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No results found for "{searchQuery}"
          </h3>
          <p className="text-gray-600 mb-6">
            Try adjusting your search terms or browse our popular destinations
          </p>
          <button
            onClick={clearSearch}
            className="btn-primary"
          >
            Clear Search
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchPage;

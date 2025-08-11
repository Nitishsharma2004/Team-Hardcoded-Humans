import { format, addDays, differenceInCalendarDays, parseISO, isAfter, isBefore } from 'date-fns';

/**
 * Creates an array of dates between start and end (inclusive)
 */
export function getDateRangeInclusive(start, end) {
  const days = [];
  let curr = new Date(start);
  while (curr <= end) {
    days.push(new Date(curr));
    curr = addDays(curr, 1);
  }
  return days;
}

/**
 * Format currency based on locale
 */
export function formatCurrency(value, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, { 
    style: 'currency', 
    currency: currency 
  }).format(value || 0);
}

/**
 * Format date for display
 */
export function formatDate(date, formatString = 'PP') {
  if (!date) return '-';
  if (date.toDate) return format(date.toDate(), formatString);
  if (date instanceof Date) return format(date, formatString);
  return format(parseISO(date), formatString);
}

/**
 * Geocode a city/country to coordinates using OpenStreetMap Nominatim
 */
export async function geocodeCity(name, country) {
  try {
    const q = encodeURIComponent(`${name}, ${country}`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
    const res = await fetch(url, { 
      headers: { 'Accept-Language': 'en' } 
    });
    const data = await res.json();
    
    if (data && data.length > 0) {
      return { 
        lat: parseFloat(data[0].lat), 
        lng: parseFloat(data[0].lon) 
      };
    }
  } catch (error) {
    console.warn('Geocoding failed:', error);
  }
  
  // Default coordinates if unknown
  return { lat: 0, lng: 0 };
}

/**
 * Simulate AI-powered suggestions for a city
 */
export async function getAISuggestionsForCity(cityName) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 600));
  
  const suggestions = [
    { 
      name: `Walking Tour of ${cityName}`, 
      type: 'activity', 
      time: '10:00', 
      cost: 0, 
      category: 'Activities' 
    },
    { 
      name: `Local Food Market - ${cityName}`, 
      type: 'food', 
      time: '13:00', 
      cost: 25, 
      category: 'Meals' 
    },
    { 
      name: `Museum Visit - ${cityName}`, 
      type: 'culture', 
      time: '15:00', 
      cost: 15, 
      category: 'Activities' 
    },
    { 
      name: `Evening Stroll in ${cityName}`, 
      type: 'activity', 
      time: '19:00', 
      cost: 0, 
      category: 'Activities' 
    }
  ];
  
  return suggestions;
}

/**
 * Generate a unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Debounce function for search inputs
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Calculate total trip cost
 */
export function calculateTotalCost(itineraries) {
  return itineraries.reduce((total, day) => {
    const dayCost = (day.activities || []).reduce((sum, activity) => {
      return sum + Number(activity.cost || 0);
    }, 0);
    return total + dayCost;
  }, 0);
}

/**
 * Get cost breakdown by category
 */
export function getCostBreakdown(itineraries) {
  const breakdown = {};
  
  itineraries.forEach(day => {
    (day.activities || []).forEach(activity => {
      const category = (activity.type || 'other').toLowerCase();
      breakdown[category] = (breakdown[category] || 0) + Number(activity.cost || 0);
    });
  });
  
  return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
}

/**
 * Check if a day exceeds budget
 */
export function isOverBudget(day, dailyBudget) {
  const dayCost = (day.activities || []).reduce((sum, activity) => {
    return sum + Number(activity.cost || 0);
  }, 0);
  return dayCost > dailyBudget;
}

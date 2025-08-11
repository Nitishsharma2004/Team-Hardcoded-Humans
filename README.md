# GlobeTrotter - Personalized Travel Planning

A full-stack, responsive web application for planning and organizing travel itineraries, inspired by Wanderlog.com.

## 🚀 Features

### Core Functionality
- **User Authentication**: Secure login/signup with Firebase Auth
- **Trip Management**: Create, edit, and organize travel plans
- **Itinerary Builder**: Drag-and-drop interface for day-by-day planning
- **Interactive Maps**: Visualize trips with Leaflet integration
- **Budget Tracking**: Charts and breakdowns for expense management
- **Real-time Collaboration**: Live updates using Firestore
- **Search & Discovery**: Find cities and activities
- **AI-Powered Suggestions**: Get recommendations for destinations
- **Public Sharing**: Share itineraries with unique URLs

### Technical Features
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Real-time Updates**: Firestore listeners for live collaboration
- **Drag & Drop**: Reorder days and activities seamlessly
- **Map Integration**: Interactive maps with markers and popups
- **Data Visualization**: Charts for budget analysis
- **Progressive Web App**: Modern web app experience

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks
- **React Router v6** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and dev server

### Backend & Database
- **Firebase** - Backend-as-a-Service
  - **Authentication** - User management
  - **Firestore** - NoSQL database
  - **Storage** - File storage (optional)

### Libraries
- **react-datepicker** - Date selection
- **recharts** - Data visualization
- **@hello-pangea/dnd** - Drag and drop
- **react-leaflet** - Map integration
- **date-fns** - Date utilities

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── LoadingSpinner.jsx
│   ├── Navbar.jsx
│   └── ProtectedRoute.jsx
├── contexts/           # React contexts
│   └── AuthContext.jsx
├── pages/              # Page components
│   ├── LandingPage.jsx
│   ├── LoginPage.jsx
│   ├── SignupPage.jsx
│   ├── DashboardPage.jsx
│   ├── CreateTripPage.jsx
│   ├── MyTripsPage.jsx
│   ├── ItineraryBuilderPage.jsx
│   ├── ItineraryViewPage.jsx
│   ├── SearchPage.jsx
│   ├── BudgetPage.jsx
│   └── PublicItineraryPage.jsx
├── utils/              # Utility functions
│   └── helpers.js
├── config/             # Configuration files
│   └── firebase.js
├── App.jsx             # Main app component
├── main.jsx            # Entry point
└── index.css           # Global styles
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- Firebase project account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd globetrotter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Firebase Setup**
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Get your Firebase config

4. **Configure Firebase**
   - Copy your Firebase config to `src/config/firebase.js`
   - Replace the placeholder values with your actual config

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   - Navigate to `http://localhost:3000`

## 🔧 Configuration

### Firebase Configuration
Update `src/config/firebase.js` with your Firebase project details:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Firestore Security Rules
Set up security rules for your Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read/write their own trips
    match /trips/{tripId} {
      allow read, write: if request.auth != null && 
        (resource.data.userId == request.auth.uid || resource.data.isPublic == true);
    }
    
    // Users can read/write itineraries for their trips
    match /itineraries/{itineraryId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/trips/$(resource.data.tripId)) &&
        get(/databases/$(database)/documents/trips/$(resource.data.tripId)).data.userId == request.auth.uid;
    }
  }
}
```

## 📱 Features in Detail

### Authentication
- Secure user registration and login
- Password validation and error handling
- Automatic user profile creation

### Trip Creation
- Interactive date picker
- Cover photo support
- Public/private trip settings
- Automatic itinerary day generation

### Itinerary Builder
- Drag-and-drop day reordering
- Add cities with geocoding
- Add activities with categories
- Real-time collaboration
- AI-powered suggestions

### Map Integration
- Interactive Leaflet maps
- City markers with popups
- Trip visualization
- Click-to-highlight functionality

### Budget Management
- Expense tracking by category
- Pie charts and bar graphs
- Daily budget alerts
- Cost breakdown analysis

### Search & Discovery
- City and activity search
- Filtered results
- Quick add to itineraries
- AI suggestions integration

## 🎨 Design System

### Color Palette
- **Primary**: Blue tones (#3B82F6, #2563EB)
- **Travel**: Green tones (#22C55E, #16A34A)
- **Neutral**: Gray scale (#F9FAFB to #111827)

### Typography
- **Font Family**: Inter (Google Fonts)
- **Weights**: 300, 400, 500, 600, 700

### Components
- Consistent button styles
- Card layouts with shadows
- Responsive grid systems
- Smooth transitions and animations

## 🔒 Security Features

- Firebase Authentication
- Protected routes
- User data isolation
- Input validation
- Secure API calls

## 📊 Database Schema

### Collections

#### users
```javascript
{
  userId: string,           // Document ID
  email: string,
  name: string,
  profilePhotoUrl: string,
  savedDestinations: array,
  createdAt: timestamp
}
```

#### trips
```javascript
{
  tripId: string,           // Document ID
  userId: string,           // Reference to users
  tripName: string,
  startDate: timestamp,
  endDate: timestamp,
  description: string,
  coverPhotoUrl: string,
  isPublic: boolean,
  createdAt: timestamp
}
```

#### itineraries
```javascript
{
  itineraryId: string,      // Document ID
  tripId: string,           // Reference to trips
  day: number,
  date: timestamp,
  cities: array,            // [{name, country, lat, lng}]
  activities: array,        // [{name, type, time, cost}]
  createdAt: timestamp
}
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Environment Variables
Create a `.env` file for environment-specific configuration:

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
3. Add tests if applicable
4. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Wanderlog.com](https://wanderlog.com)
- Built with modern web technologies
- Community-driven development

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review Firebase documentation

## 🔮 Future Enhancements

- [ ] File upload for cover photos
- [ ] Advanced collaboration features
- [ ] Mobile app development
- [ ] Offline support
- [ ] Advanced AI recommendations
- [ ] Social features and sharing
- [ ] Multi-language support
- [ ] Advanced analytics and insights

---

**Happy Travel Planning! ✈️🌍**

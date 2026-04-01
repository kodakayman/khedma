# KHEDMA Firebase Integration Guide

This document outlines the steps to integrate Firebase with the KHEDMA NEARBY app.

## Current Architecture

The app currently uses:
- **localStorage** for data persistence
- **Sync Queue** (`enqueueSyncEvent`) for tracking changes
- **Hardcoded demo data** for jobs and workers

## Firebase Integration Checklist

### 1. Firebase Config
Add your Firebase config to mvp.html:
```javascript
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 2. Firestore Collections

```javascript
// jobs/{jobId}
// {
//   title: string,
//   category: string,
//   desc: string,
//   district: string,
//   priceMin: number,
//   priceMax: number,
//   whatsapp: string,
//   views: number,
//   applicants: number,
//   postedAt: timestamp,
//   userId: string,
//   urgent: boolean
// }

// users/{userId}
// {
//   name: string,
//   phone: string,
//   district: string,
//   bio: string,
//   skills: string[],
//   role: 'seeker' | 'employer',
//   createdAt: timestamp,
//   profileImage: string (URL)
// }

// applications/{applicationId}
// {
//   jobId: string,
//   userId: string,
//   price: number,
//   status: 'pending' | 'accepted' | 'rejected',
//   createdAt: timestamp
// }

// savedJobs/{userId}
// {
//   jobIds: string[]
// }

// jobAlerts/{userId}
// {
//   category: string,
//   district: string
// }
```

### 3. Auth Integration
- Replace `localStorage.getItem('userProfile')` with Firebase Auth
- Use Firebase Phone Auth for WhatsApp verification
- Handle `onAuthStateChanged` for persistent login

### 4. Migration Steps

1. **Phase 1: Read from Firestore**
   - Replace hardcoded `workers` array with Firestore query
   - Replace `jobs` initialization with Firestore collection

2. **Phase 2: Write to Firestore**
   - Replace `enqueueSyncEvent` with direct Firestore writes
   - Add real-time listeners for live updates

3. **Phase 3: Full Auth**
   - Add Firebase Auth login/signup
   - Remove localStorage userProfile dependency

### 5. Key Functions to Replace

| LocalStorage | Firebase |
|-------------|----------|
| `localStorage.getItem('userProfile')` | `firebase.auth().currentUser` |
| `localStorage.getItem('myJobs')` | `firestore.collection('jobs').where('userId', '==', uid)` |
| `localStorage.getItem('savedJobs')` | `firestore.doc('savedJobs/' + uid)` |
| `enqueueSyncEvent('job.create', job)` | `firestore.collection('jobs').add(job)` |

### 6. Performance Tips

- Use Firestore indexes for complex queries
- Implement pagination (limit 20 items)
- Cache worker data in memory
- Use `onSnapshot` for real-time but throttle updates

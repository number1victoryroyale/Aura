// Fill this in with YOUR OWN Firebase project's config to turn on the
// shared "Other Flames" leaderboard. Until every value below is replaced,
// the leaderboard section stays hidden and the rest of the app is unaffected.
//
// How to get these values (~2 minutes, free):
//   1. https://console.firebase.google.com -> Add project
//   2. Build -> Firestore Database -> Create database (start in test mode)
//   3. Project settings (gear icon) -> General -> Your apps -> Add app -> Web
//   4. Copy the "firebaseConfig" object it gives you into the object below
//
// These values are not secret — they identify your project, they don't
// authorize anything by themselves. Firestore Security Rules (set in the
// Firebase console under Firestore Database -> Rules) are what actually
// control who can read/write. Once this leaderboard is working, replace
// the default test-mode rules with:
//
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /leaderboard/{docId} {
//         allow read, write: if true;
//       }
//     }
//   }
//
// (Test-mode rules expire after 30 days and would otherwise lock everyone
// out, including you.)

window.AURA_FIREBASE_CONFIG = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

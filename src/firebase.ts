// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDOn03xMtJps0zoDcZsdPIe3kKFmk1Z0DE",
  authDomain: "sexmatch-d0bfe.firebaseapp.com",
  projectId: "sexmatch-d0bfe",
  storageBucket: "sexmatch-d0bfe.appspot.com",
  messagingSenderId: "1065119815678",
  appId: "1:1065119815678:web:50a1b6f3a61cadfa7412af",
  measurementId: "G-QSLDCG7EX4"
};

console.log('Iniciando configuração do Firebase...');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log('Firebase App inicializado com sucesso');

// Initialize services
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);

// Configure persistence and error handling
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db)
  .catch((err: Error) => {
    if (err.message.includes('failed-precondition')) {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.message.includes('unimplemented')) {
      console.warn('The current browser does not support persistence.');
    }
  });

console.log('Firestore, Auth e Storage inicializados com sucesso');

export { auth, googleProvider, db, storage };
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDxGXZxXZxXZxXZxXZxXZxXZxXZxXZxXZx",
  authDomain: "sexmatch-a54e6.firebaseapp.com",
  projectId: "sexmatch-a54e6",
  storageBucket: "sexmatch-a54e6.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

console.log('Iniciando configuração do Firebase...');
const app = initializeApp(firebaseConfig);
console.log('Firebase App inicializado com sucesso');

const db = getFirestore(app);
const auth = getAuth(app);

console.log('Firestore e Auth inicializados com sucesso');

export { db, auth };
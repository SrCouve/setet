// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCJ5FvMjsXwHutW8_s_zM0Zi4S9SDxta0g",
  authDomain: "sexmatch-a54e6.firebaseapp.com",
  projectId: "sexmatch-a54e6",
  messagingSenderId: "112689365653",
  appId: "1:112689365653:web:39cd84cfc82c1b33fa919c",
  measurementId: "G-JPBCV83PKB"
};

console.log('Iniciando configuração do Firebase...');
const app = initializeApp(firebaseConfig);
console.log('Firebase App inicializado com sucesso');

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
console.log('Firestore e Auth inicializados com sucesso');
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
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
const app = initializeApp(firebaseConfig);
console.log('Firebase App inicializado com sucesso');

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

console.log('Firestore, Auth e Storage inicializados com sucesso');
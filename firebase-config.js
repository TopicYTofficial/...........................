// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCkcNDxhDtxAy-ciPvAmY2ivWFjTCzQOIo",
  authDomain: "webgram-19889.firebaseapp.com",
  databaseURL: "https://webgram-19889-default-rtdb.firebaseio.com",
  projectId: "webgram-19889",
  storageBucket: "webgram-19889.firebasestorage.app",
  messagingSenderId: "645751247600",
  appId: "1:645751247600:web:51378eed6145bdf8a1e835",
  measurementId: "G-2C3GPFL7BL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Экспорт модулей
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

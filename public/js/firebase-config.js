import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3XBrP4wSp0qopos63d-zmBnxKoy3bIxk",
  authDomain: "area52-41e5d.firebaseapp.com",
  projectId: "area52-41e5d",
  storageBucket: "area52-41e5d.firebasestorage.app",
  messagingSenderId: "991496175750",
  appId: "1:991496175750:web:5e9dbc9fb98757da9fd107"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

const ADMIN_EMAIL = "areagalactico@gmail.com";

export { app, auth, db, storage, provider, ADMIN_EMAIL, signInWithPopup, signOut, onAuthStateChanged, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, ref, uploadBytes, getDownloadURL, listAll, deleteObject };

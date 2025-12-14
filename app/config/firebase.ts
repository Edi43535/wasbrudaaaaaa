import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBXGykQO9of0pezOeyHho288FBw9EcUWFc",
  authDomain: "tutorial-1---maschinelles.firebaseapp.com",
  databaseURL: "https://tutorial-1---maschinelles-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "tutorial-1---maschinelles",
  storageBucket: "tutorial-1---maschinelles.firebasestorage.app",
  messagingSenderId: "548405444098",
  appId: "1:548405444098:web:f87225b66d35800c5f711b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
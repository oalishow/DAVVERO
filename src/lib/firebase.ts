import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { initializeFirestore, setLogLevel } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAldUSOslWbr9sTvg0ePP-8K0A2eBOuHOg",
    authDomain: "banco-de-dados-fajopa.firebaseapp.com",
    projectId: "banco-de-dados-fajopa",
    storageBucket: "banco-de-dados-fajopa.appspot.com",
    messagingSenderId: "477906925599",
    appId: "1:477906925599:web:4cdd41bb61493c1b65bd2a",
    measurementId: "G-L236SXBHC4"
};

export const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});
export const auth = getAuth(app);
setLogLevel('error');

export const appId = firebaseConfig.projectId;

export const loginAnon = async () => {
    try {
        await signInAnonymously(auth);
        return true;
    } catch (error) {
        console.error("Firebase Auth Error:", error);
        return false;
    }
}

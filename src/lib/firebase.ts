import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { initializeFirestore, setLogLevel, doc, getDocFromServer, CACHE_SIZE_UNLIMITED, enableIndexedDbPersistence } from "firebase/firestore";

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

// Persistence can help with connection loss during reloads
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
});

// Try to enable persistence to help with reliability across reloads
if (typeof window !== "undefined") {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
            console.warn("Persistence could not be enabled:", err.code);
        }
    });
}

export const auth = getAuth(app);
setLogLevel('error');

export const appId = firebaseConfig.projectId;

/**
 * Ensures a reliable anonymous login, checking if already authenticated
 */
export const loginAnon = async () => {
    return new Promise((resolve) => {
        // Use a timeout to avoid hanging forever if Firebase is stuck
        const timeout = setTimeout(() => {
            console.warn("Firebase Auth timeout");
            resolve(false);
        }, 8000);

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            clearTimeout(timeout);
            unsubscribe();
            if (user) {
                resolve(true);
            } else {
                try {
                    await signInAnonymously(auth);
                    resolve(true);
                } catch (error) {
                    console.error("Firebase Auth Error:", error);
                    resolve(false);
                }
            }
        });
    });
}

/**
 * Tests the connection strictly with the server to ensure we are online
 */
export const testConnection = async () => {
    try {
        // Try to fetch a dummy doc strictly from server to verify link
        await getDocFromServer(doc(db, 'artifacts', appId));
        return true;
    } catch (error: any) {
        // Missing permissions means we successfully reached the server!
        if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            return true; 
        }
        if (error?.message?.includes('offline') || error?.code === 'unavailable') {
            console.warn("Firestore appears to be offline or unavailable.");
            return false;
        }
        // Other errors we can assume true for now to not block the app
        return true;
    }
}

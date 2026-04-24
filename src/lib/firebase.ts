import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  initializeFirestore,
  setLogLevel,
  doc,
  getDoc,
  getDocFromServer,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  addDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { Event, Attendance, Member } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyAldUSOslWbr9sTvg0ePP-8K0A2eBOuHOg",
  authDomain: "banco-de-dados-fajopa.firebaseapp.com",
  projectId: "banco-de-dados-fajopa",
  storageBucket: "banco-de-dados-fajopa.appspot.com",
  messagingSenderId: "477906925599",
  appId: "1:477906925599:web:4cdd41bb61493c1b65bd2a",
  measurementId: "G-L236SXBHC4",
};

export const app = initializeApp(firebaseConfig);

// Modern DB initialization with persistent local cache
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache:
    typeof window !== "undefined"
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : undefined,
});

export const auth = getAuth(app);
setLogLevel("error");

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
};

/**
 * Tests the connection strictly with the server to ensure we are online
 */
export const testConnection = async () => {
  try {
    // Try to fetch a dummy doc strictly from server to verify link
    await getDocFromServer(doc(db, "artifacts", appId));
    return true;
  } catch (error: any) {
    // Missing permissions means we successfully reached the server!
    if (
      error?.code === "permission-denied" ||
      error?.message?.includes("Missing or insufficient permissions")
    ) {
      return true;
    }
    if (error?.message?.includes("offline") || error?.code === "unavailable") {
      console.warn("Firestore appears to be offline or unavailable.");
      return false;
    }
    // Other errors we can assume true for now to not block the app
    return true;
  }
};

export const updateEventStatus = async (eventId: string, status: string) => {
  try {
    const eventsRef = doc(
      db,
      `artifacts/${appId}/public/data/students`,
      "_events_global",
    );
    const docSnap = await getDocFromServer(eventsRef).catch(() => null);
    if (docSnap && docSnap.exists()) {
      const data = docSnap.data();
      const list = (data.list || []) as Event[];
      const idx = list.findIndex((e) => e.id === eventId);
      if (idx !== -1) {
        list[idx].status = status;
        await updateDoc(eventsRef, { list });
      }
    }
  } catch (e) {
    console.error("Error updating event status: ", e);
    throw e;
  }
};

export const deleteEvent = async (eventId: string) => {
  try {
    const eventsRef = doc(
      db,
      `artifacts/${appId}/public/data/students`,
      "_events_global",
    );
    // Use getDoc instead of getDocFromServer and remove .catch(() => null) to avoid silent failures
    const docSnap = await getDoc(eventsRef);
    if (docSnap && docSnap.exists()) {
      const data = docSnap.data();
      const list = data.list || [];
      const updatedList = list.filter((e: any) => e.id !== eventId);
      await updateDoc(eventsRef, { list: updatedList });

      console.log(
        `Event ${eventId} deleted successfully. Updated list size: ${updatedList.length}`,
      );
    } else {
      console.log(
        `Failed to delete event ${eventId}: global document does not exist.`,
      );
      throw new Error(
        `Failed to delete event: Document does not exist. (Id: ${eventId})`,
      );
    }

    // Also remove related attendances
    const attendancesRef = doc(
      db,
      `artifacts/${appId}/public/data/students`,
      "_attendances_global",
    );
    const attSnap = await getDoc(attendancesRef);
    if (attSnap && attSnap.exists()) {
      const attData = attSnap.data();
      const attList = attData.list || [];
      const updatedAttList = attList.filter((a: any) => a.eventId !== eventId);
      if (attList.length !== updatedAttList.length) {
        await updateDoc(attendancesRef, { list: updatedAttList });
      }
    }
  } catch (e) {
    console.error("Error deleting event: ", e);
    throw e;
  }
};

export const closeEvent = async (eventId: string) => {
  try {
    await updateEventStatus(eventId, "encerrado");

    const attendancesRef = doc(
      db,
      `artifacts/${appId}/public/data/students`,
      "_attendances_global",
    );
    const docSnap = await getDocFromServer(attendancesRef).catch(() => null);
    if (docSnap && docSnap.exists()) {
      const data = docSnap.data();
      const list = (data.list || []) as Attendance[];
      let count = 0;
      const updated = list.map((a) => {
        if (a.eventId === eventId && a.status === "presente") {
          count++;
          return { ...a, status: "apto_para_certificado" as any };
        }
        return a;
      });
      if (count > 0) {
        await updateDoc(attendancesRef, { list: updated });
      }
    }
  } catch (e) {
    console.error("Error closing event: ", e);
    throw e;
  }
};

export const createEvent = async (eventData: Omit<Event, "id">) => {
  try {
    const eventsRef = doc(
      db,
      `artifacts/${appId}/public/data/students`,
      "_events_global",
    );
    const eventId = "evt_" + Date.now().toString();
    const eventItem = { ...eventData, id: eventId };

    const docSnap = await getDocFromServer(eventsRef).catch(() => null);
    if (docSnap && docSnap.exists()) {
      const data = docSnap.data();
      const list = data.list || [];
      list.push(eventItem);
      await updateDoc(eventsRef, { list });
    } else {
      await setDoc(eventsRef, { list: [eventItem] });
    }
    return eventId;
  } catch (e) {
    console.error("Error adding event: ", e);
    throw e;
  }
};

export const updateEvent = async (
  eventId: string,
  eventData: Partial<Omit<Event, "id">>,
) => {
  try {
    const eventsRef = doc(
      db,
      `artifacts/${appId}/public/data/students`,
      "_events_global",
    );
    const docSnap = await getDocFromServer(eventsRef).catch(() => null);
    if (docSnap && docSnap.exists()) {
      const data = docSnap.data();
      const list = (data.list || []) as Event[];
      const idx = list.findIndex((e: Event) => e.id === eventId);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...eventData };
        await updateDoc(eventsRef, { list });
      }
    }
  } catch (e) {
    console.error("Error updating event: ", e);
    throw e;
  }
};

export const enrollStudent = async (attendanceData: Omit<Attendance, "id">) => {
  try {
    const attendancesRef = doc(
      db,
      `artifacts/${appId}/public/data/students`,
      "_attendances_global",
    );
    const attendanceId = "att_" + Date.now().toString();
    const attendanceItem = { ...attendanceData, id: attendanceId };

    const docSnap = await getDocFromServer(attendancesRef).catch(() => null);
    if (docSnap && docSnap.exists()) {
      const data = docSnap.data();
      const list = data.list || [];
      list.push(attendanceItem);
      await updateDoc(attendancesRef, { list });
    } else {
      await setDoc(attendancesRef, { list: [attendanceItem] });
    }
    return attendanceId;
  } catch (e) {
    console.error("Error adding attendance: ", e);
    throw e;
  }
};

export const updateAttendanceStatus = async (
  attendanceId: string,
  status: "inscrito" | "presente",
) => {
  try {
    const attendancesRef = doc(
      db,
      `artifacts/${appId}/public/data/students`,
      "_attendances_global",
    );
    const docSnap = await getDocFromServer(attendancesRef).catch(() => null);
    if (docSnap && docSnap.exists()) {
      const data = docSnap.data();
      const list = (data.list || []) as Attendance[];
      const idx = list.findIndex((a) => a.id === attendanceId);
      if (idx !== -1) {
        list[idx].status = status;
        await updateDoc(attendancesRef, { list });
      }
    }
  } catch (e) {
    console.error("Error updating attendance status: ", e);
    throw e;
  }
};

export const unsubscribeFromEvent = async (eventId: string, studentId: string) => {
  try {
    const attendancesRef = doc(
      db,
      `artifacts/${appId}/public/data/students`,
      "_attendances_global",
    );
    const docSnap = await getDocFromServer(attendancesRef).catch(() => null);
    if (docSnap && docSnap.exists()) {
      const data = docSnap.data();
      const list = (data.list || []) as Attendance[];

      const filteredList = list.filter((a) => !(a.eventId === eventId && a.studentId === studentId));

      if (filteredList.length !== list.length) {
        await updateDoc(attendancesRef, { list: filteredList });
        return true;
      } else {
        console.warn("Inscrição não encontrada para cancelamento.");
        return false;
      }
    }
    return false;
  } catch (error) {
    console.error("Erro ao cancelar inscrição no Firebase:", error);
    throw error;
  }
};

export const getEventSubscribers = async (
  eventId: string,
): Promise<{ name: string; photoUrl: string | null }[]> => {
  try {
    const attendancesRef = doc(
      db,
      `artifacts/${appId}/public/data/students`,
      "_attendances_global",
    );
    const docSnap = await getDocFromServer(attendancesRef).catch(() => null);
    let studentIds: string[] = [];

    if (docSnap && docSnap.exists()) {
      const data = docSnap.data();
      const list = (data.list || []) as Attendance[];
      studentIds = list
        .filter(
          (a) => a.eventId === eventId && a.status !== ("cancelado" as any),
        )
        .map((a) => a.studentId);
    }

    if (studentIds.length === 0) return [];

    const { getDocs, query, collection } = await import("firebase/firestore");
    const membersSnap = await getDocs(
      query(collection(db, `artifacts/${appId}/public/data/students`)),
    );

    const subscribers: { name: string; photoUrl: string | null }[] = [];
    membersSnap.docs.forEach((d) => {
      if (studentIds.includes(d.id)) {
        const data = d.data();
        subscribers.push({
          name: data.name,
          photoUrl: data.photoUrl || null,
        });
      }
    });

    return subscribers;
  } catch (e) {
    console.error("Error fetching event subscribers: ", e);
    return [];
  }
};

export const registerVisitor = async (name: string, cpf?: string) => {
  try {
    const newVisitor: Omit<Member, "id"> = {
      name,
      cpf: cpf || "",
      roles: ["VISITANTE"],
      isActive: true,
      alphaCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdAt: new Date().toISOString(),
    };
    
    // We add and get the document
    const { addDoc, collection } = await import("firebase/firestore");
    const docRef = await addDoc(
      collection(db, `artifacts/${appId}/public/data/students`),
      newVisitor
    );
    return { ...newVisitor, id: docRef.id } as Member;
  } catch (error) {
    console.error("Erro ao registrar visitante:", error);
    throw error;
  }
};

export const findMemberByCPF = async (cpf: string): Promise<Member | null> => {
  if (!cpf) return null;
  try {
    const { getDocs, query, collection, where } = await import("firebase/firestore");
    const q = query(
      collection(db, `artifacts/${appId}/public/data/students`),
      where("cpf", "==", cpf)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { ...doc.data(), id: doc.id } as Member;
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar visitante por CPF:", error);
    return null;
  }
};

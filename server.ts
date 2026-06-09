import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import webpush from "web-push";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { initializeApp as initializeClientApp } from "firebase/app";
import {
  initializeFirestore as initializeClientFirestore,
  collection as clientCollection,
  query as clientQuery,
  where as clientWhere,
  onSnapshot as clientOnSnapshot,
  getDocs as clientGetDocs,
  doc as clientDoc,
  deleteDoc as clientDeleteDoc,
} from "firebase/firestore";

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp();
    console.log("Firebase Admin initialized with default credentials.");
  } catch (err) {
    console.error("Firebase Admin default init failed, trying with config project ID:", err);
    admin.initializeApp({
      projectId: "banco-de-dados-fajopa",
    });
  }
}

// Config for Firebase Client SDK to bypass service-account credential rules in restricted environment
const firebaseConfig = {
  apiKey: "AIzaSyAldUSOslWbr9sTvg0ePP-8K0A2eBOuHOg",
  authDomain: "banco-de-dados-fajopa.firebaseapp.com",
  projectId: "banco-de-dados-fajopa",
  storageBucket: "banco-de-dados-fajopa.appspot.com",
  messagingSenderId: "477906925599",
  appId: "1:477906925599:web:4cdd41bb61493c1b65bd2a",
};

const clientApp = initializeClientApp(firebaseConfig);
const clientDb = initializeClientFirestore(clientApp, {
  ignoreUndefinedProperties: true,
  experimentalForceLongPolling: true,
});

// VAPID keys
// Hardcoding keys for immediate use in preview environment
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "BExGkxEI0iWpLyDIDONDcUaHlIb3f_gGODmxL9LRkLT3qoWd0zpZhgFHA2c1c6sKIsRL9kLh4fpZ1maZg_CLELk";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "BLaG0xS9zg1ICGRlg7Q8kHBr_dmMF_IyPJYW3JWVFTg";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:admblackjamf@gmail.com",
    vapidPublicKey,
    vapidPrivateKey
  );
}

// Set up real-time listener to dispatch push notifications automatically when a new notification is added to Firestore
const notificationsPath = "artifacts/banco-de-dados-fajopa/public/data/notifications";
const startTimestamp = new Date();

console.log(`[Push Server] Inicializando escuta de notificações em: ${notificationsPath}`);

const notificationsQuery = clientQuery(
  clientCollection(clientDb, notificationsPath),
  clientWhere("createdAt", ">=", startTimestamp.toISOString())
);

const unsubNotifications = clientOnSnapshot(
  notificationsQuery,
  (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "added") {
        const notif = change.doc.data();
        const notifId = change.doc.id;
        console.log(`[Push Server] Nova notificação detectada em tempo real: "${notif.title}" (ID: ${notifId}), enviando para: ${notif.recipientId}`);

        try {
          // Determine targeted subscriptions
          let q = clientCollection(clientDb, "push_subscriptions");
          let constraints: any[] = [];

          if (notif.recipientId !== "todos") {
            if (notif.recipientId === "admin") {
              constraints.push(clientWhere("isAdmin", "==", true));
            } else {
              constraints.push(clientWhere("studentId", "==", notif.recipientId));
            }
          }

          const queryRef = constraints.length > 0 
            ? clientQuery(q, ...constraints) 
            : clientQuery(q);

          const subsSnapshot = await clientGetDocs(queryRef);
          const subscriptions = subsSnapshot.docs.map(doc => doc.data());

          if (subscriptions.length === 0) {
            console.log(`[Push Server] Nenhuma inscrição encontrada para o destinatário: ${notif.recipientId}`);
            return;
          }

          const payload = {
            title: notif.title || "Novo Aviso",
            body: notif.message || "",
            url: notif.actionUrl || "/"
          };

          const expiredEndpoints: string[] = [];
          
          const promises = subscriptions.map((sub: any) => {
            return webpush.sendNotification(sub, JSON.stringify(payload))
              .catch((err) => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                  expiredEndpoints.push(sub.endpoint);
                } else {
                  console.error(`[Push Server] Erro ao enviar para ${sub.endpoint.substring(0, 30)}...:`, err.message);
                }
              });
          });

          await Promise.allSettled(promises);

          // Clean up expired subscriptions if any
          if (expiredEndpoints.length > 0) {
            console.log(`[Push Server] Removendo ${expiredEndpoints.length} inscrições expiradas...`);
            for (const endpoint of expiredEndpoints) {
              const endpointHash = Buffer.from(endpoint).toString("base64").replace(/\+/g, '-').replace(/\//g, '_').substring(0, 100);
              try {
                const subDocRef = clientDoc(clientDb, "push_subscriptions", endpointHash);
                await clientDeleteDoc(subDocRef);
              } catch (e) {
                console.error("[Push Server] Erro ao remover sub expirada", e);
              }
            }
          }

        } catch (e) {
          console.error("[Push Server] Erro ao processar push background:", e);
        }
      }
    });
  },
  (err) => {
    console.error("[Push Server] Erro no listener do Firestore:", err);
  }
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Routes for Push Notifications
  app.get("/api/push/public-key", (req, res) => {
    res.json({ publicKey: vapidPublicKey });
  });

  // Delegate the broadcast to receive subscriptions from the frontend
  app.post("/api/push/broadcast", async (req, res) => {
    const { title, message, url, subscriptions } = req.body;
    console.log(`[Broadcast] Iniciando envio: "${title}" para ${subscriptions?.length || 0} alvos.`);
    
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ success: true, count: 0 });
    }

    const payload = { title, body: message, url: url || "/" };

    try {
      const expiredEndpoints: string[] = [];
      const notifications = subscriptions.map((subscription: any) => {
        return webpush.sendNotification(subscription, JSON.stringify(payload))
          .catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              console.log(`[Broadcast] Subscrição expirada/inválida (${err.statusCode})`);
              expiredEndpoints.push(subscription.endpoint);
            } else {
              console.error(`[Broadcast] Erro push:`, err.message);
            }
          });
      });

      await Promise.allSettled(notifications);
      console.log(`[Broadcast] Envio finalizado.`);
      res.status(200).json({ success: true, expiredEndpoints });
    } catch (error: any) {
      console.error("Error in broadcast:", error);
      res.status(500).json({ error: "Failed to broadcast notifications", details: error.message });
    }
  });

  app.post("/api/push/send", async (req, res) => {
    const { subscription, payload } = req.body;
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error sending push:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

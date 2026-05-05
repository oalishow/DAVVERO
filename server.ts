import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import webpush from "web-push";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

// Initialize Firebase Admin
// We use the project ID from the config we saw earlier
const projectId = "banco-de-dados-fajopa";
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: projectId,
  });
}
const db = admin.firestore();

// VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:admblackjamf@gmail.com",
    vapidPublicKey,
    vapidPrivateKey
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Routes for Push Notifications
  app.get("/api/push/public-key", (req, res) => {
    res.json({ publicKey: vapidPublicKey });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    const { subscription, userId } = req.body;
    try {
      // Save subscription to Firestore
      // Use endpoint as a unique key or just a collection
      const subscriptionId = Buffer.from(subscription.endpoint).toString('base64').substring(0, 50);
      await db.collection("push_subscriptions").doc(subscriptionId).set({
        ...subscription,
        userId: userId || "anonymous",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.status(201).json({ success: true });
    } catch (error) {
      console.error("Error saving subscription:", error);
      res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  app.post("/api/push/broadcast", async (req, res) => {
    const { title, message, url } = req.body;
    const payload = { title, body: message, url: url || "/" };

    try {
      const snapshot = await db.collection("push_subscriptions").get();
      const notifications = snapshot.docs.map(doc => {
        const subscription = doc.data();
        return webpush.sendNotification(subscription as any, JSON.stringify(payload))
          .catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              // Subscription expired or no longer valid, delete it
              return doc.ref.delete();
            }
            console.error("Error sending to subscription:", err);
          });
      });

      await Promise.all(notifications);
      res.status(200).json({ success: true, count: snapshot.docs.length });
    } catch (error) {
      console.error("Error in broadcast:", error);
      res.status(500).json({ error: "Failed to broadcast notifications" });
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

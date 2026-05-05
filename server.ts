import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import webpush from "web-push";
import dotenv from "dotenv";
import admin from "firebase-admin";

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
      // Save subscription to Firestore using the app's data path
      // This is more likely to have correct IAM permissions
      const subscriptionId = Buffer.from(subscription.endpoint).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').substring(0, 100);
      
      await db.collection(`artifacts/banco-de-dados-fajopa/public/data/push_subscriptions`)
        .doc(subscriptionId)
        .set({
          ...subscription,
          userId: userId || "anonymous",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      
      console.log(`[Push] Subscrição salva: ${subscriptionId}`);
      res.status(201).json({ success: true });
    } catch (error: any) {
      console.error("Error saving subscription:", error);
      res.status(500).json({ error: "Failed to save subscription", details: error.message });
    }
  });

  app.post("/api/push/broadcast", async (req, res) => {
    const { title, message, url } = req.body;
    console.log(`[Broadcast] Iniciando envio: "${title}"`);
    
    const payload = { title, body: message, url: url || "/" };

    try {
      console.log(`[Broadcast] Buscando subscrições no Firestore sob artifacts prefix...`);
      const snapshot = await db.collection(`artifacts/banco-de-dados-fajopa/public/data/push_subscriptions`).get();
      console.log(`[Broadcast] Encontradas ${snapshot.docs.length} subscrições.`);

      if (snapshot.docs.length === 0) {
        return res.status(200).json({ success: true, count: 0 });
      }

      // We respond 202 Accepted and process in background to avoid blocking the main UI
      res.status(202).json({ success: true, count: snapshot.docs.length, message: "Enviando em segundo plano" });

      // Run sending in the background
      (async () => {
        const notifications = snapshot.docs.map(doc => {
          const subscription = doc.data();
          return webpush.sendNotification(subscription as any, JSON.stringify(payload))
            .then(() => {
              console.log(`[Broadcast] Enviado com sucesso para doc: ${doc.id}`);
            })
            .catch(async (err) => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                console.log(`[Broadcast] Subscrição expirada/inválida (${err.statusCode}), removendo: ${doc.id}`);
                try {
                  await doc.ref.delete();
                } catch (delErr) {
                  console.error(`[Broadcast] Erro ao deletar subscrição ${doc.id}:`, delErr);
                }
              } else {
                console.error(`[Broadcast] Erro ao enviar para ${doc.id}:`, err.message);
              }
            });
        });

        await Promise.allSettled(notifications);
        console.log(`[Broadcast] Processo de envio finalizado para ${snapshot.docs.length} alvos.`);
      })();

    } catch (error) {
      console.error("Error in broadcast:", error);
      // If we already sent 202 we can't send 500, but the initial get() is before 202
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to broadcast notifications" });
      }
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

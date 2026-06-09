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

  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ limit: '200mb', extended: true }));

  app.post("/api/proxy-upload-raw", express.raw({ type: '*/*', limit: '200mb' }), async (req, res) => {
    try {
      const bucket = req.query.bucket as string;
      const path = req.query.path as string;
      const mimeType = req.query.mimeType as string || "application/octet-stream";
      const idToken = req.query.idToken as string;

      if (!bucket || !path) {
        return res.status(400).json({ error: "Missing bucket or path" });
      }
      
      const buffer = req.body;
      if (!buffer || !Buffer.isBuffer(buffer)) {
        return res.status(400).json({ error: "No raw body buffer" });
      }
      
      const headers: any = {
        "Content-Type": mimeType,
        "Content-Length": buffer.length.toString()
      };
      
      // se houver token, adiciona o header
      if (idToken) {
        headers["Authorization"] = `Firebase ${idToken}`;
      }

      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?name=${encodeURIComponent(path)}`;

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers,
        body: buffer
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("Firebase Storage error:", responseData);
        return res.status(response.status).json({ error: responseData.error?.message || "Storage error" });
      }

      const downloadToken = responseData.downloadTokens;
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media${downloadToken ? '&token=' + downloadToken : ''}`;
      
      res.status(200).json({ downloadUrl });
    } catch (err: any) {
      console.error("Fatal raw proxy upload error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/proxy-upload", async (req, res) => {
    try {
      const { bucket, path, mimeType, base64Data, idToken } = req.body;
      if (!bucket || !path || !base64Data) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Convert base64 back to buffer
      const buffer = Buffer.from(base64Data, "base64");
      
      const headers: any = {
        "Content-Type": mimeType || "application/octet-stream",
        "Content-Length": buffer.length.toString()
      };
      
      if (idToken) {
        headers["Authorization"] = `Firebase ${idToken}`;
      }

      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?name=${encodeURIComponent(path)}`;

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers,
        body: buffer
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("Firebase Storage error:", responseData);
        return res.status(response.status).json({ error: responseData.error?.message || "Storage error" });
      }

      // Construct public URL
      const downloadToken = responseData.downloadTokens;
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media${downloadToken ? '&token=' + downloadToken : ''}`;
      
      res.status(200).json({ downloadUrl });
    } catch (err: any) {
      console.error("Fatal proxy upload error:", err);
      res.status(500).json({ error: err.message });
    }
  });

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

  app.post("/api/ai/generate-notification", async (req, res) => {
    const { promptText } = req.body;
    try {
      const gKey = process.env.GEMINI_API_KEY;
      if (!gKey) {
        return res.status(500).json({ error: "A chave GEMINI_API_KEY não foi configurada." });
      }

      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: gKey });
      
      const prompt = `Você é um excelente comunicador responsável por avisos para alunos de um instituto de teologia.
Escreva um título curto (até 50 caracteres, podendo ter um emoji no final) e uma mensagem clara, objetiva, engajadora e diversificada (evite clichês e use vocabulário rico, variando o tom, até 250 caracteres) para a seguinte ideia de notificação:

IDEIA DO AVISO: "${promptText}"

Retorne o resultado estritamente em um JSON com os campos 'title' (o título) e 'message' (a mensagem completa). Crie algo amigável, caloroso e com linguagem diversificada.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
               title: { type: Type.STRING },
               message: { type: Type.STRING }
            },
            required: ["title", "message"]
          }
        }
      });
      
      const responseText = response.text;
      if (responseText) {
        res.status(200).json(JSON.parse(responseText));
      } else {
        res.status(500).json({ error: "Empty response from AI" });
      }
    } catch (error: any) {
      console.error("Erro ao gerar notificação com IA", error);
      res.status(500).json({ error: "Não foi possível gerar a notificação pela IA. Verifique sua chave da API do Gemini." });
    }
  });

  app.post("/api/ai/generate-certificate", async (req, res) => {
    const { promptText } = req.body;
    try {
      const gKey = process.env.GEMINI_API_KEY;
      if (!gKey) {
        return res.status(500).json({ error: "A chave GEMINI_API_KEY não foi configurada." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: gKey });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptText,
      });

      res.status(200).json({ text: response.text });
    } catch (error: any) {
      console.error("Erro ao gerar certificado com IA", error);
      res.status(500).json({ error: "Erro ao gerar texto: " + error.message });
    }
  });

  app.post("/api/ai/analyze-logo", async (req, res) => {
    const { base64Data, mimeType, promptText } = req.body;
    try {
      const gKey = process.env.GEMINI_API_KEY;
      if (!gKey) {
        return res.status(500).json({ error: "A chave GEMINI_API_KEY não foi configurada." });
      }

      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: gKey });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: promptText },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
             type: Type.ARRAY,
             items: {
               type: Type.OBJECT,
               properties: {
                 name: { type: Type.STRING },
                 primary: { type: Type.STRING, description: "Hex code including #" },
                 secondary: { type: Type.STRING, description: "Hex code including #" },
                 accent: { type: Type.STRING, description: "Hex code including #" },
                 description: { type: Type.STRING },
               },
               required: ["name", "primary", "secondary", "accent", "description"]
             }
          }
        }
      });

      const responseText = response.text;
      if (responseText) {
        res.status(200).json(JSON.parse(responseText));
      } else {
        res.status(500).json({ error: "Empty response from AI" });
      }
    } catch (error: any) {
      console.error("Erro ao analisar logo com IA", error);
      res.status(500).json({ error: "Erro ao gerar paletas: " + error.message });
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

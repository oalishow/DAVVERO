import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, appId, auth } from "./firebase";

export const logAdminAction = async (action: string, description: string, targetId?: string) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, `artifacts/${appId}/public/data/audit_logs`), {
      action,
      description,
      targetId: targetId || null,
      adminEmail: user.email || "unknown@domain.com",
      adminName: user.displayName || "Admin",
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
};

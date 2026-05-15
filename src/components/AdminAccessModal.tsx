import { useState, useEffect } from "react";
import { X, ShieldPlus, Loader2, UserX, UserCheck, Trash2 } from "lucide-react";
import { collection, query, getDocs, updateDoc, doc, deleteDoc, addDoc, setDoc } from "firebase/firestore";
import { db, appId } from "../lib/firebase";

interface AdminAccessModalProps {
  onClose: () => void;
}

export default function AdminAccessModal({ onClose }: AdminAccessModalProps) {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "GERENTE" | "LEITOR">("LEITOR");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, `artifacts/${appId}/public/data/administrators`));
      const snapshot = await getDocs(q);
      const adminsList = snapshot.docs.map(d => ({ id: d.id, ...d.data(), type: 'admin' }));

      const qInvites = query(collection(db, `artifacts/${appId}/public/data/admin_invites`));
      const snapshotInvites = await getDocs(qInvites);
      const invitesList = snapshotInvites.docs.map(d => ({ id: d.id, ...d.data(), type: 'invite' }));

      setAdmins([...adminsList, ...invitesList]);
    } catch (e: any) {
      console.error(e);
      setError("Erro ao carregar administradores.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (id: string, role: string, type: string) => {
    try {
      const col = type === 'invite' ? 'admin_invites' : 'administrators';
      await updateDoc(doc(db, `artifacts/${appId}/public/data/${col}`, id), { role });
      setAdmins(prev => prev.map(a => a.id === id ? { ...a, role } : a));
    } catch (e: any) {
      console.error(e);
      setError("Erro ao atualizar nível de acesso.");
    }
  };

  const handleDeleteAdmin = async (id: string, type: string) => {
    if (!window.confirm("Remover este acesso? O usuário não poderá mais logar como administrador.")) return;
    try {
      const col = type === 'invite' ? 'admin_invites' : 'administrators';
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/${col}`, id));
      setAdmins(prev => prev.filter(a => a.id !== id));
    } catch (e: any) {
      console.error(e);
      setError("Erro ao remover acesso.");
    }
  };

  const handleAddAccess = async () => {
    if (!newEmail.trim()) return;
    const emailToUse = newEmail.trim().toLowerCase();
    try {
      await setDoc(doc(db, `artifacts/${appId}/public/data/admin_invites`, emailToUse), {
        email: emailToUse,
        role: newRole,
        createdAt: new Date().toISOString()
      });
      setNewEmail("");
      fetchAdmins();
    } catch (e: any) {
      console.error(e);
      setError("Erro ao adicionar acesso.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animated-fade-in no-print">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldPlus className="w-5 h-5 text-emerald-500" />
            Gestão de Acessos
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 bg-rose-50 text-rose-600 p-3 rounded-xl border border-rose-200 text-sm">{error}</div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 mb-6">
            <h3 className="font-bold text-sm mb-3">Adicionar Novo Acesso</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="email"
                placeholder="E-mail do administrador"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-900"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-900"
              >
                <option value="LEITOR">Leitor</option>
                <option value="GERENTE">Gerente</option>
                <option value="ADMIN">Administrador</option>
              </select>
              <button 
                onClick={handleAddAccess}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm"
              >
                Adicionar
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">Dica: Se ele já se registrou, apenas edite o acesso abaixo. Caso contrário, ele poderá se registrar com este e-mail.</p>
          </div>

          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin w-6 h-6 text-emerald-500" /></div>
          ) : (
            <div className="space-y-3">
              {admins.map(admin => (
                <div key={admin.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 border border-slate-200 dark:border-slate-700/50 rounded-xl bg-white dark:bg-slate-800">
                  <div className="flex flex-col mb-2 sm:mb-0">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{admin.email}</span>
                    <span className="text-[10px] text-slate-500">ID: {admin.id}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    {admin.type === 'invite' && (
                      <span className="text-[10px] bg-sky-100 text-sky-700 font-bold px-2 py-0.5 rounded-full mr-2">Convite PENDENTE</span>
                    )}
                    <select
                      value={admin.role || "ADMIN"}
                      onChange={(e) => handleUpdateRole(admin.id, e.target.value, admin.type)}
                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900"
                    >
                      <option value="LEITOR">Leitor</option>
                      <option value="GERENTE">Gerente</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                    <button onClick={() => handleDeleteAdmin(admin.id, admin.type)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {admins.length === 0 && <p className="text-center text-slate-500 text-sm">Nenhum acesso configurado ainda.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

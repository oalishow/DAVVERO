import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { logAdminAction } from "../lib/audit";
import { ShieldCheck, Mail, Calendar, Trash2, Edit, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminUser {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "CHECKIN_ONLY";
  createdAt: string;
}

export default function AdminManagementPanel() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, `artifacts/${appId}/public/data/administrators`));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminUser));
      setAdmins(list);
    } catch (error) {
      console.error("Failed to load administrators", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleUpdateRole = async (adminId: string, email: string, newRole: string) => {
    if (!window.confirm(`Deseja alterar o papel de ${email} para ${newRole}?`)) return;
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/administrators`, adminId), { role: newRole });
      await logAdminAction("ADMIN_ROLE_UPDATED", `Alterou o nível de acesso de ${email} para ${newRole}`);
      fetchAdmins();
    } catch (e) {
      console.error("Error updating role:", e);
      alert("Erro ao atualizar.");
    }
  };

  const handleDeleteAdmin = async (adminId: string, email: string) => {
    if (!window.confirm(`ATENÇÃO: Deseja remover o acesso de ${email}? Ele não poderá mais visualizar o painel (A conta de e-mail ainda existirá na autenticação base, mas o painel será bloqueado).`)) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/administrators`, adminId));
      await logAdminAction("ADMIN_REVOKED", `Removeu as credenciais administrativas de ${email}`);
      fetchAdmins();
    } catch (e) {
      console.error("Error deleting admin:", e);
      alert("Erro ao remover.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Carregando lista de administradores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 font-display flex items-center gap-3">
            <span className="p-2 bg-sky-100 dark:bg-sky-500/20 rounded-xl text-sky-600 dark:text-sky-400">
              <ShieldCheck className="w-6 h-6" />
            </span>
            Gestão de Administradores
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 pl-12">
            Controle quem tem acesso ao painel e seus níveis de permissão.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800/80">
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">E-mail / Usuário</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nível de Acesso</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Data de Criação</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    Nenhum administrador encontrado (Os administradores logados antes da versão 5.8 podem não aparecer aqui até se recadastrarem).
                  </td>
                </tr>
              ) : (
                admins.map(admin => (
                  <tr key={admin.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-slate-400" />
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{admin.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <select 
                        value={admin.role}
                        onChange={(e) => handleUpdateRole(admin.id, admin.email, e.target.value)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg outline-none cursor-pointer border ${admin.role === 'SUPER_ADMIN' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                      >
                        <option value="SUPER_ADMIN">Super Admin</option>
                        <option value="ADMIN">Administrador</option>
                        <option value="CHECKIN_ONLY">Apenas Check-in (Portaria)</option>
                      </select>
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      {admin.createdAt ? format(new Date(admin.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Desconhecido"}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                        title="Remover acesso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

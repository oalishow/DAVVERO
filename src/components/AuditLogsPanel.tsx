import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, limit as limitDocs, startAfter, Timestamp } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { ShieldAlert, Database, CalendarIcon, UserCircle, Activity, Loader2, Download, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  action: string; // e.g. "TERMS_UPDATED", "MEMBER_APPROVED", "MEMBER_DELETED"
  description: string;
  adminEmail: string;
  adminName?: string;
  targetId?: string; // Optional ID representing the affected record
  createdAt: string | { seconds: number; nanoseconds: number } | any;
}

export default function AuditLogsPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      let logsQuery;
      if (loadMore && lastDoc) {
        logsQuery = query(
          collection(db, `artifacts/${appId}/public/data/audit_logs`),
          orderBy("createdAt", "desc"),
          startAfter(lastDoc),
          limitDocs(50)
        );
      } else {
        logsQuery = query(
          collection(db, `artifacts/${appId}/public/data/audit_logs`),
          orderBy("createdAt", "desc"),
          limitDocs(50)
        );
      }

      const snapshot = await getDocs(logsQuery);
      
      const newLogs: AuditLog[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        newLogs.push({ id: doc.id, ...data } as AuditLog);
      });

      if (!snapshot.empty) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        setHasMore(false);
      }

      if (loadMore) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }
    } catch (error) {
      console.error("Failed to load audit logs", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (dateVal: any) => {
    if (!dateVal) return "Data desconhecida";
    try {
      let d;
      if (dateVal.toDate && typeof dateVal.toDate === 'function') {
        d = dateVal.toDate();
      } else if (dateVal.seconds) {
        d = new Date(dateVal.seconds * 1000);
      } else {
        d = new Date(dateVal);
      }
      return format(d, "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch (e) {
      return "Data inválida";
    }
  };

  const exportCSV = () => {
    const header = "Data,Ação,Descrição,Admin Email,Alvo ID\n";
    const csvContent = logs.map(l => {
      const dateStr = formatDate(l.createdAt);
      return `"${dateStr}","${l.action}","${l.description}","${l.adminEmail}","${l.targetId || ''}"`;
    }).join("\n");
    
    const blob = new Blob([header + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `auditoria_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 font-display flex items-center gap-3">
            <span className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500">
              <Database className="w-6 h-6" />
            </span>
            Logs de Auditoria
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 pl-12">
            Histórico de ações críticas realizadas por administradores do sistema.
          </p>
        </div>
        
        <button 
          onClick={exportCSV}
          disabled={logs.length === 0}
          className="btn-modern bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2 font-bold text-sm select-none flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800/80">
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Data / Hora</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Administrador</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Ação</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Descrição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Carregando histórico...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum log registrado ainda.</p>
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <UserCircle className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {log.adminName || "Admin"}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[150px]">
                            {log.adminEmail}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                      {log.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {hasMore && !loading && logs.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-center bg-slate-50/30 dark:bg-slate-800/10">
            <button 
              onClick={() => fetchLogs(true)}
              disabled={loadingMore}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Carregar mais antigos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

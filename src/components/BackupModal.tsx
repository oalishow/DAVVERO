import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Database, Download } from 'lucide-react';
import { collection, query, getDocs, setDoc, doc, addDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import type { Member } from '../types';

export default function BackupModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAllForBackup = async () => {
    const q = query(collection(db, `artifacts/${appId}/public/data/students`));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await fetchAllForBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DAVVERO-ID_DB_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showStatus('Backup descarregado com sucesso!', 'success');
    } catch (e) {
      console.error(e);
      showStatus('Falha ao exportar base de dados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const importedData = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(importedData)) throw new Error("Estrutura JSON inválida.");
        
        const batchPromises = importedData.map(member => {
          if(member.id) {
            const { id, ...data } = member; 
            return setDoc(doc(db, `artifacts/${appId}/public/data/students`, id), data);
          } else {
            return addDoc(collection(db, `artifacts/${appId}/public/data/students`), member);
          }
        });
        
        await Promise.all(batchPromises);
        showStatus('Base de dados restaurada!', 'success');
      } catch (err) {
        console.error(err);
        showStatus('Incompatibilidade: Arquivo JSON inválido.', 'error');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const showStatus = (msg: string, type: 'success'|'error') => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 4000);
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] p-6 w-full max-w-sm animated-scale-in">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/60">
          <h2 className="text-xl font-bold text-sky-600 dark:text-sky-400 flex items-center gap-2">
             <Database className="w-5 h-5" /> Gestão de Backups
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {status && (
          <div className={`mb-4 p-3 text-center rounded-xl text-sm font-medium ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {status.msg}
          </div>
        )}

        <div className="space-y-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/30 text-center">
            <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Exportar Ficheiro (.json)</h4>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-4">Descarregue uma cópia completa de todos os registos atuais.</p>
            <button onClick={handleExport} disabled={loading} className="btn-modern w-full py-2.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-2">
              <Download className="w-4 h-4"/> Exportar Base de Dados
            </button>
          </div>
          
          <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-xl border border-sky-200 dark:border-sky-500/30 text-center">
             <h4 className="text-sm font-semibold text-sky-700 dark:text-sky-300 mb-2">Importar Ficheiro (.json)</h4>
             <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-4">Carregue um backup antigo. Ficará espelhado com os dados na Nuvem.</p>
             <input type="file" ref={fileInputRef} accept=".json" onChange={handleImport} className="hidden" />
             <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="btn-modern w-full py-2.5 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-500">
               {loading ? 'A processar...' : 'Selecionar e Importar'}
             </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

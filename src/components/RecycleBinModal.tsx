import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, ShieldAlert } from 'lucide-react';
import { collection, query, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import type { Member } from '../types';
import Modal from './Modal';

export default function RecycleBinModal({ onClose }: { onClose: () => void }) {
  const [deletedMembers, setDeletedMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, `artifacts/${appId}/public/data/students`));
    const unsub = onSnapshot(q, async (snapshot) => {
      const members = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Member);
      
      const now = new Date().getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      
      const filtered = members.filter(m => m.deletedAt);
      const activeDeleted = [];
      
      for (const m of filtered) {
        if (m.deletedAt) {
          const deleteTime = new Date(m.deletedAt).getTime();
          if (now - deleteTime > thirtyDaysMs) {
            // Delete perm if older than 30 days
            try { await deleteDoc(doc(db, `artifacts/${appId}/public/data/students`, m.id)); } catch {}
            continue;
          }
          activeDeleted.push(m);
        }
      }
      
      activeDeleted.sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
      setDeletedMembers(activeDeleted);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    document.body.style.overflow = 'hidden';
    return () => {
      unsub();
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleRestore = async (id: string) => {
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/students`, id), { deletedAt: null });
      setDeletedMembers(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error(err);
      setErrorMessage('Falha ao restaurar');
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
      <Modal 
        isOpen={!!errorMessage} 
        onClose={() => setErrorMessage(null)} 
        title="Erro"
      >
        {errorMessage}
      </Modal>

      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-rose-900/50 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] p-6 w-full max-w-lg animated-scale-in">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/60 font-bold">
          <h2 className="text-xl font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Lixeira (30 dias)
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          {loading ? (
             <div className="flex justify-center p-6"><div className="w-6 h-6 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin"></div></div>
          ) : deletedMembers.length === 0 ? (
            <p className="text-slate-500 italic text-center p-4 text-sm">A lixeira está vazia.</p>
          ) : (
            deletedMembers.map(member => {
              const now = new Date().getTime();
              const delTime = new Date(member.deletedAt!).getTime();
              const daysLeft = Math.max(0, 30 - Math.floor((now - delTime) / (1000 * 60 * 60 * 24)));
              return (
                <div key={member.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-rose-50 dark:bg-rose-900/10 p-3 rounded-xl border border-rose-200 dark:border-rose-500/20 gap-3">
                  <div className="overflow-hidden">
                    <p className="font-semibold text-sm text-slate-700 dark:text-slate-300 truncate line-through">{member.name}</p>
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">Exclui permanentemente em {daysLeft} dias</p>
                  </div>
                  <button onClick={() => handleRestore(member.id)} className="w-full sm:w-auto flex-shrink-0 py-1.5 px-3 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-all dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/30 dark:hover:bg-emerald-500 hover:text-emerald-800 dark:hover:text-white">
                    Restaurar
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}


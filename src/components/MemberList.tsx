import { useEffect, useState } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { Search, Filter } from 'lucide-react';
import { db, appId } from '../lib/firebase';
import type { Member } from '../types';
import { CUSTOM_ROLES_KEY } from '../lib/constants';
import MemberEditModal from './MemberEditModal';

export default function MemberList() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const [customRoles, setCustomRoles] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_ROLES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const baseRoles = ["ALUNO(A)", "PROFESSOR(A)", "COLABORADOR(A)", "SEMINARISTA", "PADRE", "DIÁCONO", "BISPO"];
  const availableRoles = [...baseRoles, ...customRoles];

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, `artifacts/${appId}/public/data/students`));
      const snapshot = await getDocs(q);
      const loaded = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Member);
      loaded.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      // Apenas exibe membros aprovados e não excluídos (pula docs de config)
      setMembers(loaded.filter(m => m.alphaCode && !m.deletedAt && m.isApproved !== false));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClose = () => {
    setEditingMember(null);
    loadMembers(); // Recarrega os dados para mostrar as atualizações
  };

  // Filtragem local
  const filteredMembers = members.filter(m => {
    const term = searchTerm.toLowerCase();
    const matchName = m.name?.toLowerCase().includes(term);
    const matchRa = m.ra?.toLowerCase().includes(term);
    const matchRoles = m.roles?.some(role => role.toLowerCase().includes(term));
    const matchSearch = matchName || matchRa || matchRoles;

    const matchFilterRole = filterRole === '' || m.roles?.includes(filterRole);

    return matchSearch && matchFilterRole;
  });

  if (loading) {
    return (
      <div className="flex justify-center p-6">
         <div className="w-6 h-6 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mt-4 mb-4 no-print">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar membro ou RA..."
            className="input-modern w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-auto">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="w-4 h-4 text-slate-400" />
          </div>
          <select 
            value={filterRole} 
            onChange={(e) => setFilterRole(e.target.value)}
            className="input-modern w-full sm:w-48 pl-10 pr-4 py-2.5 rounded-xl text-sm appearance-none"
          >
            <option value="">Todos os Vínculos</option>
            {availableRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-xs sm:text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-500/10 px-3 py-1 mb-2 rounded-full border border-sky-200 dark:border-sky-500/20 inline-block w-fit no-print">
         Mostrando {filteredMembers.length} de {members.length} registos
      </div>

      {filteredMembers.length === 0 ? (
        <p className="text-slate-500 italic p-6 text-center text-sm">Nenhum registo encontrado com estes critérios.</p>
      ) : (
        <div className="space-y-2 max-h-[300px] sm:max-h-[400px] overflow-y-auto sm:print:max-h-none print:max-h-none print:overflow-visible custom-scrollbar pr-2">
          {filteredMembers.map(member => {
            const isInactive = member.isActive === false;
            const formattedDate = member.validityDate ? new Date(member.validityDate + 'T23:59:59').toLocaleDateString('pt-BR') : 'N/D';
            const avatarUrl = member.photoUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2364748b"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z"/></svg>';

            return (
              <div key={member.id} className="flex items-center justify-between bg-white dark:bg-slate-800/60 p-2.5 sm:p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all border border-slate-200 dark:border-slate-700/50">
                <div className={`flex items-center gap-3 overflow-hidden pr-2 w-full ${isInactive ? 'opacity-60' : ''}`}>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0 border border-slate-300 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-700/50">
                    <img src={avatarUrl} className={`w-full h-full object-cover ${isInactive ? 'grayscale' : ''}`} alt="Avatar" />
                  </div>
                  <div className="overflow-hidden flex-grow">
                    <p className={`font-semibold text-sm sm:text-base truncate flex items-center ${isInactive ? "line-through text-slate-500" : "text-slate-800 dark:text-slate-200"}`}>
                      {member.name} 
                      {member.ra && <span className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300 border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 rounded ml-2 text-[9px] font-normal">RA: {member.ra}</span>}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-sky-600 dark:text-sky-400/80 mb-0.5 truncate">{member.roles?.join(' • ')}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                      Válido até: {formattedDate}
                    </p>
                  </div>
                </div>
                <button onClick={() => setEditingMember(member)} className="flex-shrink-0 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-600/20 hover:bg-sky-500 hover:text-white border border-sky-300 dark:border-sky-500/30 transition-all no-print">
                  Gerir
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editingMember && (
        <MemberEditModal 
          member={editingMember} 
          onClose={() => setEditingMember(null)}
          onUpdate={handleUpdateClose}
        />
      )}
    </>
  );
}

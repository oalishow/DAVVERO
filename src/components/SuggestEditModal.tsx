import { useState, useEffect, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, Search, Image as ImageIcon } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, appId, createNotification } from '../lib/firebase';
import { resizeAndConvertToBase64 } from '../lib/imageUtils';
import { useSettings } from '../context/SettingsContext';
import type { Member } from '../types';
import ImageCropperModal from './ImageCropperModal';

interface SuggestEditModalProps {
  member: Member;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export default function SuggestEditModal({ member, onClose, onSubmitSuccess }: SuggestEditModalProps) {
  const { settings } = useSettings();
  const [name, setName] = useState(member.name || '');
  const [ra, setRa] = useState(member.ra || '');
  const [roles, setRoles] = useState<string[]>(member.roles || []);
  const [course, setCourse] = useState(member.course || '');
  const [diocese, setDiocese] = useState(member.diocese || '');
  const [cpf, setCpf] = useState(member.cpf || '');
  const [rg, setRg] = useState(member.rg || '');
  const [birthdate, setBirthdate] = useState(() => {
    let bd = member.birthdate || '';
    if (bd.includes('/')) {
      const parts = bd.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return bd;
  });
  const [email, setEmail] = useState(member.email || '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const baseRoles = ["ALUNO(A)", "PROFESSOR(A)", "COLABORADOR(A)", "SEMINARISTA", "PADRE", "DIÁCONO", "BISPO"];
  const availableRoles = [...baseRoles, ...settings.customRoles];

  const baseCourses = ["FILOSOFIA", "FILOSOFIA EAD", "TEOLOGIA", "TEOLOGIA EAD"];
  const availableCourses = [...baseCourses, ...settings.customCourses];

  const baseDioceses = ["MARÍLIA", "ASSIS", "LINS", "BAURU", "OURINHOS", "PRESIDENTE PRUDENTE", "ARAÇATUBA", "BOTUCATU"];
  const availableDioceses = [...baseDioceses, ...settings.customDioceses];

  const toggleRole = (role: string) => {
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropImageSrc(URL.createObjectURL(file));
    }
    e.target.value = '';
  };

  const handleSubmit = async () => {
    const rolesChanged = JSON.stringify([...roles].sort()) !== JSON.stringify([...(member.roles || [])].sort());
    
    const nameMatch = (name || '').trim() === (member.name || '').trim();
    const raMatch = (ra || '').trim() === (member.ra || '').trim();
    const courseMatch = (course || '') === (member.course || '');
    const dioceseMatch = (diocese || '') === (member.diocese || '');
    const cpfMatch = (cpf || '').trim() === (member.cpf || '').trim();
    const rgMatch = (rg || '').trim() === (member.rg || '').trim();
    const birthdateMatch = (birthdate || '').trim() === (member.birthdate || '').trim();
    const emailMatch = (email || '').trim() === (member.email || '').trim();

    if (nameMatch && raMatch && courseMatch && dioceseMatch && cpfMatch && rgMatch && birthdateMatch && emailMatch && !rolesChanged && !photoBase64) {
      setError('Altere pelo menos um dado antes de enviar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const pendingChanges: any = {};
      if (!nameMatch) pendingChanges.name = name.trim();
      if (!raMatch) pendingChanges.ra = ra.trim();
      if (!courseMatch) pendingChanges.course = course;
      if (!dioceseMatch) pendingChanges.diocese = diocese;
      if (!cpfMatch) pendingChanges.cpf = cpf.trim();
      if (!rgMatch) pendingChanges.rg = rg.trim();
      if (!birthdateMatch) pendingChanges.birthdate = birthdate.trim();
      if (!emailMatch) pendingChanges.email = email.trim();
      if (rolesChanged) pendingChanges.roles = roles;
      if (photoBase64) pendingChanges.photoUrl = photoBase64;

      await updateDoc(doc(db, `artifacts/${appId}/public/data/students`, member.id), {
        pendingChanges: pendingChanges,
        hasPendingAction: true
      });

      // Notification for admin
      await createNotification({
        recipientId: "admin",
        title: "Sugerida Nova Edição",
        message: `${member.name} enviou uma sugestão de edição de perfil.`,
        type: "edicao"
      });

      // Local onde entra notificação EmailJS extendida
      onSubmitSuccess();
    } catch (e) {
      console.error(e);
      setError('Falha de conexão. Tente de novo.');
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
      {cropImageSrc && (
        <ImageCropperModal
          imageSrc={cropImageSrc}
          onClose={() => setCropImageSrc(null)}
          onCropComplete={(croppedBase64) => {
            setPhotoBase64(croppedBase64);
            setCropImageSrc(null);
          }}
        />
      )}
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] p-6 md:p-8 w-full max-w-xl animated-scale-in my-auto max-h-[90vh] flex flex-col relative overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
           <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
        </button>

        <h2 className="text-xl font-bold text-sky-600 dark:text-sky-400 mb-2">Sugerir Correção de Dados</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Modifique as informações que pretende atualizar. O seu pedido será enviado para aprovação.</p>

        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm font-medium rounded-xl">{error}</div>}

        <div className="space-y-4">
          <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase mb-1">Novo Nome</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-modern w-full rounded-xl py-3 px-4 text-sm" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase mb-1">Novo RG</label>
                  <input type="text" value={rg} onChange={e => setRg(e.target.value)} className="input-modern w-full rounded-xl py-3 px-4 text-sm" />
              </div>
              <div>
                  <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase mb-1">Novo CPF</label>
                  <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} className="input-modern w-full rounded-xl py-3 px-4 text-sm" />
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase mb-1">Nova Data Nasc.</label>
                  <input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)} className="input-modern w-full rounded-xl py-3 px-4 text-sm uppercase" />
              </div>
              <div>
                  <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase mb-1">Novo RA</label>
                  <input type="text" value={ra} onChange={e => setRa(e.target.value)} className="input-modern w-full rounded-xl py-3 px-4 text-sm" />
              </div>
          </div>

          <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase mb-1">Novo E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-modern w-full rounded-xl py-3 px-4 text-sm" />
          </div>
          
          <div className="pt-1 border-t border-slate-200 dark:border-slate-700/50 mt-1">
              <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase mb-2 mt-2">Novo Vínculo</label>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map(role => (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${roles.includes(role) ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'}`}
                  >
                    {role}
                  </button>
                ))}
              </div>
          </div>

          <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase mb-1 mt-2">Novo Curso</label>
              <select value={course} onChange={e => setCourse(e.target.value)} className="input-modern w-full rounded-xl py-3 px-4 text-sm">
                  <option value="">Nenhum / Não aplicável</option>
                  {availableCourses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
              </select>
          </div>
          <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase mb-1 mt-2">Nova Diocese</label>
              <select value={diocese} onChange={e => setDiocese(e.target.value)} className="input-modern w-full rounded-xl py-3 px-4 text-sm">
                  <option value="">Nenhum / Não aplicável</option>
                  {availableDioceses.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
              </select>
          </div>
          <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">Nova Fotografia (Opcional)</label>
              <div className="flex items-center gap-4">
                {photoBase64 ? (
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-300 dark:border-slate-600 shadow-sm flex-shrink-0">
                    <img src={photoBase64} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-300 dark:border-slate-600 shadow-sm flex-shrink-0">
                    <img src={member.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'User')}&background=e2e8f0&color=475569`} alt="User" className="w-full h-full object-cover" />
                  </div>
                )}
                <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors text-sm font-semibold dark:bg-sky-900/20 dark:border-sky-600/50 dark:text-sky-400">
                  <ImageIcon className="w-5 h-5"/>
                  {photoBase64 ? 'Alterar Fotografia' : 'Escolher Nova Foto (Recortar 1:1)'}
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
          </div>
        </div>

        <button onClick={handleSubmit} disabled={loading} className="mt-6 btn-modern w-full py-3.5 px-4 rounded-xl shadow-lg shadow-sky-600/20 text-sm font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500">
            {loading ? 'A Enviar...' : 'Enviar para Análise'}
        </button>
      </div>
    </div>,
    document.body
  );
}

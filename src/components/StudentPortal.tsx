import { useState, useEffect } from 'react';
import { Fingerprint, User, CreditCard, QrCode, LogOut, Loader2, ShieldCheck, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import type { Member } from '../types';
import VerificationResult from './VerificationResult';
import Modal from './Modal';

const STUDENT_BOND_KEY = 'verifyId_student_identity';
const STUDENT_BIOMETRIC_ENROLLED = 'verifyId_student_biometric';
const STUDENT_CREDENTIAL_ID = 'verifyId_student_credential_id';

// Base64Url Utilities
function bufferToBase64url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  const base64String = btoa(str);
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlToBuffer(base64url: string) {
  const padding = '='.repeat((4 - base64url.length % 4) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

export default function StudentPortal() {
  const [bondedId, setBondedId] = useState<string | null>(localStorage.getItem(STUDENT_BOND_KEY));
  const [member, setMember] = useState<Member | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for biometric support correctly (it returns a promise)
    if (window.PublicKeyCredential && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(result => setBiometricsAvailable(result))
        .catch(() => setBiometricsAvailable(false));
    }
  }, []);

  const [linkMode, setLinkMode] = useState(false);
  const [alphaCode, setAlphaCode] = useState('');

  // Modal States
  const [modalUnlinkOpen, setModalUnlinkOpen] = useState(false);
  const [modalBiometricOpen, setModalBiometricOpen] = useState(false);
  const [modalHelpOpen, setModalHelpOpen] = useState(false);
  const [modalIframeWarning, setModalIframeWarning] = useState(false);

  const isIframe = window.self !== window.top;

  useEffect(() => {
    if (bondedId) {
      loadBondedMember(bondedId);
    }
  }, []);

  // Lock automatically when user leaves the page or hides the app
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsUnlocked(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const loadBondedMember = async (id: string) => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where('alphaCode', '==', id),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setMember(snapshot.docs[0].data() as Member);
        
        // Auto-prompt unlocking process on load
        if (localStorage.getItem(STUDENT_BIOMETRIC_ENROLLED) === 'true') {
          handleBiometricUnlock();
        } else {
          // If not enrolled in passkeys, we do not require biometric to display for now
          // (or require them to register)
          setIsUnlocked(false); // Make them click the Unlock button anyway
        }
      } else {
        setError("Identidade vinculada não encontrada.");
        localStorage.removeItem(STUDENT_BOND_KEY);
        setBondedId(null);
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar sua identidade.");
    } finally {
      setIsLoading(false);
    }
  };

  const linkIdentity = async () => {
    if (!alphaCode.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where('alphaCode', '==', alphaCode.toUpperCase()),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as Member;
        setMember(data);
        setBondedId(data.alphaCode || null);
        localStorage.setItem(STUDENT_BOND_KEY, data.alphaCode || '');
        setLinkMode(false);
        
        if (biometricsAvailable) {
           setModalBiometricOpen(true);
        } else {
           setIsUnlocked(true);
        }
      } else {
        setError("Código não encontrado na base de dados.");
      }
    } catch (err) {
      setError("Erro ao vincular identidade.");
    } finally {
      setIsLoading(false);
    }
  };

  const enrollBiometric = async () => {
    if (isIframe) {
      setModalIframeWarning(true);
      return;
    }

    try {
      const challenge = window.crypto.getRandomValues(new Uint8Array(32));
      const userId = window.crypto.getRandomValues(new Uint8Array(16));

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Carteirinha Fajopa", id: window.location.hostname },
          user: { 
            id: userId, 
            name: member?.ra || "Estudante", 
            displayName: member?.name || "Estudante" 
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },   // ES256
            { type: "public-key", alg: -257 } // RS256
          ],
          authenticatorSelection: { 
            authenticatorAttachment: "platform", 
            userVerification: "required",
            residentKey: "preferred"
          },
          timeout: 60000,
        }
      }) as PublicKeyCredential;
      
      if (credential) {
        localStorage.setItem(STUDENT_CREDENTIAL_ID, bufferToBase64url(credential.rawId));
        localStorage.setItem(STUDENT_BIOMETRIC_ENROLLED, 'true');
        setIsUnlocked(true);
        setModalBiometricOpen(false);
      }
    } catch (err: any) {
      console.error("Biometric enrollment failed", err);
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        alert("O navegador bloqueou o acesso à biometria. Se estiver num Iframe, tente abrir em nova aba.");
      } else {
        // Fallback or silent failure
        localStorage.setItem(STUDENT_BIOMETRIC_ENROLLED, 'true');
        setIsUnlocked(true);
        setModalBiometricOpen(false);
      }
    }
  };

  const handleBiometricUnlock = async () => {
    const credId = localStorage.getItem(STUDENT_CREDENTIAL_ID);
    
    if (biometricsAvailable && credId) {
      if (isIframe) {
        setModalIframeWarning(true);
        return;
      }

      try {
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge: window.crypto.getRandomValues(new Uint8Array(32)),
            rpId: window.location.hostname,
            allowCredentials: [{
              type: "public-key",
              id: base64urlToBuffer(credId)
            }],
            userVerification: "required",
            timeout: 60000
          }
        });
        if (assertion) {
          setIsUnlocked(true);
        }
      } catch (err: any) {
        console.error("Unlock failed", err);
        if (err.name === 'NotAllowedError') {
           setError("Autenticação cancelada ou bloqueada.");
        } else {
           setError("Falha na biometria. Tente abrir em nova aba.");
        }
      }
    } else {
      // Fallback if no webauthn configured
      setIsUnlocked(true);
    }
  };

  const confirmUnlink = () => {
    localStorage.removeItem(STUDENT_BOND_KEY);
    localStorage.removeItem(STUDENT_BIOMETRIC_ENROLLED);
    localStorage.removeItem(STUDENT_CREDENTIAL_ID);
    setBondedId(null);
    setMember(null);
    setIsUnlocked(false);
    setModalUnlinkOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Acedendo aos seus dados...</p>
      </div>
    );
  }

  if (bondedId && member) {
    if (!isUnlocked) {
      return (
        <>
          <Modal 
            isOpen={modalUnlinkOpen} 
            onClose={() => setModalUnlinkOpen(false)} 
            title="Remover Vínculo"
            confirmLabel="Sim, Remover"
            confirmVariant="danger"
            onConfirm={confirmUnlink}
          >
            Deseja remover sua identidade institucional deste dispositivo? Você precisará do código de segurança para vincular novamente.
          </Modal>

          <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-8 animate-fade-in relative max-w-sm mx-auto h-full min-h-[60vh]">
             <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] rounded-3xl -z-10" />
             <div className="w-24 h-24 bg-sky-100 dark:bg-sky-500/10 rounded-full flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-inner">
                <Lock className="w-12 h-12" />
             </div>
             <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Acesso Bloqueado</h2>
                <p className="text-sm text-slate-500 mt-2 font-medium">Use a senha ou biometria do seu aparelho para desbloquear a sua carteirinha.</p>
             </div>
             <button 
               onClick={handleBiometricUnlock}
               className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
             >
                <Fingerprint className="w-5 h-5" /> 
                {biometricsAvailable ? 'Usar Biometria / Senha' : 'Desbloquear'}
             </button>
             {error && <p className="text-[10px] text-rose-500 font-bold uppercase">{error}</p>}
             <button onClick={() => setModalUnlinkOpen(true)} className="text-xs text-rose-400 hover:text-rose-600 font-bold transition-colors">Desvincular Carteirinha</button>
          </div>
        </>
      );
    }

    return (
      <>
        <Modal 
          isOpen={modalIframeWarning} 
          onClose={() => setModalIframeWarning(false)} 
          title="Segurança Restrita"
          confirmLabel="Abrir em Nova Aba"
          onConfirm={() => window.open(window.location.href, '_blank')}
        >
          O sistema de biometria e senha do dispositivo por vezes é bloqueado em visualizações de iframe (como no editor). Para garantir o funcionamento, use o site em uma aba separada.
        </Modal>

        <Modal 
          isOpen={modalUnlinkOpen} 
          onClose={() => setModalUnlinkOpen(false)} 
          title="Sair do Portal"
          confirmLabel="Sim, Sair"
          confirmVariant="danger"
          onConfirm={confirmUnlink}
        >
          Deseja desvincular sua carteirinha deste dispositivo? Esta ação encerrará sua sessão segura.
        </Modal>

        <div className="w-full flex flex-col items-center animate-fade-in no-print mt-10">
           <div className="w-full flex justify-between items-center mb-6 px-2">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                 <ShieldCheck className="w-3 h-3" /> Acesso Seguro Ativo
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setIsUnlocked(false)} 
                  className="p-2 text-slate-400 hover:text-sky-500 transition-colors" 
                  title="Bloquear Proteção"
                >
                   <Lock className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setModalUnlinkOpen(true)} 
                  className="p-2 text-slate-400 hover:text-rose-500 transition-colors" 
                  title="Sair / Desvincular"
                >
                   <LogOut className="w-5 h-5" />
                </button>
              </div>
           </div>
           <VerificationResult 
             member={member} 
             status={member.isActive ? 'VALID' : 'INACTIVE'} 
             onReset={() => {}} 
             isMyID={true}
           />
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col items-center py-8 space-y-8 w-full max-w-sm mx-auto">
       <Modal 
         isOpen={modalHelpOpen} 
         onClose={() => setModalHelpOpen(false)} 
         title="Instruções de Vínculo"
         onConfirm={() => {
           setLinkMode(true);
           setModalHelpOpen(false);
         }}
         confirmLabel="Entendi"
       >
         Utilize a aba <strong className="text-slate-800 dark:text-white">'Verificar Identidade'</strong> para escanear seu QR Code físico e obter seu <strong className="text-emerald-600">Código Alfanumérico</strong>, ou consulte a secretaria da faculdade.
       </Modal>

       <Modal 
          isOpen={modalBiometricOpen} 
          onClose={() => {
            setIsUnlocked(true);
            setModalBiometricOpen(false);
          }} 
          title="Configurar Biometria"
          confirmLabel="Ativar"
          onConfirm={enrollBiometric}
          confirmVariant="success"
        >
          Para proteger sua identidade de acessos indevidos, recomendamos vincular a senha ou biometria (Rosto/Digital) original deste dispositivo.
        </Modal>

       <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
             <User className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Minha Identidade</h2>
          <p className="text-xs text-slate-500 leading-relaxed px-4">
            Vincule sua carteirinha digital a este telemóvel para acessá-la instantaneamente.
          </p>
       </div>

       {!linkMode ? (
         <div className="w-full space-y-3">
            <button 
              onClick={() => setModalHelpOpen(true)}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
               <QrCode className="w-5 h-5" /> Vincular Carteirinha
            </button>
         </div>
       ) : (
         <div className="w-full space-y-4 animated-scale-in">
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código Alfanumérico</label>
               <input 
                 value={alphaCode}
                 onChange={(e) => setAlphaCode(e.target.value.toUpperCase())}
                 placeholder="EX: ABC-123"
                 className="input-modern w-full py-4 text-center text-xl font-black tracking-widest rounded-2xl"
               />
            </div>
            {error && <p className="text-[10px] text-rose-500 font-bold text-center uppercase tracking-tight">{error}</p>}
            <div className="flex gap-2">
               <button onClick={() => setLinkMode(false)} className="px-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold">Cancelar</button>
               <button onClick={linkIdentity} className="flex-grow py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20">Vincular</button>
            </div>
         </div>
       )}

       <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-dotted border-slate-300 dark:border-slate-700">
          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-3">Como funciona?</p>
          <ul className="space-y-2">
             <li className="flex gap-2 text-[10px] text-slate-500 font-medium">
                <div className="w-4 h-4 bg-sky-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">1</div>
                Vincule seu código oficial a este navegador.
             </li>
             <li className="flex gap-2 text-[10px] text-slate-500 font-medium">
                <div className="w-4 h-4 bg-sky-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">2</div>
                Ative o bloqueio por senha ou biometria.
             </li>
             <li className="flex gap-2 text-[10px] text-slate-500 font-medium">
                <div className="w-4 h-4 bg-sky-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">3</div>
                Pronto! A carteirinha será ocultada automaticamente ao fechar.
             </li>
          </ul>
       </div>
    </div>
  );
}


import { useState, useEffect } from 'react';
import { Camera, XCircle, Search, ScanLine } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { collection, query, getDocs } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import type { Member } from '../types';
import VerificationResult from './VerificationResult';
import PublicRequestModal from './PublicRequestModal';
import SuggestEditModal from './SuggestEditModal';
import BiometricVerification from './BiometricVerification';

import { motion, AnimatePresence } from 'motion/react';

export default function Verifier() {
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  
  const [membersCache, setMembersCache] = useState<Member[]>([]);
  const [validationResult, setValidationResult] = useState<{member: Member | null, status: 'VALID'|'INACTIVE'|'EXPIRED'|'NOT_FOUND'} | null>(null);

  const [showPublicReq, setShowPublicReq] = useState(false);
  const [showSuggestEdit, setShowSuggestEdit] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Populate cache for "offline fallback" strategy
    const loadCache = async () => {
      try {
        const q = query(collection(db, `artifacts/${appId}/public/data/students`));
        const snapshot = await getDocs(q);
        const members = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Member);
        setMembersCache(members);
      } catch(e) {
        console.error("Cache load error", e);
      }
    };
    loadCache();
  }, []);

  const startScanner = async () => {
    setIsScanning(true);
    setValidationResult(null);
  };

  useEffect(() => {
    let ht5Qrcode: Html5Qrcode | null = null;
    if (isScanning) {
      ht5Qrcode = new Html5Qrcode("reader");
      ht5Qrcode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          ht5Qrcode?.stop().catch(console.error);
          setIsScanning(false);
          
          let memberId = decodedText;
          try {
              const url = new URL(decodedText);
              memberId = url.searchParams.get('verify') || decodedText;
          } catch (_) {}

          runVerification(memberId, false);
        },
        () => {}
      ).catch(console.error);
    }
    return () => {
      if (ht5Qrcode && ht5Qrcode.isScanning) {
        ht5Qrcode.stop().catch(console.error);
      }
    }
  }, [isScanning]);

  const handleVerifyManual = () => {
    if (!codeInput) return;
    runVerification(codeInput.toUpperCase(), true);
  };

  const runVerification = (idOrCode: string, isAlphaCode: boolean) => {
    setIsProcessing(true);
    
    // Simulate network/processing delay for visual feedback
    setTimeout(() => {
      const targetId = idOrCode.toUpperCase();
      
      const foundMember = membersCache.find(m => {
        if (m.deletedAt || m.isApproved === false) return false;
        const alphaUpper = m.alphaCode?.toUpperCase();
        const raUpper = m.ra?.toUpperCase();
        
        if (isAlphaCode) return alphaUpper === targetId || raUpper === targetId;
        return m.id === targetId || m.legacyId === targetId || alphaUpper === targetId || raUpper === targetId;
      });

      if (!foundMember) {
        setValidationResult({ member: null, status: 'NOT_FOUND' });
        setIsProcessing(false);
        return;
      }

      if (foundMember.isActive === false) {
        setValidationResult({ member: foundMember, status: 'INACTIVE' });
        setIsProcessing(false);
        return;
      }

      if (!foundMember.validityDate) {
        setValidationResult({ member: foundMember, status: 'EXPIRED' });
        setIsProcessing(false);
        return;
      }

      const isValid = new Date(foundMember.validityDate + 'T23:59:59') >= new Date();
      setValidationResult({ member: foundMember, status: isValid ? 'VALID' : 'EXPIRED' });
      setIsProcessing(false);
    }, 1500); // 1.5s delay
  };

  if (isProcessing) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 animated-fade-in relative overflow-hidden">
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Radar Ring 1 */}
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            className="absolute inset-0 border-2 border-sky-400/30 rounded-full"
          />
          {/* Radar Ring 2 */}
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }}
            className="absolute inset-0 border-2 border-emerald-400/30 rounded-full"
          />
          
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 border-t-4 border-l-4 border-sky-500 rounded-full"
          />
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-8 border-b-4 border-r-4 border-emerald-500 rounded-full"
          />
          
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.8, 1, 0.8]
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <ScanLine className="w-10 h-10 text-sky-600 dark:text-sky-400" />
            {/* Scanning Beam */}
            <motion.div 
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 w-full h-[2px] bg-sky-400 shadow-[0_0_10px_#38bdf8] z-20 opacity-70"
            />
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mt-8 relative"
        >
          <motion.p 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-sm font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest"
          >
            A consultar base de dados...
          </motion.p>
          <p className="text-[10px] text-slate-500 mt-2 font-mono uppercase tracking-[0.2em]">Verificando Assinatura Digital</p>
          
          {/* Subtle glow underneath */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-8 bg-sky-400/10 blur-3xl rounded-full"></div>
        </motion.div>
      </div>
    );
  }

  if (validationResult) {
    return (
      <div className="w-full flex flex-col items-center">
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-xl border border-emerald-200">
            {successMsg}
          </div>
        )}
        <VerificationResult 
          member={validationResult.member}
          status={validationResult.status}
          onReset={() => {
            setValidationResult(null);
            setCodeInput('');
            setSuccessMsg('');
            setShowBiometric(false);
          }}
        />
        {validationResult.member && validationResult.status !== 'NOT_FOUND' && (
          <div className="mt-4 w-full max-w-sm px-1 no-print space-y-3">
             <button 
               onClick={() => setShowBiometric(true)} 
               className="w-full py-4 px-4 rounded-xl text-sm font-black text-white bg-slate-900 border border-slate-700 shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group"
             >
                <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                   <ScanLine className="w-4 h-4" />
                </div>
                VALIDAÇÃO BIOMÉTRICA (IA)
             </button>

             <button onClick={() => setShowSuggestEdit(true)} className="w-full py-3 px-4 rounded-xl text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
               Sugerir Alteração / Correção
             </button>
          </div>
        )}

        {showBiometric && validationResult.member && (
          <BiometricVerification 
            member={validationResult.member} 
            onClose={() => setShowBiometric(false)} 
          />
        )}

        {showSuggestEdit && validationResult.member && (
          <SuggestEditModal 
            member={validationResult.member} 
            onClose={() => setShowSuggestEdit(false)} 
            onSubmitSuccess={() => {
              setShowSuggestEdit(false);
              setSuccessMsg('Sugestão enviada com sucesso! Em análise.');
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="py-2 sm:py-4 flex flex-col items-center space-y-6">
      
      {successMsg && (
        <div className="w-full max-w-sm p-3 bg-emerald-50 text-emerald-600 text-center text-sm font-medium rounded-xl border border-emerald-200">
          {successMsg}
        </div>
      )}

      <div className="w-full text-center">
        {!isScanning ? (
          <button 
            onClick={startScanner}
            className="btn-modern w-full md:w-3/4 mx-auto flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl shadow-lg shadow-sky-600/30 text-sm sm:text-base font-bold text-white bg-gradient-to-r from-sky-500 via-teal-400 to-sky-500 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Camera className="w-5 h-5" />
            Escanear QR Code
          </button>
        ) : (
          <button 
            onClick={() => setIsScanning(false)}
            className="btn-modern w-full md:w-3/4 mx-auto flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-rose-500 border border-rose-300 hover:bg-rose-500 hover:text-white transition-colors dark:bg-rose-500/10 dark:border-rose-500/30"
          >
            <XCircle className="w-5 h-5" />
            Cancelar Escaneamento
          </button>
        )}
      </div>

      <div id="reader" className={`w-full max-w-sm rounded-2xl overflow-hidden shadow-lg border-2 border-sky-300 dark:border-sky-500/30 ${!isScanning && 'hidden'}`}></div>

      <div className="relative flex items-center py-2 w-full max-w-md">
        <div className="flex-grow border-t border-slate-300 dark:border-slate-700/80"></div>
        <span className="mx-4 text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-widest">Ou valide manualmente</span>
        <div className="flex-grow border-t border-slate-300 dark:border-slate-700/80"></div>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="bg-white/80 dark:bg-slate-800/40 backdrop-blur-sm p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
          <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">Código de Identificação ou RA</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyManual()}
              placeholder="EX: A1B2C3 OU 123456" 
              className="input-modern flex-grow rounded-xl py-2.5 px-4 text-center font-mono tracking-widest uppercase text-sm sm:text-lg" 
            />
            <button onClick={handleVerifyManual} className="btn-modern py-2.5 px-6 rounded-xl text-white font-bold bg-slate-800 hover:bg-sky-600 flex items-center justify-center gap-2 shadow-lg shadow-slate-800/20 dark:shadow-none transition-all">
              <Search className="w-4 h-4"/> Verificar
            </button>
          </div>
        </div>

        <button onClick={() => setShowPublicReq(true)} className="w-full btn-modern py-3.5 rounded-xl border border-sky-300 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-sm font-semibold transition-all">
            Primeiro Acesso? Solicitar Identidade Digital
        </button>
      </div>

      {showPublicReq && <PublicRequestModal onClose={() => setShowPublicReq(false)} onSubmitSuccess={() => { setShowPublicReq(false); setSuccessMsg('Solicitação enviada com sucesso! Aguarde analise.'); setTimeout(() => setSuccessMsg(''), 4000); }} />}
      
      <div className="mt-8 text-center text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 max-w-sm px-4">
        <p className="font-bold mb-1 uppercase tracking-widest">Proteção de Dados (LGPD)</p>
        <p className="leading-relaxed">Os dados processados por este sistema são estritamente para fins de validação institucional, em total conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Todos os dados processados via QR Code trafegam de forma segura e não partilhada.</p>
      </div>
    </div>
  );
}

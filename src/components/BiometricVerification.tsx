import { useState, useRef, useEffect } from 'react';
import { Camera, ShieldCheck, UserCheck, UserX, Loader2, RotateCcw, X, Scan } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { createPortal } from 'react-dom';
import type { Member } from '../types';

interface BiometricResult {
  match: boolean;
  confidence: number;
  reasoning: string;
}

interface BiometricVerificationProps {
  member: Member;
  onClose: () => void;
}

export default function BiometricVerification({ member, onClose }: BiometricVerificationProps) {
  const [step, setStep] = useState<'loading_profile' | 'camera' | 'verifying' | 'result'>('loading_profile');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [storedImageBase64, setStoredImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<BiometricResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load profile photo as base64 immediately
  useEffect(() => {
    const loadProfile = async () => {
      if (!member.photoUrl) {
        setError("Membro não possui foto de perfil cadastrada para biometria.");
        setStep('camera'); // Allow trying but will fail comparison
        return;
      }

      try {
        const base64 = await getBase64FromUrl(member.photoUrl);
        setStoredImageBase64(base64);
        setStep('camera');
      } catch (err) {
        console.error("Failed to load profile photo for comparison", err);
        setError("Não foi possível carregar a foto oficial para comparação.");
        setStep('camera');
      }
    };

    loadProfile();
  }, [member.photoUrl]);

  // Handle camera start/stop
  useEffect(() => {
    if (step === 'camera' && !capturedImage) {
      startCamera();
    }
    return () => stopCamera();
  }, [step, capturedImage]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const runComparison = async () => {
    if (!capturedImage || !storedImageBase64) return;
    
    setStep('verifying');
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Analise estas duas imagens. A primeira é a foto de perfil oficial de um membro institucional. A segunda é uma captura recente da câmera de segurança/verificação. Determine com alta precisão se as duas fotos pertencem à mesma pessoa (análise biométrica facial). Ignore variações de iluminação, óculos ou barba se as características estruturais do rosto forem as mesmas. Responda estritamente em JSON com 'match' (boolean), 'confidence' (número de 0 a 100) e 'reasoning' (uma frase curta e técnica explicando o motivo em português)." },
              { inlineData: { mimeType: "image/jpeg", data: storedImageBase64.split(',')[1] } },
              { inlineData: { mimeType: "image/jpeg", data: capturedImage.split(',')[1] } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              match: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              reasoning: { type: Type.STRING }
            },
            required: ["match", "confidence", "reasoning"]
          }
        }
      });

      const data = JSON.parse(response.text) as BiometricResult;
      setResult(data);
      setStep('result');
    } catch (err) {
      console.error("Gemini Error:", err);
      setError("Erro ao processar verificação biométrica. Tente novamente.");
      setStep('camera');
      setCapturedImage(null);
    }
  };

  const getBase64FromUrl = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg"));
      };
      img.onerror = () => reject(new Error("Image load failed"));
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animated-fade-in no-print">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex items-center gap-2">
             <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <ShieldCheck className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">Biometria Facial</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Verificação de Identidade IA</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-grow flex flex-col items-center">
          
          {step === 'loading_profile' && (
            <div className="py-20 flex flex-col items-center gap-4">
               <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
               <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Carregando dados biométricos...</p>
            </div>
          )}

          {step === 'camera' && (
            <div className="w-full flex flex-col items-center gap-6">
               <div className="relative w-full aspect-square max-w-[280px] rounded-3xl overflow-hidden border-4 border-slate-200 dark:border-slate-800 bg-black shadow-inner">
                  {!capturedImage ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                      <div className="absolute inset-0 border-[2px] border-white/30 rounded-[20%] m-8 flex items-center justify-center">
                         <div className="w-full h-[1px] bg-sky-400/50 shadow-[0_0_15px_#38bdf8] animate-[scan_3s_infinite_linear]" />
                      </div>
                    </>
                  ) : (
                    <img src={capturedImage} className="w-full h-full object-cover scale-x-[-1]" />
                  )}
               </div>

               {error && (
                 <p className="text-xs text-rose-500 font-medium bg-rose-50 dark:bg-rose-500/10 p-3 rounded-xl border border-rose-100 dark:border-rose-500/20 w-full text-center">
                   {error}
                 </p>
               )}

               <div className="flex gap-3 w-full">
                 {!capturedImage ? (
                   <button 
                    onClick={capturePhoto} 
                    className="flex-grow py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition-all active:scale-95"
                   >
                     <Camera className="w-5 h-5" /> Capturar Rosto
                   </button>
                 ) : (
                   <>
                    <button 
                      onClick={() => setCapturedImage(null)} 
                      className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 transition-colors"
                    >
                      <RotateCcw className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={runComparison} 
                      disabled={!storedImageBase64}
                      className="flex-grow py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Scan className="w-5 h-5" /> Iniciar Verificação
                    </button>
                   </>
                 )}
               </div>
               <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center uppercase tracking-widest font-semibold px-4 italic">
                  Posicione o rosto no centro da moldura para uma análise precisa.
               </p>
            </div>
          )}

          {step === 'verifying' && (
            <div className="py-16 flex flex-col items-center gap-8 w-full">
               <div className="relative w-32 h-32">
                 <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 border-4 border-t-sky-500 border-r-transparent border-b-sky-500 border-l-transparent rounded-full" />
                 <motion.div animate={{ rotate: -360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="absolute inset-4 border-4 border-t-emerald-500 border-r-transparent border-b-emerald-500 border-l-transparent rounded-full" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Scan className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-pulse" />
                 </div>
               </div>
               <div className="text-center space-y-2">
                  <h3 className="text-sky-600 dark:text-sky-400 font-black uppercase tracking-widest text-sm">IA Processando Biometria</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Comparamdo pontos nodais faciais...</p>
               </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="w-full flex flex-col items-center gap-6">
               <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg ${result.match ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-600'}`}>
                  {result.match ? <UserCheck className="w-12 h-12" /> : <UserX className="w-12 h-12" />}
               </div>
               
               <div className="text-center w-full">
                  <h3 className={`text-2xl font-black uppercase tracking-tighter ${result.match ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {result.match ? 'Identidade Confirmada' : 'Divergência Detectada'}
                  </h3>
                  <div className="mt-2 inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Confiança IA:</span>
                    <span className={`text-xs font-black ${result.confidence > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{result.confidence}%</span>
                  </div>
               </div>

               <div className="w-full bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2 opacity-70">Parecer Técnico</p>
                  <p className="text-sm font-medium leading-relaxed italic">"{result.reasoning}"</p>
               </div>

               <button 
                onClick={onClose} 
                className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg active:scale-95 ${result.match ? 'bg-emerald-600 shadow-emerald-600/20' : 'bg-slate-800 shadow-slate-800/20'}`}
               >
                 {result.match ? 'Prosseguir para Acesso' : 'Fechar Verificação'}
               </button>
            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800">
           <p className="text-[9px] text-slate-400 text-center leading-tight">
             Esta verificação utiliza processamento neural local e em nuvem segura. Nenhuma imagem é armazenada permanentemente após a análise.
           </p>
        </div>
      </motion.div>
      
      <style>{`
        @keyframes scan {
          0% { top: 10%; }
          50% { top: 90%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>,
    document.body
  );
}

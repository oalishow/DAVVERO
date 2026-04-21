import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings, Save, ShieldAlert, Mail, Link, UserCircle, Palette, Upload, Trash2, Wand2, FileText, ImageIcon, RotateCw, Move } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import FajopaIDCard from './FajopaIDCard';
import { useSettings } from '../context/SettingsContext';
import { 
  PASSWORD_STORAGE_KEY, 
  URL_STORAGE_KEY, 
  DIRECTOR_NAME_KEY, 
  DEFAULT_ADMIN_PASSWORD, 
  DEFAULT_PUBLIC_URL, 
  DEFAULT_DIRECTOR_NAME,
  INSTITUTION_LOGO_KEY,
  INSTITUTION_NAME_KEY,
  INSTITUTION_COLOR_KEY,
  DIRECTOR_SIGNATURE_KEY,
  CARD_LOGO_KEY,
  CARD_BACK_LOGO_KEY,
  CARD_FRONT_LOGO_CONFIG_KEY,
  CARD_BACK_LOGO_CONFIG_KEY,
  CARD_FRONT_TEXT_KEY,
  CARD_BACK_TEXT_KEY,
  CARD_VISIBLE_FIELDS_KEY,
  CARD_BACK_IMAGE_KEY,
  INSTITUTION_DESCRIPTION_KEY,
  CARD_DESCRIPTION_KEY,
  CARD_SIGNATURE_CONFIG_KEY
} from '../lib/constants';

interface LogoConfig {
  x: number;
  y: number;
  scale: number;
}

const DEFAULT_CONFIG: LogoConfig = { x: 0, y: 0, scale: 100 };

const MOCK_MEMBER = {
  id: 'preview',
  name: 'JOÃO DA SILVA SAMPLE',
  ra: '2024.0001',
  course: 'TEOLOGIA',
  birthdate: '01/01/2000',
  validityDate: '2025-12-31',
  photoUrl: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop',
  alphaCode: 'PREVIEW',
  isActive: true,
  isApproved: true,
  createdAt: new Date().toISOString()
};

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings: cloudSettings, updateSettings } = useSettings();

  const [url, setUrl] = useState(cloudSettings.url);
  const [directorName, setDirectorName] = useState(cloudSettings.directorName);
  const [instName, setInstName] = useState(cloudSettings.instName);
  const [instColor, setInstColor] = useState(cloudSettings.instColor);
  const [instLogo, setInstLogo] = useState<string | null>(cloudSettings.instLogo);
  const [cardLogo, setCardLogo] = useState<string | null>(cloudSettings.cardLogo);
  const [cardBackLogo, setCardBackLogo] = useState<string | null>(cloudSettings.cardBackLogo);
  const [cardBackImage, setCardBackImage] = useState<string | null>(cloudSettings.cardBackImage);
  
  const [cardFrontText, setCardFrontText] = useState(cloudSettings.cardFrontText);
  const [cardBackText, setCardBackText] = useState(cloudSettings.cardBackText);
  
  const [frontLogoConfig, setFrontLogoConfig] = useState<LogoConfig>(cloudSettings.frontLogoConfig);
  const [backLogoConfig, setBackLogoConfig] = useState<LogoConfig>(cloudSettings.backLogoConfig);

  const [instSignature, setInstSignature] = useState<string | null>(cloudSettings.instSignature);
  const [signatureScale, setSignatureScale] = useState(cloudSettings.signatureScale);
  const [instDescription, setInstDescription] = useState(cloudSettings.instDescription);
  const [cardDescription, setCardDescription] = useState(cloudSettings.cardDescription);
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>(cloudSettings.visibleFields);
  
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiPalettes, setAiPalettes] = useState<any[]>([]);
  
  const [status, setStatus] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const [isPreviewFront, setIsPreviewFront] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const cardLogoInputRef = useRef<HTMLInputElement>(null);
  const cardBackLogoInputRef = useRef<HTMLInputElement>(null);
  const cardBackInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleSaveGeneral = async () => {
    setStatus({ msg: 'Sincronizando com a nuvem...', type: 'loading' as any });
    
    try {
      await updateSettings({
        url,
        directorName,
        instName,
        instColor,
        instLogo,
        cardLogo,
        cardBackLogo,
        cardBackImage,
        cardFrontText,
        cardBackText,
        frontLogoConfig,
        backLogoConfig,
        instSignature,
        signatureScale,
        instDescription,
        cardDescription,
        visibleFields
      });

      // Legacy fallback
      localStorage.setItem(URL_STORAGE_KEY, url);
      localStorage.setItem(DIRECTOR_NAME_KEY, directorName);
      localStorage.setItem(INSTITUTION_NAME_KEY, instName);
      localStorage.setItem(INSTITUTION_COLOR_KEY, instColor);
      localStorage.setItem(INSTITUTION_DESCRIPTION_KEY, instDescription);
      localStorage.setItem(CARD_DESCRIPTION_KEY, cardDescription);
      localStorage.setItem(CARD_VISIBLE_FIELDS_KEY, JSON.stringify(visibleFields));
      localStorage.setItem(CARD_FRONT_TEXT_KEY, cardFrontText);
      localStorage.setItem(CARD_BACK_TEXT_KEY, cardBackText);
      localStorage.setItem(CARD_FRONT_LOGO_CONFIG_KEY, JSON.stringify(frontLogoConfig));
      localStorage.setItem(CARD_BACK_LOGO_CONFIG_KEY, JSON.stringify(backLogoConfig));
      localStorage.setItem(CARD_SIGNATURE_CONFIG_KEY, signatureScale.toString());
      if (instLogo) localStorage.setItem(INSTITUTION_LOGO_KEY, instLogo);
      if (cardLogo) localStorage.setItem(CARD_LOGO_KEY, cardLogo);
      if (cardBackLogo) localStorage.setItem(CARD_BACK_LOGO_KEY, cardBackLogo);
      if (cardBackImage) localStorage.setItem(CARD_BACK_IMAGE_KEY, cardBackImage);
      if (instSignature) localStorage.setItem(DIRECTOR_SIGNATURE_KEY, instSignature);

      showStatus('Configurações aplicadas globalmente!', 'success');
    } catch (e) {
      console.error(e);
      showStatus('Erro ao salvar no banco de dados.', 'error');
    }
  };

  const handleMagicPalette = async () => {
    if (!instLogo) {
      showStatus('Faça upload de um logo primeiro.', 'error');
      return;
    }

    try {
      setIsAnalyzing(true);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const base64Data = instLogo.split(',')[1];
      const mimeType = instLogo.split(';')[0].split(':')[1];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            {
              text: `Analyze this corporate logo and generate 3 distinct, professional color palettes (Modern, Classic, Vibrant) that would work well for a physical ID card and a web application theme. 
              Each palette must include:
              - A name
              - A primary color (derived from the logo)
              - A complementary secondary color
              - An accent color
              - A short description of the vibe.`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                primary: { type: Type.STRING, description: "Hex code including #" },
                secondary: { type: Type.STRING, description: "Hex code including #" },
                accent: { type: Type.STRING, description: "Hex code including #" },
                description: { type: Type.STRING }
              },
              required: ["name", "primary", "secondary", "accent", "description"]
            }
          }
        }
      });

      const palettes = JSON.parse(response.text || '[]');
      if (palettes.length > 0) {
        setAiPalettes(palettes);
        showStatus('Sugestões de paletas geradas!', 'success');
      } else {
        showStatus('Não foi possível gerar sugestões.', 'error');
      }
    } catch (error) {
      console.error('AI Palette Generation Error:', error);
      showStatus('Erro ao conectar com a IA.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string | null) => void, maxSizeKB = 500) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > maxSizeKB * 1024) {
      showStatus(`Arquivo muito grande. Máximo ${maxSizeKB}KB.`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setter(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePassword = () => {
    const current = localStorage.getItem(PASSWORD_STORAGE_KEY) || DEFAULT_ADMIN_PASSWORD;
    if (password !== current) {
      showStatus('A senha atual está incorreta.', 'error');
      return;
    }
    if (newPassword.length < 4) {
      showStatus('A nova senha precisa ter mais caracteres.', 'error');
      return;
    }
    localStorage.setItem(PASSWORD_STORAGE_KEY, newPassword);
    setPassword(''); setNewPassword('');
    showStatus('Palavra-passe alterada!', 'success');
  };

  const showStatus = (msg: string, type: 'success'|'error') => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 3000);
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 z-[100] overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-2xl rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full sm:h-[90vh] border border-white/10">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 rounded-lg">
                <Settings className="w-5 h-5" />
             </div>
             <div>
                <h2 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-white leading-none">Configurações</h2>
                <p className="hidden sm:block text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">Personalização e Administração</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveGeneral} className="btn-modern bg-sky-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
              <Save className="w-3 h-3" /> Salvar
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Live Preview Area */}
        <div className="bg-slate-200 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center shrink-0 border-b border-slate-200 dark:border-slate-800 relative">
           <div className="absolute top-2 left-4 z-20 flex gap-2">
              <button 
                onClick={() => setIsPreviewFront(!isPreviewFront)}
                className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors flex items-center gap-1.5"
              >
                <RotateCw className="w-3 h-3" rotate={isPreviewFront ? 0 : 180} />
                {isPreviewFront ? 'Ver Verso' : 'Ver Frente'}
              </button>
           </div>
           
           <div className="w-full max-w-[320px] transition-all duration-500" style={{ transform: isPreviewFront ? 'rotateY(0deg)' : 'rotateY(180deg)', transformStyle: 'preserve-3d' }}>
             <FajopaIDCard 
                member={MOCK_MEMBER as any}
                exportMode={true} 
                settings={{
                  directorName,
                  instLogo,
                  cardLogo,
                  cardBackLogo,
                  cardFrontText,
                  cardBackText,
                  frontLogoConfig,
                  backLogoConfig,
                  cardBackImage,
                  cardDescription,
                  signatureScale,
                  instSignature,
                  instName,
                  instColor,
                  url,
                  visibleFields
                }}
             />
           </div>
           <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-3 uppercase tracking-widest opacity-60">Pré-visualização em Tempo Real</p>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-8 scrollbar-hide">
          {status && (
            <div className={`p-3 text-center rounded-xl text-sm font-medium ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {status.msg}
            </div>
          )}
          {/* Identidade Visual */}
          <div className="bg-sky-50/50 dark:bg-sky-900/10 p-5 rounded-2xl border border-sky-100 dark:border-sky-500/20">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-sky-800 dark:text-sky-300 uppercase tracking-widest text-[10px]">
              <Palette className="w-4 h-4" /> Identidade Visual (Global)
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-3 text-center">Logo Principal (Header)</label>
                
                {instLogo ? (
                  <div className="relative group">
                    <img src={instLogo} alt="Logo Inst" className="h-16 w-auto object-contain mb-2 rounded shadow-sm" />
                    <button 
                      onClick={() => setInstLogo(null)}
                      className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => logoInputRef.current?.click()}
                    className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-200 dark:border-slate-600 mb-2"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                )}
                <input type="file" ref={logoInputRef} onChange={(e) => handleFileUpload(e, setInstLogo)} accept="image/*" className="hidden" />
                <p className="text-[9px] text-slate-400 mt-1">Logo usada no cabeçalho e landing</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Institucional</label>
                   <input type="text" value={instName} onChange={e=>setInstName(e.target.value.toUpperCase())} className="input-modern w-full rounded-xl py-2 px-3 text-xs font-bold" placeholder="Ex: FAJOPA" />
                </div>
                
                <div className="col-span-2 relative">
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição do Cabeçalho</label>
                   <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" value={instDescription} onChange={e=>setInstDescription(e.target.value.toUpperCase())} className="input-modern w-full rounded-xl py-2 pl-9 pr-3 text-[10px] font-medium" placeholder="Ex: SISTEMA DE VERIFICAÇÃO" />
                   </div>
                </div>

                <div className="col-span-1">
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cor Primária</label>
                   <div className="flex gap-2">
                     <input type="color" value={instColor} onChange={e=>setInstColor(e.target.value)} className="w-8 h-8 rounded border-none cursor-pointer p-0" />
                     <input type="text" value={instColor} onChange={e=>setInstColor(e.target.value)} className="input-modern flex-1 rounded-xl py-1 px-3 text-[10px] uppercase font-mono" />
                   </div>
                </div>

                <div className="col-span-1 flex items-end">
                  <button 
                    onClick={handleMagicPalette}
                    disabled={isAnalyzing}
                    className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isAnalyzing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Explorar Paletas (IA)
                  </button>
                </div>
              </div>

              {/* AI Palette Suggestions */}
              {aiPalettes.length > 0 && (
                <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                   <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                        <Wand2 className="w-3 h-3 text-violet-500" /> Paletas Sugeridas
                      </span>
                      <button onClick={() => setAiPalettes([])} className="text-[9px] font-bold text-slate-400 hover:text-rose-500">Limpar</button>
                   </div>
                   <div className="space-y-3">
                      {aiPalettes.map((p, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            setInstColor(p.primary);
                            showStatus(`Aplicada a paleta: ${p.name}`, 'success');
                          }}
                          className="group p-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-violet-500 cursor-pointer transition-all active:scale-[0.98]"
                        >
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                             <div className="flex gap-1">
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: p.primary }} />
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: p.secondary }} />
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: p.accent }} />
                             </div>
                          </div>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">{p.description}</p>
                        </div>
                      ))}
                   </div>
                </div>
              )}
            </div>
          </div>
          {/* Branding da Carteirinha */}
          <div className="bg-amber-50/50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-500/20">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-amber-800 dark:text-amber-300 uppercase tracking-widest text-[10px]">
              <ImageIcon className="w-4 h-4" /> Layout e Branding do Cartão
            </h3>

            <div className="space-y-6">
              {/* Parte da Frente */}
              <div className="space-y-3 p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" /> Frente do Cartão
                </label>
                
                <div className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">Logo Frontal</span>
                  {cardLogo ? (
                    <div className="relative group">
                      <img src={cardLogo} alt="Front Logo" className="h-10 w-auto object-contain mb-1 rounded" />
                      <button onClick={() => setCardLogo(null)} className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full"><Trash2 className="w-2 h-2" /></button>
                    </div>
                  ) : (
                    <button onClick={() => cardLogoInputRef.current?.click()} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:text-amber-500"><Upload className="w-4 h-4" /></button>
                  )}
                  <input type="file" ref={cardLogoInputRef} onChange={(e) => handleFileUpload(e, setCardLogo)} accept="image/*" className="hidden" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1">
                    <label className="block text-[8px] font-bold text-slate-400 uppercase">Redimensionar Logo (%)</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="20" 
                        max="200" 
                        step="1"
                        value={frontLogoConfig.scale} 
                        onChange={e=>setFrontLogoConfig({...frontLogoConfig, scale: Number(e.target.value)})} 
                        className="flex-1 accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                      />
                      <span className="text-[10px] font-mono font-bold text-slate-500 w-8">{frontLogoConfig.scale}%</span>
                    </div>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[8px] font-bold text-slate-400 uppercase">Deslocamento X</label>
                    <input 
                      type="range" 
                      min="-150" 
                      max="150" 
                      value={frontLogoConfig.x} 
                      onChange={e=>setFrontLogoConfig({...frontLogoConfig, x: Number(e.target.value)})} 
                      className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[8px] font-bold text-slate-400 uppercase">Deslocamento Y</label>
                    <input 
                      type="range" 
                      min="-150" 
                      max="150" 
                      value={frontLogoConfig.y} 
                      onChange={e=>setFrontLogoConfig({...frontLogoConfig, y: Number(e.target.value)})} 
                      className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>
                  <div className="col-span-1 flex items-end">
                    <button 
                      onClick={() => setFrontLogoConfig(DEFAULT_CONFIG)}
                      className="text-[9px] font-bold text-slate-400 hover:text-amber-500 flex items-center gap-1 transition-colors uppercase"
                    >
                      <RotateCw className="w-3 h-3" /> Resetar Ajustes
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Texto de Marca (Frente)</label>
                  <input type="text" value={cardFrontText} onChange={e=>setCardFrontText(e.target.value.toUpperCase())} className="input-modern w-full rounded-lg py-1.5 px-3 text-[10px] font-bold" placeholder="VERO ID (Padrão)" />
                </div>
              </div>

              {/* Parte de Trás */}
              <div className="space-y-3 p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" /> Verso do Cartão
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">Logo Verso</span>
                    {cardBackLogo ? (
                      <div className="relative group">
                        <img src={cardBackLogo} alt="Back Logo" className="h-10 w-auto object-contain mb-1 rounded" />
                        <button onClick={() => setCardBackLogo(null)} className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full"><Trash2 className="w-2 h-2" /></button>
                      </div>
                    ) : (
                      <button onClick={() => cardBackLogoInputRef.current?.click()} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400"><Upload className="w-4 h-4" /></button>
                    )}
                    <input type="file" ref={cardBackLogoInputRef} onChange={(e) => handleFileUpload(e, setCardBackLogo)} accept="image/*" className="hidden" />
                  </div>

                  <div className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">Fundo Verso</span>
                    {cardBackImage ? (
                      <div className="relative group">
                        <img src={cardBackImage} alt="Back BG" className="h-10 w-auto object-contain mb-1 rounded" />
                        <button onClick={() => setCardBackImage(null)} className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full"><Trash2 className="w-2 h-2" /></button>
                      </div>
                    ) : (
                      <button onClick={() => cardBackInputRef.current?.click()} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400"><ImageIcon className="w-4 h-4" /></button>
                    )}
                    <input type="file" ref={cardBackInputRef} onChange={(e) => handleFileUpload(e, setCardBackImage, 1024)} accept="image/*" className="hidden" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1">
                    <label className="block text-[8px] font-bold text-slate-400 uppercase">Redimensionar Logo (%)</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="20" 
                        max="200" 
                        step="1"
                        value={backLogoConfig.scale} 
                        onChange={e=>setBackLogoConfig({...backLogoConfig, scale: Number(e.target.value)})} 
                        className="flex-1 accent-blue-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                      />
                      <span className="text-[10px] font-mono font-bold text-slate-500 w-8">{backLogoConfig.scale}%</span>
                    </div>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[8px] font-bold text-slate-400 uppercase">Deslocamento X</label>
                    <input 
                      type="range" 
                      min="-150" 
                      max="150" 
                      value={backLogoConfig.x} 
                      onChange={e=>setBackLogoConfig({...backLogoConfig, x: Number(e.target.value)})} 
                      className="w-full accent-blue-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[8px] font-bold text-slate-400 uppercase">Deslocamento Y</label>
                    <input 
                      type="range" 
                      min="-150" 
                      max="150" 
                      value={backLogoConfig.y} 
                      onChange={e=>setBackLogoConfig({...backLogoConfig, y: Number(e.target.value)})} 
                      className="w-full accent-blue-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>
                  <div className="col-span-1 flex items-end">
                    <button 
                      onClick={() => setBackLogoConfig(DEFAULT_CONFIG)}
                      className="text-[9px] font-bold text-slate-400 hover:text-blue-500 flex items-center gap-1 transition-colors uppercase"
                    >
                      <RotateCw className="w-3 h-3" /> Resetar Ajustes
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Texto de Marca (Verso)</label>
                  <input type="text" value={cardBackText} onChange={e=>setCardBackText(e.target.value.toUpperCase())} className="input-modern w-full rounded-lg py-1.5 px-3 text-[10px] font-bold" placeholder="VERO ID (Padrão)" />
                </div>
              </div>

              <div>
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notas/Rodapé do Cartão</label>
                 <textarea 
                    value={cardDescription} 
                    onChange={e=>setCardDescription(e.target.value.toUpperCase())} 
                    className="input-modern w-full rounded-xl py-2 px-3 text-[10px] font-medium min-h-[60px]" 
                    placeholder="Ex: Documento padronizado nacionalmente conforme a lei 12.933/2013..."
                 />
              </div>

              {/* Visibilidade de Campos */}
              <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-slate-400" /> Visibilidade de Campos
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'name', label: 'Nome' },
                    { id: 'ra', label: 'R.A.' },
                    { id: 'course', label: 'Curso' },
                    { id: 'birth', label: 'Nascimento' },
                    { id: 'validity', label: 'Validade' },
                    { id: 'photo', label: 'Foto' },
                    { id: 'qrcode', label: 'QR Code' },
                    { id: 'logo', label: 'Logotipos' },
                    { id: 'signature', label: 'Assinatura' },
                    { id: 'director', label: 'Nome Diretor' },
                    { id: 'footer', label: 'Rodapé Endereço' },
                  ].map(field => (
                    <label key={field.id} className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={visibleFields[field.id]} 
                          onChange={e => setVisibleFields({ ...visibleFields, [field.id]: e.target.checked })}
                          className="sr-only"
                        />
                        <div className={`w-8 h-4 rounded-full transition-colors ${visibleFields[field.id] ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${visibleFields[field.id] ? 'translate-x-4' : ''}`} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-sky-600 transition-colors uppercase">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[10px]">
              <Link className="w-4 h-4" /> Configurações de Texto
            </h3>
            <div className="space-y-3">
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">URL de Acesso</label>
                  <input type="text" value={url} onChange={e=>setUrl(e.target.value)} className="input-modern w-full rounded-xl py-2 px-3 text-sm" placeholder="Ex: https://vero-id.app" />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Diretor Geral (Assinante Card)</label>
                  <div className="relative">
                     <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input type="text" value={directorName} onChange={e=>setDirectorName(e.target.value.toUpperCase())} className="input-modern w-full rounded-xl py-2 pl-9 pr-3 text-sm font-semibold" placeholder="Ex: PROF. DR. FULANO DE TAL" />
                  </div>
               </div>

               <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 text-center">Assinatura do Diretor (PNG)</label>
                  
                  {instSignature ? (
                    <div className="relative group">
                      <img src={instSignature} alt="Assinatura" className="h-10 w-auto object-contain mb-1 bg-white p-1 rounded" />
                      <button 
                        onClick={() => setInstSignature(null)}
                        className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => signatureInputRef.current?.click()}
                      className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-200 dark:border-slate-600"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  )}
                  <input type="file" ref={signatureInputRef} onChange={(e) => handleFileUpload(e, setInstSignature, 300)} accept="image/png" className="hidden" />
                  <p className="text-[8px] text-slate-400 mt-1">Fundo transparente recomendado</p>

                  {instSignature && (
                    <div className="mt-4 w-full px-2">
                       <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Aumentar/Diminuir Assinatura (%)</label>
                       <div className="flex items-center gap-2">
                         <input 
                           type="range" 
                           min="50" 
                           max="300" 
                           value={signatureScale} 
                           onChange={e=>setSignatureScale(Number(e.target.value))} 
                           className="flex-1 accent-sky-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                         />
                         <span className="text-[10px] font-mono font-bold text-slate-500 w-8">{signatureScale}%</span>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          </div>
          
          <button onClick={handleSaveGeneral} className="btn-modern w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all">
            Salvar Todas as Configurações
          </button>

          <div className="bg-rose-50 dark:bg-rose-900/10 p-5 rounded-2xl border border-rose-200 dark:border-rose-500/20 mt-4">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-rose-700 dark:text-rose-300 uppercase tracking-widest text-[10px]">
              <ShieldAlert className="w-4 h-4" /> Segurança do Painel
            </h3>
            <div className="space-y-3">
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha Atual" className="input-modern w-full rounded-xl py-2 px-3 text-sm" />
              <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Nova Senha" className="input-modern w-full rounded-xl py-2 px-3 text-sm" />
              <button onClick={handleSavePassword} className="btn-modern w-full py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-medium">Alterar Credenciais</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

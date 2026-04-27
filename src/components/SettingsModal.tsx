import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Settings,
  Save,
  ShieldAlert,
  Mail,
  Link,
  UserCircle,
  Palette,
  Upload,
  Trash2,
  Wand2,
  FileText,
  ImageIcon,
  RotateCw,
  Move,
  BellRing,
  Sun,
  Moon,
  Lock,
  Type,
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import FajopaIDCard from "./FajopaIDCard";
import { useSettings } from "../context/SettingsContext";
import { AVAILABLE_SEMINARIES } from "../types";
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
  CARD_SIGNATURE_CONFIG_KEY,
  SECONDARY_BACK_LOGO_SCALE_KEY,
} from "../lib/constants";

interface LogoConfig {
  x: number;
  y: number;
  scale: number;
}

const DEFAULT_CONFIG: LogoConfig = { x: 0, y: 0, scale: 100 };

const MOCK_MEMBER = {
  id: "preview",
  name: "JOÃO DA SILVA SAMPLE",
  ra: "2024.0001",
  course: "TEOLOGIA",
  diocese: "ASSIS",
  roles: ["SEMINARISTA"],
  birthdate: "01/01/2000",
  validityDate: "2025-12-31",
  photoUrl:
    "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop",
  alphaCode: "PREVIEW",
  isActive: true,
  isApproved: true,
  createdAt: new Date().toISOString(),
};

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings: cloudSettings, updateSettings } = useSettings();
  const [url, setUrl] = useState(cloudSettings.url);
  const [directorName, setDirectorName] = useState(cloudSettings.directorName);
  const [rectorName, setRectorName] = useState(cloudSettings.rectorName || "");
  const [instName, setInstName] = useState(cloudSettings.instName);
  const [instColor, setInstColor] = useState(cloudSettings.instColor);
  const [instLogo, setInstLogo] = useState<string | null>(
    cloudSettings.instLogo,
  );
  const [cardLogo, setCardLogo] = useState<string | null>(
    cloudSettings.cardLogo,
  );
  const [cardBackLogo, setCardBackLogo] = useState<string | null>(
    cloudSettings.cardBackLogo,
  );
  const [cardSecondaryBackLogo, setCardSecondaryBackLogo] = useState<
    string | null
  >(cloudSettings.cardSecondaryBackLogo);
  const [cardBackImage, setCardBackImage] = useState<string | null>(
    cloudSettings.cardBackImage,
  );

  const [cardFrontText, setCardFrontText] = useState(
    cloudSettings.cardFrontText,
  );
  const [cardBackText, setCardBackText] = useState(cloudSettings.cardBackText);

  const [frontLogoConfig, setFrontLogoConfig] = useState<LogoConfig>(
    cloudSettings.frontLogoConfig,
  );
  const [backLogoConfig, setBackLogoConfig] = useState<LogoConfig>(
    cloudSettings.backLogoConfig,
  );

  const [instSignature, setInstSignature] = useState<string | null>(
    cloudSettings.instSignature,
  );
  const [rectorSignature, setRectorSignature] = useState<string | null>(
    cloudSettings.rectorSignature || null,
  );
  const [signatureScale, setSignatureScale] = useState(
    cloudSettings.signatureScale,
  );
  const [rectorSignatureScale, setRectorSignatureScale] = useState(
    cloudSettings.rectorSignatureScale || 100,
  );
  const [secondaryBackLogoScale, setSecondaryBackLogoScale] = useState(
    cloudSettings.secondaryBackLogoScale || 100,
  );
  const [instDescription, setInstDescription] = useState(
    cloudSettings.instDescription,
  );
  const [cardDescription, setCardDescription] = useState(
    cloudSettings.cardDescription,
  );
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>(
    cloudSettings.visibleFields,
  );
  const [customDioceses, setCustomDioceses] = useState<string[]>(
    cloudSettings.customDioceses || [],
  );
  const [customCourses, setCustomCourses] = useState<string[]>(
    cloudSettings.customCourses || [],
  );
  const [customRoles, setCustomRoles] = useState<string[]>(
    cloudSettings.customRoles || [],
  );
  const [databaseName, setDatabaseName] = useState(
    cloudSettings.databaseName || "",
  );
  const [cardZoom, setCardZoom] = useState(cloudSettings.cardZoom || 1);
  const [seminariesConfig, setSeminariesConfig] = useState<Record<string, { logo: string | null; signature: string | null; rectorName: string }>>(
    cloudSettings.seminariesConfig || {}
  );
  const [activeTab, setActiveTab] = useState<"visual" | "content" | "database">(
    "visual",
  );

  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiPalettes, setAiPalettes] = useState<any[]>([]);

  const [status, setStatus] = useState<{
    msg: string;
    type: "success" | "error" | "loading";
  } | null>(null);
  const [isPreviewFront, setIsPreviewFront] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const cardLogoInputRef = useRef<HTMLInputElement>(null);
  const cardBackLogoInputRef = useRef<HTMLInputElement>(null);
  const cardSecondaryBackLogoInputRef = useRef<HTMLInputElement>(null);
  const cardBackInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const rectorSignatureInputRef = useRef<HTMLInputElement>(null);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");

  const handleUnlock = () => {
    const current =
      localStorage.getItem(PASSWORD_STORAGE_KEY) || DEFAULT_ADMIN_PASSWORD;
    if (unlockPassword === current) {
      setIsUnlocked(true);
      setStatus(null);
    } else {
      showStatus("Senha incorreta.", "error");
    }
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleSaveGeneral = async () => {
    setStatus({ msg: "Sincronizando com a nuvem...", type: "loading" });

    try {
      await updateSettings({
        url,
        directorName,
        rectorName,
        instName,
        instColor,
        instLogo,
        cardLogo,
        cardBackLogo,
        cardSecondaryBackLogo,
        cardBackImage,
        cardFrontText,
        cardBackText,
        frontLogoConfig,
        backLogoConfig,
        instSignature,
        rectorSignature,
        signatureScale,
        rectorSignatureScale,
        secondaryBackLogoScale,
        instDescription,
        cardDescription,
        visibleFields,
        customDioceses,
        customCourses,
        customRoles,
        databaseName,
        cardZoom,
        seminariesConfig,
      });

      // Legacy fallback
      localStorage.setItem(URL_STORAGE_KEY, url);
      localStorage.setItem(DIRECTOR_NAME_KEY, directorName);
      localStorage.setItem("davveroId_rector_name", rectorName);
      localStorage.setItem(INSTITUTION_NAME_KEY, instName);
      localStorage.setItem(INSTITUTION_COLOR_KEY, instColor);
      localStorage.setItem(INSTITUTION_DESCRIPTION_KEY, instDescription);
      localStorage.setItem(CARD_DESCRIPTION_KEY, cardDescription);
      localStorage.setItem(
        CARD_VISIBLE_FIELDS_KEY,
        JSON.stringify(visibleFields),
      );
      localStorage.setItem(CARD_FRONT_TEXT_KEY, cardFrontText);
      localStorage.setItem(CARD_BACK_TEXT_KEY, cardBackText);
      localStorage.setItem(
        CARD_FRONT_LOGO_CONFIG_KEY,
        JSON.stringify(frontLogoConfig),
      );
      localStorage.setItem(
        CARD_BACK_LOGO_CONFIG_KEY,
        JSON.stringify(backLogoConfig),
      );
      localStorage.setItem(
        CARD_SIGNATURE_CONFIG_KEY,
        signatureScale.toString(),
      );
      localStorage.setItem(
        SECONDARY_BACK_LOGO_SCALE_KEY,
        secondaryBackLogoScale.toString(),
      );
      if (instLogo) localStorage.setItem(INSTITUTION_LOGO_KEY, instLogo);
      if (cardLogo) localStorage.setItem(CARD_LOGO_KEY, cardLogo);
      if (cardBackLogo) localStorage.setItem(CARD_BACK_LOGO_KEY, cardBackLogo);
      if (cardBackImage)
        localStorage.setItem(CARD_BACK_IMAGE_KEY, cardBackImage);
      if (instSignature)
        localStorage.setItem(DIRECTOR_SIGNATURE_KEY, instSignature);

      showStatus("Configurações aplicadas globalmente!", "success");
    } catch (e) {
      console.error(e);
      showStatus("Erro ao salvar no banco de dados.", "error");
    }
  };

  const handleMagicPalette = async () => {
    if (!instLogo) {
      showStatus("Faça upload de um logo primeiro.", "error");
      return;
    }

    try {
      setIsAnalyzing(true);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const base64Data = instLogo.split(",")[1];
      const mimeType = instLogo.split(";")[0].split(":")[1];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: `Analyze this corporate logo and generate 3 distinct, professional color palettes (Modern, Classic, Vibrant) that would work well for a physical ID card and a web application theme. 
              Each palette must include:
              - A name
              - A primary color (derived from the logo)
              - A complementary secondary color
              - An accent color
              - A short description of the vibe.`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                primary: {
                  type: Type.STRING,
                  description: "Hex code including #",
                },
                secondary: {
                  type: Type.STRING,
                  description: "Hex code including #",
                },
                accent: {
                  type: Type.STRING,
                  description: "Hex code including #",
                },
                description: { type: Type.STRING },
              },
              required: [
                "name",
                "primary",
                "secondary",
                "accent",
                "description",
              ],
            },
          },
        },
      });

      const palettes = JSON.parse(response.text || "[]");
      if (palettes.length > 0) {
        setAiPalettes(palettes);
        showStatus("Sugestões de paletas geradas!", "success");
      } else {
        showStatus("Não foi possível gerar sugestões.", "error");
      }
    } catch (error) {
      console.error("AI Palette Generation Error:", error);
      showStatus("Erro ao conectar com a IA.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void,
    maxSizeKB = 500,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeKB * 1024) {
      showStatus(`Arquivo muito grande. Máximo ${maxSizeKB}KB.`, "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setter(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSeminaryFileWrapper = (
    e: React.ChangeEvent<HTMLInputElement>,
    seminary: string,
    field: "logo" | "signature"
  ) => {
    handleFileUpload(e, (val) => {
      setSeminariesConfig(prev => ({
        ...prev,
        [seminary]: {
          ...prev[seminary],
          [field]: val
        }
      }));
    }, 500);
  };

  const updateSeminaryConfig = (seminary: string, field: "rectorName", val: string) => {
    setSeminariesConfig(prev => ({
      ...prev,
      [seminary]: {
        ...prev[seminary],
        [field]: val
      }
    }));
  };

  const handleSavePassword = () => {
    const current =
      localStorage.getItem(PASSWORD_STORAGE_KEY) || DEFAULT_ADMIN_PASSWORD;
    if (password !== current) {
      showStatus("A senha atual está incorreta.", "error");
      return;
    }
    if (newPassword.length < 4) {
      showStatus("A nova senha precisa ter mais caracteres.", "error");
      return;
    }
    localStorage.setItem(PASSWORD_STORAGE_KEY, newPassword);
    setPassword("");
    setNewPassword("");
    showStatus("Palavra-passe alterada!", "success");
  };

  const showStatus = (msg: string, type: "success" | "error" | "loading") => {
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
              <h2 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-white leading-none">
                Configurações
              </h2>
              <p className="hidden sm:block text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">
                Personalização e Administração
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUnlocked && (
              <button
                onClick={handleSaveGeneral}
                className="btn-modern bg-sky-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2"
              >
                <Save className="w-3 h-3" /> Salvar
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {status && (
          <div
            className={`m-4 p-3 text-center rounded-xl text-sm font-medium ${status.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
          >
            {status.msg}
          </div>
        )}

        {!isUnlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 animated-scale-in">
            <div className="w-full max-w-xs space-y-4">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Área Restrita. Insira a senha mestra para continuar.
                </p>
              </div>
              <input
                type="password"
                placeholder="Senha Mestra"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                className="w-full rounded-xl py-3 px-4 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500 text-center shadow-sm"
              />
              <button
                onClick={handleUnlock}
                className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
              >
                Desbloquear
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Live Preview Area */}
            <div className="bg-slate-200 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center shrink-0 border-b border-slate-200 dark:border-slate-800 relative animated-fade-in">
              <div className="absolute top-2 left-4 z-20 flex gap-2">
                <button
                  onClick={() => setIsPreviewFront(!isPreviewFront)}
                  className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors flex items-center gap-1.5"
                >
                  <RotateCw
                    className="w-3 h-3"
                    rotate={isPreviewFront ? 0 : 180}
                  />
                  {isPreviewFront ? "Ver Verso" : "Ver Frente"}
                </button>
              </div>

              <div
                className="w-full max-w-[320px] transition-all duration-500"
                style={{
                  transform: isPreviewFront
                    ? "rotateY(0deg)"
                    : "rotateY(180deg)",
                  transformStyle: "preserve-3d",
                }}
              >
                <FajopaIDCard
                  member={MOCK_MEMBER as any}
                  exportMode={true}
                  settings={{
                    directorName,
                    rectorName,
                    instLogo,
                    cardLogo,
                    cardBackLogo,
                    cardSecondaryBackLogo,
                    cardFrontText,
                    cardBackText,
                    frontLogoConfig,
                    backLogoConfig,
                    cardBackImage,
                    cardDescription,
                    signatureScale,
                    rectorSignatureScale,
                    secondaryBackLogoScale,
                    instSignature,
                    rectorSignature,
                    instName,
                    instColor,
                    url,
                    visibleFields,
                    cardZoom,
                  }}
                />
              </div>
              <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-3 uppercase tracking-widest opacity-60">
                Pré-visualização em Tempo Real
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 shrink-0 overflow-x-auto scrollbar-hide">
              {[
                { id: "visual", label: "Identidade Visual", icon: Palette },
                { id: "content", label: "Campos e Textos", icon: FileText },
                { id: "database", label: "Banco de Dados", icon: Link },
                {
                  id: "system",
                  label: "Sistema & Notificações",
                  icon: Settings,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-[10px] sm:text-xs font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-sky-500 text-sky-600"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-8 scrollbar-hide">
              {status && (
                <div
                  className={`p-3 text-center rounded-xl text-sm font-medium ${status.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
                >
                  {status.msg}
                </div>
              )}

              {activeTab === "visual" && (
                <div className="space-y-8 animate-in fade-in transition-all duration-300">
                  {/* Identidade Visual */}
                  <div className="bg-sky-50/50 dark:bg-sky-900/10 p-5 rounded-2xl border border-sky-100 dark:border-sky-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-sky-800 dark:text-sky-300 uppercase tracking-widest text-[10px]">
                      <Palette className="w-4 h-4" /> Branding Principal
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-3 text-center">
                          Logo da Instituição
                        </label>

                        {instLogo ? (
                          <div className="relative group">
                            <img
                              src={instLogo}
                              alt="Logo Inst"
                              className="h-16 w-auto object-contain mb-2 rounded shadow-sm"
                            />
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
                        <input
                          type="file"
                          ref={logoInputRef}
                          onChange={(e) =>
                            handleFileUpload(e, setInstLogo, 2048)
                          }
                          accept="image/*"
                          className="hidden"
                        />
                        <p className="text-[9px] text-slate-400 mt-1">
                          Logo usada no cabeçalho e landing
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Nome Institucional
                            <button
                              onClick={() => setInstName("DAVVERO-ID")}
                              className="bg-slate-200 dark:bg-slate-800 hover:bg-sky-500 hover:text-white px-2 py-0.5 rounded text-[8px] transition-colors"
                            >
                              Usar Nome do Programa
                            </button>
                          </label>
                          <input
                            type="text"
                            value={instName}
                            onChange={(e) =>
                              setInstName(e.target.value.toUpperCase())
                            }
                            className="input-modern w-full rounded-xl py-2 px-3 text-xs font-bold"
                            placeholder="Ex: FAJOPA"
                          />
                        </div>

                        <div className="col-span-2 relative">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Descrição do Cabeçalho
                          </label>
                          <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              value={instDescription}
                              onChange={(e) =>
                                setInstDescription(e.target.value.toUpperCase())
                              }
                              className="input-modern w-full rounded-xl py-2 pl-9 pr-3 text-[10px] font-medium"
                              placeholder="Ex: SISTEMA DE VERIFICAÇÃO"
                            />
                          </div>
                        </div>

                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Cor Primária
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={instColor}
                              onChange={(e) => setInstColor(e.target.value)}
                              className="w-8 h-8 rounded border-none cursor-pointer p-0"
                            />
                            <input
                              type="text"
                              value={instColor}
                              onChange={(e) => setInstColor(e.target.value)}
                              className="input-modern flex-1 rounded-xl py-1 px-3 text-[10px] uppercase font-mono"
                            />
                          </div>
                        </div>

                        <div className="col-span-1 flex items-end">
                          <button
                            onClick={handleMagicPalette}
                            disabled={isAnalyzing}
                            className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {isAnalyzing ? (
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Wand2 className="w-3 h-3" />
                            )}
                            IA Paletas
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Branding da Carteirinha */}
                  <div className="bg-amber-50/50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-amber-800 dark:text-amber-300 uppercase tracking-widest text-[10px]">
                      <ImageIcon className="w-4 h-4" /> Layout do Cartão
                    </h3>

                    <div className="space-y-6">
                      {/* Parte da Frente */}
                      <div className="space-y-3 p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />{" "}
                          Frente do Cartão
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                            <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                              Logo Frontal
                            </span>
                            {cardLogo ? (
                              <div className="relative group">
                                <img
                                  src={cardLogo}
                                  alt="Front Logo"
                                  className="h-10 w-auto object-contain mb-1 rounded"
                                />
                                <button
                                  onClick={() => setCardLogo(null)}
                                  className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full transition-transform group-hover:scale-110 shadow-lg"
                                >
                                  <Trash2 className="w-2 h-2" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  cardLogoInputRef.current?.click()
                                }
                                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500"
                              >
                                <Upload className="w-4 h-4" />
                              </button>
                            )}
                            <input
                              type="file"
                              ref={cardLogoInputRef}
                              onChange={(e) =>
                                handleFileUpload(e, setCardLogo, 2048)
                              }
                              accept="image/*"
                              className="hidden"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[8px] font-bold text-slate-400 uppercase">
                              Ajustes Rápidos
                            </label>
                            <div className="grid grid-cols-1 gap-2">
                              <input
                                type="range"
                                min="-50"
                                max="50"
                                value={frontLogoConfig.y}
                                onChange={(e) =>
                                  setFrontLogoConfig({
                                    ...frontLogoConfig,
                                    y: Number(e.target.value),
                                  })
                                }
                                className="w-full accent-amber-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <input
                                type="range"
                                min="50"
                                max="200"
                                value={frontLogoConfig.scale}
                                onChange={(e) =>
                                  setFrontLogoConfig({
                                    ...frontLogoConfig,
                                    scale: Number(e.target.value),
                                  })
                                }
                                className="w-full accent-amber-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Fundo Personalizado */}
                      <div className="space-y-3 p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />{" "}
                          Verso do Cartão
                        </label>
                        <div className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg w-full">
                          <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                            Imagem de Fundo Acrílico (Apenas Verso)
                          </span>
                          {cardBackImage ? (
                            <div className="relative group w-full flex justify-center">
                              <img
                                src={cardBackImage}
                                alt="Fundo Verso"
                                className="h-16 w-auto object-cover mb-1 rounded-md shadow-md"
                              />
                              <button
                                onClick={() => setCardBackImage(null)}
                                className="absolute -top-2 scale-75 -right-2 p-1 bg-rose-500 text-white rounded-full transition-transform group-hover:scale-95 shadow-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => cardBackInputRef.current?.click()}
                              className="w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500 gap-2 text-xs font-bold"
                            >
                              <Upload className="w-4 h-4" /> Enviar Fundo
                              Opcional
                            </button>
                          )}
                          <input
                            type="file"
                            ref={cardBackInputRef}
                            onChange={(e) =>
                              handleFileUpload(e, setCardBackImage, 800)
                            }
                            accept="image/*"
                            className="hidden"
                          />
                          <p className="text-[8px] text-center text-slate-400 mt-2">
                            Dica: Envie uma imagem no formato retrato (vertical)
                            e de alta resolução. O fundo será aplicado com o
                            efeito acrílico natural.
                          </p>
                        </div>

                        <div className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg w-full mt-3">
                          <span className="text-[9px] font-bold text-slate-400 uppercase mb-2 text-center">
                            Logo Secundária (Verso) - Apenas para Dioceses
                            Autorizadas
                          </span>
                          {cardSecondaryBackLogo ? (
                            <div className="relative group w-full flex justify-center">
                              <img
                                src={cardSecondaryBackLogo}
                                alt="Logo Secundária"
                                className="h-10 w-auto object-contain mb-1 rounded"
                              />
                              <button
                                onClick={() => setCardSecondaryBackLogo(null)}
                                className="absolute -top-2 scale-75 right-1/4 p-1 bg-rose-500 text-white rounded-full transition-transform group-hover:scale-95 shadow-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                cardSecondaryBackLogoInputRef.current?.click()
                              }
                              className="w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-sky-500 gap-2 text-xs font-bold"
                            >
                              <Upload className="w-4 h-4" /> Enviar Logo da
                              Diocese
                            </button>
                          )}
                          <input
                            type="file"
                            ref={cardSecondaryBackLogoInputRef}
                            onChange={(e) =>
                              handleFileUpload(
                                e,
                                setCardSecondaryBackLogo,
                                2048,
                              )
                            }
                            accept="image/*"
                            className="hidden"
                          />

                          <div className="w-full mt-3">
                            <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-1">
                              Tamanho da Logo Secundária (
                              {secondaryBackLogoScale}%)
                            </label>
                            <input
                              type="range"
                              min="50"
                              max="250"
                              value={secondaryBackLogoScale}
                              onChange={(e) =>
                                setSecondaryBackLogoScale(
                                  Number(e.target.value),
                                )
                              }
                              className="w-full accent-sky-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          <p className="text-[8px] text-center text-slate-400 mt-2 leading-tight">
                            Esta logo aparecerá do lado direito do verso,
                            espelhando a logo principal, exclusivamente para as
                            dioceses: Assis, Presidente Prudente, Ourinhos,
                            Araçatuba e Lins.
                          </p>
                        </div>
                      </div>

                      {/* Zoom do Cartão */}
                      <div className="space-y-3 p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />{" "}
                          Escala do Cartão (Zoom)
                        </label>
                        <div className="w-full">
                          <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-1">
                            Zoom ({cardZoom}x)
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="1.5"
                            step="0.05"
                            value={cardZoom}
                            onChange={(e) =>
                              setCardZoom(Number(e.target.value))
                            }
                            className="w-full accent-amber-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <p className="text-[8px] text-center text-slate-400 mt-2 leading-tight">
                            Ajusta o tamanho visual global do cartão na
                            interface. Valores de 0.5 a 1.5.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "content" && (
                <div className="space-y-8 animate-in fade-in transition-all duration-300">
                  {/* Visibilidade de Campos */}
                  <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />{" "}
                      Exibição de Dados
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "name", label: "Nome" },
                        { id: "ra", label: "R.A." },
                        { id: "course", label: "Curso" },
                        { id: "diocese", label: "Diocese" },
                        { id: "birth", label: "Nascimento" },
                        { id: "validity", label: "Validade" },
                        { id: "photo", label: "Foto" },
                        { id: "qrcode", label: "QR Code" },
                        { id: "logo", label: "Logotipos" },
                        { id: "signature", label: "Assin. Diretor" },
                        { id: "rectorSignature", label: "Assin. Reitor" },
                        { id: "director", label: "Nome Diretor" },
                        { id: "rector", label: "Nome Reitor" },
                        { id: "footer", label: "Rodapé Info" },
                      ].map((field) => (
                        <label
                          key={field.id}
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={visibleFields[field.id]}
                              onChange={(e) =>
                                setVisibleFields({
                                  ...visibleFields,
                                  [field.id]: e.target.checked,
                                })
                              }
                              className="sr-only"
                            />
                            <div
                              className={`w-8 h-4 rounded-full transition-colors ${visibleFields[field.id] ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600"}`}
                            />
                            <div
                              className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${visibleFields[field.id] ? "translate-x-4" : ""}`}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-sky-600 transition-colors uppercase">
                            {field.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[10px]">
                      Textos Institucionais
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Diretor Geral
                          </label>
                          <input
                            type="text"
                            value={directorName}
                            onChange={(e) =>
                              setDirectorName(e.target.value.toUpperCase())
                            }
                            className="input-modern w-full rounded-xl py-2 px-3 text-[10px] font-semibold"
                            placeholder="NOME DO DIRETOR"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Reitor do Seminário
                          </label>
                          <input
                            type="text"
                            value={rectorName}
                            onChange={(e) =>
                              setRectorName(e.target.value.toUpperCase())
                            }
                            className="input-modern w-full rounded-xl py-2 px-3 text-[10px] font-semibold"
                            placeholder="NOME DO REITOR"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Assinaturas */}
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center w-full">
                          <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                            Assinatura Diretor
                          </span>
                          {instSignature ? (
                            <div className="relative group mb-3">
                              <img
                                src={instSignature}
                                alt="Assin"
                                className="h-10 w-auto object-contain bg-white rounded p-0.5"
                              />
                              <button
                                onClick={() => setInstSignature(null)}
                                className="absolute -top-1 -right-1 p-1 bg-rose-500 text-white rounded-full shadow-lg"
                              >
                                <Trash2 className="w-2 h-2" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => signatureInputRef.current?.click()}
                              className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-sky-500 mb-3"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          )}
                          <input
                            type="file"
                            ref={signatureInputRef}
                            onChange={(e) =>
                              handleFileUpload(e, setInstSignature, 300)
                            }
                            accept="image/png"
                            className="hidden"
                          />

                          <div className="w-full mt-2">
                            <div className="flex justify-between text-[8px] text-slate-400 mb-1">
                              <span>Tamanho: {signatureScale}%</span>
                            </div>
                            <input
                              type="range"
                              min="30"
                              max="250"
                              value={signatureScale}
                              onChange={(e) =>
                                setSignatureScale(Number(e.target.value))
                              }
                              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center w-full">
                          <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                            Assinatura Reitor
                          </span>
                          {rectorSignature ? (
                            <div className="relative group mb-3">
                              <img
                                src={rectorSignature}
                                alt="Assin"
                                className="h-10 w-auto object-contain bg-white rounded p-0.5"
                              />
                              <button
                                onClick={() => setRectorSignature(null)}
                                className="absolute -top-1 -right-1 p-1 bg-rose-500 text-white rounded-full shadow-lg"
                              >
                                <Trash2 className="w-2 h-2" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                rectorSignatureInputRef.current?.click()
                              }
                              className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-sky-500 mb-3"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          )}
                          <input
                            type="file"
                            ref={rectorSignatureInputRef}
                            onChange={(e) =>
                              handleFileUpload(e, setRectorSignature, 300)
                            }
                            accept="image/png"
                            className="hidden"
                          />

                          <div className="w-full mt-2">
                            <div className="flex justify-between text-[8px] text-slate-400 mb-1">
                              <span>Tamanho: {rectorSignatureScale}%</span>
                            </div>
                            <input
                              type="range"
                              min="30"
                              max="250"
                              value={rectorSignatureScale}
                              onChange={(e) =>
                                setRectorSignatureScale(Number(e.target.value))
                              }
                              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50/50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-amber-800 dark:text-amber-300 uppercase tracking-widest text-[10px]">
                      <Type className="w-4 h-4" /> Configurações por Seminário
                    </h3>
                    <div className="space-y-6">
                      {AVAILABLE_SEMINARIES.map(sem => {
                        const config = seminariesConfig[sem] || { logo: null, signature: null, rectorName: '' };
                        return (
                          <div key={sem} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700 pb-2 mb-3">{sem}</h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex flex-col items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2">Logo (Frente da Carteirinha)</label>
                                {config.logo ? (
                                  <div className="relative group mb-2">
                                    <img src={config.logo} alt={`Logo ${sem}`} className="h-10 w-auto object-contain bg-white rounded p-0.5 border" />
                                    <button onClick={() => updateSeminaryConfig(sem, "logo" as any, null as any)} className="absolute -top-1 -right-1 p-1 bg-rose-500 text-white rounded-full"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                ) : (
                                  <label className="p-2 px-4 rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-700 cursor-pointer text-slate-500 hover:text-sky-500 mb-2 flex items-center gap-2 text-xs">
                                    <Upload className="w-4 h-4" /> Carregar Logo
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleSeminaryFileWrapper(e, sem, 'logo')} />
                                  </label>
                                )}
                              </div>
                              
                              <div className="flex flex-col items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2">Assinatura Reitor (Verso)</label>
                                {config.signature ? (
                                  <div className="relative group mb-2">
                                    <img src={config.signature} alt={`Assinatura ${sem}`} className="h-10 w-auto object-contain bg-white rounded p-0.5 border" />
                                    <button onClick={() => updateSeminaryConfig(sem, "signature" as any, null as any)} className="absolute -top-1 -right-1 p-1 bg-rose-500 text-white rounded-full"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                ) : (
                                  <label className="p-2 px-4 rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-700 cursor-pointer text-slate-500 hover:text-sky-500 mb-2 flex items-center gap-2 text-xs">
                                    <Upload className="w-4 h-4" /> Carregar Assinatura
                                    <input type="file" className="hidden" accept="image/png" onChange={(e) => handleSeminaryFileWrapper(e, sem, 'signature')} />
                                  </label>
                                )}
                              </div>
                            </div>
                            
                            <div>
                               <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nome do Reitor deste Seminário</label>
                               <input 
                                 type="text" 
                                 placeholder="NOME COMPLETO DO REITOR" 
                                 value={config.rectorName || ''}
                                 onChange={(e) => updateSeminaryConfig(sem, 'rectorName', e.target.value.toUpperCase())}
                                 className="input-modern w-full rounded-lg py-2 px-3 text-xs" 
                               />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "database" && (
                <div className="space-y-8 animate-in fade-in transition-all duration-300">
                  {/* Banco de Dados */}
                  <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-emerald-800 dark:text-emerald-300 uppercase tracking-widest text-[10px]">
                      <Link className="w-4 h-4" /> Configurações de Dados
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Nome do Banco de Dados (Exibição no Header)
                        </label>
                        <input
                          type="text"
                          value={databaseName}
                          onChange={(e) =>
                            setDatabaseName(e.target.value.toUpperCase())
                          }
                          className="input-modern w-full rounded-xl py-2 px-3 text-xs font-bold"
                          placeholder="Ex: FAJOPA e SPSCJ"
                        />
                        <p className="text-[9px] text-slate-400 mt-2 italic">
                          Este nome aparece no cabeçalho para identificar a base
                          de dados ativa no momento.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          URL Base do Projeto
                        </label>
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Gestão de Listas */}
                  <div className="bg-white dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[10px]">
                      Gerenciamento de Listas Customizadas
                    </h3>
                    <div className="space-y-4">
                      {/* Dioceses */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          Dioceses ({customDioceses.length})
                        </label>
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl min-h-[40px]">
                          {customDioceses.map((d, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-bold flex items-center gap-2 group"
                            >
                              {d}
                              <button
                                onClick={() =>
                                  setCustomDioceses(
                                    customDioceses.filter(
                                      (_, idx) => idx !== i,
                                    ),
                                  )
                                }
                                className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Adicionar Diocese + Enter"
                          className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = (e.target as HTMLInputElement).value
                                .trim()
                                .toUpperCase();
                              if (val && !customDioceses.includes(val)) {
                                setCustomDioceses([...customDioceses, val]);
                                (e.target as HTMLInputElement).value = "";
                              }
                            }
                          }}
                        />
                      </div>

                      {/* Cursos */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          Cursos ({customCourses.length})
                        </label>
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl min-h-[40px]">
                          {customCourses.map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-bold flex items-center gap-2 group"
                            >
                              {c}
                              <button
                                onClick={() =>
                                  setCustomCourses(
                                    customCourses.filter((_, idx) => idx !== i),
                                  )
                                }
                                className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Adicionar Curso + Enter"
                          className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = (e.target as HTMLInputElement).value
                                .trim()
                                .toUpperCase();
                              if (val && !customCourses.includes(val)) {
                                setCustomCourses([...customCourses, val]);
                                (e.target as HTMLInputElement).value = "";
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Segurança */}
                  <div className="bg-rose-50 dark:bg-rose-900/10 p-5 rounded-2xl border border-rose-200 dark:border-rose-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-rose-700 dark:text-rose-300 uppercase tracking-widest text-[10px]">
                      <ShieldAlert className="w-4 h-4" /> Senha de Administrador
                    </h3>
                    <div className="space-y-3">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Senha Atual"
                        className="input-modern w-full rounded-xl py-2 px-3 text-sm"
                      />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nova Senha"
                        className="input-modern w-full rounded-xl py-2 px-3 text-sm"
                      />
                      <button
                        onClick={handleSavePassword}
                        className="btn-modern w-full py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-medium"
                      >
                        Trocar Senha Local
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === ("system" as any) && (
                <div className="space-y-8 animate-in fade-in transition-all duration-300">
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[10px]">
                      <Palette className="w-4 h-4" /> Aparência do Aplicativo
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          localStorage.setItem("theme", "light");
                          document.documentElement.classList.remove("dark");
                          window.dispatchEvent(new Event("themeChange"));
                          showStatus("Modo Claro ativado.", "success");
                        }}
                        className="btn-modern flex flex-col items-center justify-center p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                      >
                        <Sun className="w-5 h-5 mb-1" />{" "}
                        <span className="text-[10px] font-bold uppercase">
                          Claro
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          localStorage.setItem("theme", "dark");
                          document.documentElement.classList.add("dark");
                          window.dispatchEvent(new Event("themeChange"));
                          showStatus("Modo Escuro ativado.", "success");
                        }}
                        className="btn-modern flex flex-col items-center justify-center p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                      >
                        <Moon className="w-5 h-5 mb-1" />{" "}
                        <span className="text-[10px] font-bold uppercase">
                          Escuro
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          localStorage.removeItem("theme");
                          if (
                            window.matchMedia("(prefers-color-scheme: dark)")
                              .matches
                          ) {
                            document.documentElement.classList.add("dark");
                          } else {
                            document.documentElement.classList.remove("dark");
                          }
                          window.dispatchEvent(new Event("themeChange"));
                          showStatus("Modo Sistema ativado.", "success");
                        }}
                        className="btn-modern flex flex-col items-center justify-center p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                      >
                        <Settings className="w-5 h-5 mb-1" />{" "}
                        <span className="text-[10px] font-bold uppercase">
                          Auto
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-sky-50 dark:bg-sky-900/10 p-5 rounded-2xl border border-sky-200 dark:border-sky-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-sky-700 dark:text-sky-300 uppercase tracking-widest text-[10px]">
                      <BellRing className="w-4 h-4" /> Notificações do Sistema
                    </h3>
                    <div className="space-y-4">
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Ative as notificações de navegador para ser alertado
                        sempre que novos alunos solicitarem verificações ou
                        enviarem sugestões de edição da identidade estudantil.
                      </p>

                      <button
                        onClick={() => {
                          if (!("Notification" in window)) {
                            showStatus(
                              "Seu navegador não suporta notificações.",
                              "error",
                            );
                            return;
                          }
                          Notification.requestPermission().then(
                            (permission) => {
                              if (permission === "granted") {
                                showStatus(
                                  "Notificações ativadas com sucesso!",
                                  "success",
                                );
                              } else {
                                showStatus(
                                  "Permissão para notificações foi negada.",
                                  "error",
                                );
                              }
                            },
                          );
                        }}
                        className="btn-modern w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <BellRing className="w-4 h-4" /> Configurar Notificações
                        no Dispositivo
                      </button>

                      <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                        <p>
                          <b>Nota:</b> Se você já negou a permissão
                          anteriormente, precisará clicar no ícone de "cadeado"
                          na barra de endereços do seu navegador para permitir
                          manualmente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={handleSaveGeneral}
                  className="btn-modern w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Salvar Todas as Configurações
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { SETTINGS_DOC_PATH, ASSETS_DOC_PATH } from '../lib/constants';

interface AppSettings {
  url: string;
  directorName: string;
  rectorName: string;
  instName: string;
  instColor: string;
  instLogo: string | null;
  cardLogo: string | null;
  cardBackLogo: string | null;
  cardSecondaryBackLogo: string | null;
  cardBackImage: string | null;
  cardFrontText: string;
  cardBackText: string;
  frontLogoConfig: { x: number; y: number; scale: number };
  backLogoConfig: { x: number; y: number; scale: number };
  instSignature: string | null;
  rectorSignature: string | null;
  signatureScale: number;
  rectorSignatureScale: number;
  secondaryBackLogoScale: number;
  instDescription: string;
  cardDescription: string;
  visibleFields: Record<string, boolean>;
  version: string;
  customRoles: string[];
  customCourses: string[];
  customDioceses: string[];
  databaseName: string;
  cardZoom?: number;
  seminariesConfig: Record<string, { logo: string | null; signature: string | null; rectorName: string }>;
}

const DEFAULT_SETTINGS: AppSettings = {
  url: 'https://carteirinhafajopa.netlify.app',
  directorName: '',
  rectorName: '',
  instName: 'FAJOPA e SPSCJ',
  instColor: '#0ea5e9',
  instLogo: null,
  cardLogo: null,
  cardBackLogo: null,
  cardSecondaryBackLogo: null,
  cardBackImage: null,
  cardFrontText: '',
  cardBackText: '',
  frontLogoConfig: { x: 0, y: 0, scale: 100 },
  backLogoConfig: { x: 0, y: 0, scale: 100 },
  instSignature: null,
  rectorSignature: null,
  signatureScale: 100,
  rectorSignatureScale: 100,
  secondaryBackLogoScale: 100,
  instDescription: 'SISTEMA DE VERIFICAÇÃO DE IDENTIDADE',
  cardDescription: 'Documento de identificação estudantil é padronizado e apresenta os dados requeridos pela Lei 12.933/2013 para comprovação de matrícula, sendo sua aceitação sujeita aos critérios dos organizadores de eventos.',
  visibleFields: {
    name: true,
    ra: true,
    course: true,
    birth: true,
    validity: true,
    photo: true,
    qrcode: true,
    logo: true,
    signature: true,
    rectorSignature: true,
    director: true,
    rector: true,
    footer: true,
    diocese: true
  },
  version: '5.2.0',
  customRoles: [],
  customCourses: [],
  customDioceses: [],
  databaseName: 'FAJOPA e SPSCJ',
  cardZoom: 1,
  seminariesConfig: {}
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, SETTINGS_DOC_PATH(appId));
    const unsubscribes: (() => void)[] = [];
    
    // Listener principal
    const unsubMain = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        
        // Garantir que campos de visibilidade novos existam mesclando com o default
        const mergedVisibleFields = {
          ...DEFAULT_SETTINGS.visibleFields,
          ...(data.visibleFields || {})
        };

        // Remove heavy fields from main data if they are empty/null to avoid 
        // overwriting the active loaded assets from the secondary snapshots
        const heavyFieldsList = ['instLogo', 'cardLogo', 'cardBackLogo', 'cardSecondaryBackLogo', 'cardBackImage', 'instSignature', 'rectorSignature'];
        heavyFieldsList.forEach(field => {
          if (data[field] === null || data[field] === undefined) {
            delete data[field];
          }
        });

        setSettings(prev => ({ 
          ...prev, 
          ...data,
          visibleFields: mergedVisibleFields
        }));
      } else {
        setDoc(docRef, DEFAULT_SETTINGS).catch(() => {});
      }
      setLoading(false);
    }, () => setLoading(false));
    unsubscribes.push(unsubMain);

    // Listeners para Ativos Pesados individuais
    const heavyFieldsList = ['instLogo', 'cardLogo', 'cardBackLogo', 'cardSecondaryBackLogo', 'cardBackImage', 'instSignature', 'rectorSignature'];
    heavyFieldsList.forEach(field => {
      const assetRef = doc(db, ASSETS_DOC_PATH(appId, field));
      const unsubAsset = onSnapshot(assetRef, (snapshot) => {
        if (snapshot.exists()) {
          const { data } = snapshot.data();
          // Aceita o data mesmo se for null, para refletir deletes no realtime
          setSettings(prev => ({ ...prev, [field]: data || null }));
        }
      });
      unsubscribes.push(unsubAsset);
    });

    return () => unsubscribes.forEach(u => u());
  }, []);

  useEffect(() => {
    if (settings) {
      localStorage.setItem('fajopa_settings', JSON.stringify(settings));
      // Aplica o zoom visualmente no elemento raiz para persistência imediata
      document.documentElement.style.setProperty('--card-zoom', settings.cardZoom?.toString() || '1');
    }
  }, [settings]);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    // Optimistic UI update
    setSettings(prev => ({ ...prev, ...newSettings }));

    const docRef = doc(db, SETTINGS_DOC_PATH(appId));
    
    const heavyFields = ['instLogo', 'cardLogo', 'cardBackLogo', 'cardSecondaryBackLogo', 'cardBackImage', 'instSignature', 'rectorSignature'];
    
    const settingsToSave = { ...newSettings };
    const assetOperations: Promise<any>[] = [];

    heavyFields.forEach(field => {
      if (field in newSettings) {
        const val = (newSettings as any)[field];
        const assetRef = doc(db, ASSETS_DOC_PATH(appId, field));
        
        if (val && typeof val === 'string' && val.length > 500) {
          // Salva asset grande separado
          assetOperations.push(setDoc(assetRef, { data: val }));
          delete (settingsToSave as any)[field];
        } else if (val === null) {
          // Quando deletado explicitamente, limpa do doc separado e permite que o null continue pro settingsToSave principal
          assetOperations.push(setDoc(assetRef, { data: null }));
        }
      }
    });

    await Promise.all([
      setDoc(docRef, settingsToSave, { merge: true }),
      ...assetOperations
    ]);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

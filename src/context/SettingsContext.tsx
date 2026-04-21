import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { SETTINGS_DOC_PATH, ASSETS_DOC_PATH } from '../lib/constants';

interface AppSettings {
  url: string;
  directorName: string;
  instName: string;
  instColor: string;
  instLogo: string | null;
  cardLogo: string | null;
  cardBackLogo: string | null;
  cardBackImage: string | null;
  cardFrontText: string;
  cardBackText: string;
  frontLogoConfig: { x: number; y: number; scale: number };
  backLogoConfig: { x: number; y: number; scale: number };
  instSignature: string | null;
  signatureScale: number;
  instDescription: string;
  cardDescription: string;
  visibleFields: Record<string, boolean>;
  version: string;
  customRoles: string[];
  customCourses: string[];
}

const DEFAULT_SETTINGS: AppSettings = {
  url: 'https://carteirinhafajopa.netlify.app',
  directorName: '',
  instName: 'FAJOPA',
  instColor: '#0ea5e9',
  instLogo: null,
  cardLogo: null,
  cardBackLogo: null,
  cardBackImage: null,
  cardFrontText: '',
  cardBackText: '',
  frontLogoConfig: { x: 0, y: 0, scale: 100 },
  backLogoConfig: { x: 0, y: 0, scale: 100 },
  instSignature: null,
  signatureScale: 100,
  instDescription: 'SISTEMA DE VERIFICAÇÃO DE IDENTIDADE',
  cardDescription: '',
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
    director: true,
    footer: true
  },
  version: '3.1.6',
  customRoles: [],
  customCourses: []
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
        const data = snapshot.data();
        setSettings(prev => ({ ...prev, ...data }));
      } else {
        setDoc(docRef, DEFAULT_SETTINGS).catch(() => {});
      }
      setLoading(false);
    }, () => setLoading(false));
    unsubscribes.push(unsubMain);

    // Listeners para Ativos Pesados individuais
    const heavyFields = ['instLogo', 'cardLogo', 'cardBackLogo', 'cardBackImage', 'instSignature'];
    heavyFields.forEach(field => {
      const assetRef = doc(db, ASSETS_DOC_PATH(appId, field));
      const unsubAsset = onSnapshot(assetRef, (snapshot) => {
        if (snapshot.exists()) {
          const { data } = snapshot.data();
          if (data) {
            setSettings(prev => ({ ...prev, [field]: data }));
          }
        }
      });
      unsubscribes.push(unsubAsset);
    });

    return () => unsubscribes.forEach(u => u());
  }, []);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const docRef = doc(db, SETTINGS_DOC_PATH(appId));
    
    // Lista de campos que são imagens pesadas
    const heavyFields = ['instLogo', 'cardLogo', 'cardBackLogo', 'cardBackImage', 'instSignature'];
    
    const settingsToSave = { ...newSettings };
    const assetOperations: Promise<any>[] = [];

    // Separar campos pesados
    heavyFields.forEach(field => {
      if (field in newSettings) {
        const val = (newSettings as any)[field];
        // Se existe e é uma string base64 grande, removemos do doc principal e salvamos em separado
        if (val && typeof val === 'string' && val.length > 500) {
          const assetRef = doc(db, ASSETS_DOC_PATH(appId, field));
          assetOperations.push(setDoc(assetRef, { data: val }));
          delete (settingsToSave as any)[field];
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

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { Check, X, Image as ImageIcon } from 'lucide-react';
import { getCroppedImg } from '../lib/cropUtils';

interface ImageCropperModalProps {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (base64: string) => void;
  aspect?: number;
  cropShape?: "rect" | "round";
}

export default function ImageCropperModal({ imageSrc, onClose, onCropComplete, aspect, cropShape = "round" }: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const resolvedAspect = cropShape === "round" ? 1 : aspect;

  const onCropCompleteEvent = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseFullImage = async () => {
    setIsProcessing(true);
    try {
      if (imageSrc.startsWith('data:')) {
        onCropComplete(imageSrc);
        return;
      }
      if (imageSrc.startsWith('blob:')) {
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          onCropComplete(reader.result as string);
        };
        reader.onerror = () => {
          onCropComplete(imageSrc);
        };
        reader.readAsDataURL(blob);
        return;
      }

      // Fallback if not blob / data
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageSrc;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            onCropComplete(canvas.toDataURL('image/jpeg', 0.9));
          } catch (e) {
            onCropComplete(imageSrc);
          }
        } else {
          onCropComplete(imageSrc);
        }
      };
      img.onerror = () => {
        onCropComplete(imageSrc);
      };
    } catch (e) {
      console.error(e);
      onCropComplete(imageSrc);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/90 flex flex-col items-center justify-center p-4 animated-fade-in">
      <div className="relative w-full max-w-md h-[50vh] sm:h-[60vh] bg-black rounded-2xl overflow-hidden shadow-2xl">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={resolvedAspect}
          onCropChange={setCrop}
          onCropComplete={onCropCompleteEvent}
          onZoomChange={setZoom}
          cropShape={cropShape}
          showGrid={false}
        />
      </div>
      
      <div className="mt-6 flex flex-col items-center w-full max-w-md">
        <label className="text-white text-xs font-semibold uppercase tracking-wider mb-2">Ajustar Zoom</label>
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full mb-6 accent-sky-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
        />
        
        <div className="w-full flex flex-col gap-3">
          <button 
            type="button"
            onClick={handleUseFullImage} 
            disabled={isProcessing}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl flex justify-center items-center gap-2 font-black uppercase tracking-wider text-xs transition-all shadow-lg shadow-indigo-600/20 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
          >
            <ImageIcon className="w-4 h-4"/> 
            {isProcessing ? "Processando..." : "Utilizar Imagem Inteira (Sem Recortar)"}
          </button>
          
          <div className="flex justify-between w-full gap-3">
            <button 
              type="button"
              onClick={onClose} 
              disabled={isProcessing}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl flex justify-center items-center gap-1.5 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              <X className="w-4 h-4"/> Cancelar
            </button>
            <button 
              type="button"
              onClick={handleConfirm} 
              disabled={isProcessing}
              className="flex-1 py-3 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white rounded-xl flex justify-center items-center gap-1.5 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              <Check className="w-4 h-4"/> Cortar & Confirmar
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}

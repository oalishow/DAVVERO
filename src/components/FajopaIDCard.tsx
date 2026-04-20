import React, { useState } from 'react';
import type { Member } from '../types';
import { QRCodeCanvas } from 'qrcode.react';
import { URL_STORAGE_KEY, DEFAULT_PUBLIC_URL } from '../lib/constants';

interface FajopaIDCardProps {
  member: Member;
  exportMode?: boolean;
}

export default function FajopaIDCard({ member, exportMode = false }: FajopaIDCardProps) {
  const [flipped, setFlipped] = useState(false);
  
  const baseUrl = localStorage.getItem(URL_STORAGE_KEY) || DEFAULT_PUBLIC_URL;
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const verificationUrl = `${cleanBaseUrl}?verify=${member.alphaCode}`;

  const safeName = member.name?.toUpperCase() || 'N/D';
  const safeRA = member.ra || 'N/D';
  const safeCourse = member.course?.toUpperCase() || 'N/D';
  const safeBirth = member.birthdate || 'N/D';
  const safeDate = member.validityDate ? new Date(member.validityDate + 'T23:59:59').toLocaleDateString('pt-BR') : 'Pelo Qr code';
  
  const avatarUrl = member.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=e2e8f0&color=475569`;

  const frontSide = (
    <div className={`${exportMode ? 'relative w-[600px] aspect-[1.586/1] shrink-0 print-card' : 'absolute w-full h-full backface-hidden print-card'} bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-100 overflow-hidden shadow-2xl shrink-0`} style={{ borderRadius: '16px', border: '1px solid rgba(0,0,0,0.1)' }}>
      {/* Top Divider / Header Decor */}
      <div className="absolute top-0 left-0 w-full h-[18%] bg-blue-950 border-b-4 border-cyan-500 flex items-center z-20 shadow-sm">
         <h1 className="text-white font-black pl-[5%] tracking-wide" style={{ fontSize: 'clamp(16px, 4vw, 26px)' }}>
           IDENTIFICAÇÃO ESTUDANTIL
         </h1>
      </div>

      {/* Bottom Footer block */}
      <div className="absolute bottom-0 left-0 w-[60%] h-[30%] bg-blue-950" style={{ clipPath: 'polygon(0 40%, 100% 100%, 0 100%)', zIndex: 0 }}></div>
      <div className="absolute bottom-0 left-0 w-[55%] h-[20%] bg-blue-900" style={{ clipPath: 'polygon(0 40%, 100% 100%, 0 100%)', zIndex: 1 }}></div>

      <div className="absolute bottom-0 left-[20%] right-[32%] h-[17%] bg-blue-900 flex items-center justify-center z-2" style={{ clipPath: 'polygon(5% 0, 100% 0, 100% 100%, 0 100%)' }}>
         <span className="text-white font-bold tracking-widest uppercase pl-4" style={{ fontSize: 'clamp(7px, 1.6vw, 12px)' }}>
           FACULDADE JOÃO PAULO II
         </span>
      </div>

      {/* Texts over left bottom */}
      <div className="absolute bottom-[4%] left-[4%] text-white z-10 flex flex-col items-center">
        <span className="font-bold leading-none" style={{ fontSize: 'clamp(9px, 2vw, 13px)' }}>CÓD. USO:</span>
        <span className="font-bold tracking-widest leading-none mt-1 bg-black/20 px-1 py-0.5 rounded" style={{ fontSize: 'clamp(11px, 2.5vw, 16px)' }}>
          {member.alphaCode}
        </span>
      </div>

      {/* Left Values List */}
      <div className="absolute top-[26%] left-[3%] w-[63%] h-[48%] flex flex-col justify-around z-20">
        {[
          { label: 'NOME:', value: safeName, w: '100%', isName: true },
          { label: 'R.A.:', value: safeRA, w: '50%' },
          { label: 'CURSO:', value: safeCourse, w: '50%' },
          { label: 'NASC:', value: safeBirth, w: '50%' },
          { label: 'VAL:', value: safeDate, w: '50%' },
        ].map((row, i) => (
          <div key={i} className={`flex bg-white rounded-full border-[1.5px] border-slate-400 overflow-hidden shadow-sm items-center ${row.isName ? 'h-[23%]' : 'h-[16%]'}`} style={{ width: row.w }}>
            <span className="bg-white text-blue-900 font-bold px-2 flex items-center justify-center h-full border-r-[1.5px] border-slate-300 tracking-tight shrink-0" style={{ fontSize: 'clamp(10px, 2.2vw, 16px)' }}>
              {row.label}
            </span>
            <span className={`text-slate-800 font-bold px-2 bg-white flex-1 h-full flex items-center ${row.isName ? 'text-left justify-start whitespace-normal leading-[1.05] break-words' : 'justify-center whitespace-nowrap overflow-hidden text-ellipsis'}`} style={{ fontSize: row.isName ? 'clamp(9px, 1.8vw, 14px)' : 'clamp(10px, 2vw, 15px)' }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Center Logo FAJOPA */}
      <div className="absolute bottom-[23%] left-[35%] w-[30%] h-[40%] flex flex-col items-center justify-center opacity-95 z-10">
         <div className="relative w-[80%] h-[55%] pointer-events-none mb-1">
            <svg viewBox="0 0 100 100" className="w-full h-full text-blue-900/90">
              <path fill="currentColor" d="M50 80 Q65 60 80 40 Q70 60 50 70 Q30 60 20 40 Q35 60 50 80 Z" />
              <path fill="#0ea5e9" d="M50 70 Q35 50 15 30 Q30 45 50 60 Z" />
              <path fill="#0ea5e9" d="M50 70 Q65 50 85 30 Q70 45 50 60 Z" />
              <circle cx="50" cy="20" r="5" fill="currentColor"/>
            </svg>
         </div>
         <div className="bg-blue-900 w-[110%] rounded flex items-center justify-center text-white font-black whitespace-nowrap shadow-sm mb-1" style={{ fontSize: 'clamp(7px, 1.5vw, 11px)', transform: 'rotate(-2deg)', padding: '2px 0' }}>
           FIDES ET RATIO
         </div>
         <div className="text-blue-900/90 font-black tracking-tighter" style={{ fontSize: 'clamp(20px, 4.5vw, 32px)', lineHeight: '1' }}>
           FAJOPA
         </div>
      </div>

      {/* Right Area (Photo & QR Code) */}
      <div className="absolute top-[20%] right-[3%] w-[28%] h-[78%] flex flex-col items-center justify-start pt-[2%] z-20">
        <div className="w-[90%] bg-white rounded-[15%] border-[3px] border-slate-800 overflow-hidden shadow-md" style={{ aspectRatio: '3/3.8' }}>
          <img src={avatarUrl} crossOrigin="anonymous" alt="Fotografia" className="w-full h-full object-cover" />
        </div>
        
        <div className="w-[60%] aspect-square bg-white border-[2px] border-slate-800 p-1 shadow-sm mt-[6%]">
           <QRCodeCanvas 
            value={verificationUrl} 
            size={256}
            style={{ width: '100%', height: '100%' }}
            level="M" 
            includeMargin={false}
          />
        </div>
      </div>
    </div>
  );

  const backSide = (
    <div className={`${exportMode ? 'relative w-[600px] aspect-[1.586/1] shrink-0 print-card' : 'absolute w-full h-full backface-hidden rotate-y-180 print-card'} bg-gradient-to-br from-indigo-50 to-sky-100 overflow-hidden shadow-2xl`} style={{ borderRadius: '16px', border: '1px solid rgba(0,0,0,0.1)' }}>
      {/* Top left decors */}
      <div className="absolute top-0 left-0 w-[45%] h-[35%] bg-blue-950" style={{ clipPath: 'polygon(0 0, 100% 0, 30% 100%, 0 100%)' }}></div>
      <div className="absolute top-0 left-0 w-[35%] h-[25%] bg-cyan-500" style={{ clipPath: 'polygon(0 0, 100% 0, 40% 100%, 0 100%)' }}></div>
      
      <div className="absolute top-[8%] w-[86%] left-[7%] text-center text-blue-950 font-bold leading-tight bg-white/95 backdrop-blur-sm border-[2px] border-slate-200 shadow-md rounded-xl p-2 z-10" style={{ fontSize: 'clamp(10px, 2vw, 15px)' }}>
        Este cartão é pessoal e intransferível, sendo o usuário responsável pela utilização. Em caso de perda, avise imediatamente a secretaria da faculdade.
      </div>

      <div className="absolute top-[35%] w-full flex flex-col items-center z-0">
        {/* Signature Area */}
        <div className="w-[80%] max-w-[200px] h-[50px] sm:h-[60px] border-b-[2.5px] border-slate-800 flex items-end justify-center pb-2 opacity-80 mt-2">
           {/* Assinatura em branco conforme solicitado */}
        </div>
        <div className="text-blue-900 font-bold mt-1" style={{ fontSize: 'clamp(10px, 2.5vw, 16px)' }}>DIRETOR GERAL DA FACULDADE</div>
        
        <div className="mt-[3%] flex items-center justify-center gap-2 opacity-90 scale-90 sm:scale-100">
           <div className="w-[50px] h-[50px]">
              <svg viewBox="0 0 100 100" className="w-full h-full text-blue-900">
                <path fill="currentColor" d="M50 80 Q65 60 80 40 Q70 60 50 70 Q30 60 20 40 Q35 60 50 80 Z" />
                <path fill="#0ea5e9" d="M50 70 Q35 50 15 30 Q30 45 50 60 Z" />
                <path fill="#0ea5e9" d="M50 70 Q65 50 85 30 Q70 45 50 60 Z" />
                <circle cx="50" cy="20" r="5" fill="currentColor"/>
              </svg>
           </div>
           <div className="flex flex-col text-left">
              <div className="flex items-center gap-1">
                <span className="text-blue-900 font-black tracking-tighter" style={{ fontSize: 'clamp(22px, 4vw, 28px)', lineHeight: '1' }}>FAJOPA</span>
              </div>
              <div className="bg-blue-900 text-white rounded font-bold px-1 py-0.5 text-center mt-0.5 whitespace-nowrap shadow-sm" style={{ fontSize: 'clamp(7px, 1.2vw, 9px)' }}>
                 FIDES ET RATIO
              </div>
              <span className="text-blue-800 font-bold tracking-tight mt-1 leading-none" style={{ fontSize: 'clamp(8px, 1.3vw, 10px)' }}>FACULDADE JOÃO PAULO II</span>
           </div>
        </div>
        
        <div className="mt-[2%] w-[85%] text-center text-blue-900 font-bold leading-tight" style={{ fontSize: 'clamp(10px, 1.9vw, 14px)' }}>
          Documento padronizado nacionalmente conforme a lei 12.933/2013.<br/>Válido em todo território nacional até o findar da validade.
        </div>
      </div>

      {/* Bottom Footer decors */}
      <div className="absolute bottom-[8%] right-0 w-[25%] h-[15%] bg-blue-950" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
      <div className="absolute bottom-[4%] right-0 w-[15%] h-[10%] bg-cyan-500" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>

      <div className="absolute bottom-0 left-[5%] right-[5%] h-[14%] bg-blue-950 flex flex-col justify-center text-center px-[2%]" style={{ clipPath: 'polygon(2% 0, 98% 0, 100% 100%, 0 100%)' }}>
         <span className="text-white font-medium" style={{ fontSize: 'clamp(8px, 1.6vw, 12px)' }}>
           Rua Bartolomeu de Gusmão, 531, São Miguel, Marília-SP, CEP 17506-280. Tel: (14) 3414-1965 - secretaria@fajopa.edu.br
         </span>
      </div>
    </div>
  );

  if (exportMode) {
    return (
      <div id="export-card-node" className="flex flex-col gap-10 w-[600px] items-center p-8 bg-white" style={{ position: 'absolute', top: '2000px', left: '-9999px' }}>
        {frontSide}
        {backSide}
      </div>
    );
  }

  return (
    <div className="perspective-1000 w-full max-w-[600px] aspect-[1.586/1] mx-auto cursor-pointer focus:outline-none no-print max-sm:portrait:rotate-90 max-sm:portrait:scale-[1.3] max-sm:portrait:my-24 sm:portrait:rotate-0 sm:portrait:scale-100 sm:portrait:my-0 transition-transform origin-center" onClick={() => setFlipped(!flipped)}>
      <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}>
        {frontSide}
        {backSide}
      </div>
    </div>
  );
}

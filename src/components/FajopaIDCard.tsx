import React, { useState, useEffect, useRef } from 'react';
import type { Member } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { URL_STORAGE_KEY, DEFAULT_PUBLIC_URL, DIRECTOR_NAME_KEY, DEFAULT_DIRECTOR_NAME } from '../lib/constants';

interface FajopaIDCardProps {
  member: Member;
  exportMode?: boolean;
}

export default function FajopaIDCard({ member, exportMode = false }: FajopaIDCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [directorName, setDirectorName] = useState(DEFAULT_DIRECTOR_NAME);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const processedAt = member.createdAt ? new Date(member.createdAt).toLocaleString('pt-BR') : 'N/D';
  
  useEffect(() => {
    setDirectorName(localStorage.getItem(DIRECTOR_NAME_KEY) || DEFAULT_DIRECTOR_NAME);
  }, []);

  useEffect(() => {
    if (exportMode) return;
    
    const calculateScale = (width: number) => {
       const isPortrait = window.innerWidth < 640 && window.innerHeight > window.innerWidth;
       // If portrait, the card is rotated 90deg, so its visual width is 378.
       // We scale it so it fits into the container width perfectly.
       // Add a slight 5% margin down on portrait to ensure it doesn't touch the very edges.
       return isPortrait ? (width * 0.95) / 378 : width / 600;
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScale(calculateScale(entry.contentRect.width));
      }
    });

    if (containerRef.current) observer.observe(containerRef.current);
    
    const handleWinResize = () => {
       if (containerRef.current) {
          setScale(calculateScale(containerRef.current.getBoundingClientRect().width));
       }
    };
    window.addEventListener('resize', handleWinResize);
    
    return () => {
       observer.disconnect();
       window.removeEventListener('resize', handleWinResize);
    };
  }, [exportMode]);
  
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
    <div 
      className={`absolute w-[600px] h-[378px] backface-hidden print-card bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-100 overflow-hidden shadow-2xl shrink-0`} 
      style={{ 
        borderRadius: '16px', 
        border: '1px solid rgba(0,0,0,0.1)',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        transform: 'translate3d(0,0,0)',
        WebkitTransform: 'translate3d(0,0,0)'
      }}
    >
      {/* Top Divider / Header Decor */}
      <div className="absolute top-0 left-0 w-full h-[18%] bg-blue-950 border-b-4 border-cyan-500 flex items-center z-20 shadow-sm">
         <h1 className="text-white font-black pl-[5%] tracking-wide" style={{ fontSize: '24px' }}>
           IDENTIFICAÇÃO ESTUDANTIL
         </h1>
      </div>

      {/* Bottom Footer block */}
      <div className="absolute bottom-0 left-0 w-[60%] h-[30%] bg-blue-950" style={{ clipPath: 'polygon(0 40%, 100% 100%, 0 100%)', zIndex: 0 }}></div>
      <div className="absolute bottom-0 left-0 w-[55%] h-[20%] bg-blue-900" style={{ clipPath: 'polygon(0 40%, 100% 100%, 0 100%)', zIndex: 1 }}></div>

      <div className="absolute bottom-0 left-[20%] right-[32%] h-[17%] bg-blue-900 flex items-center justify-center z-2" style={{ clipPath: 'polygon(5% 0, 100% 0, 100% 100%, 0 100%)' }}>
         <span className="text-white font-bold tracking-widest uppercase pl-4" style={{ fontSize: '10px' }}>
           FACULDADE JOÃO PAULO II
         </span>
      </div>

      {/* Texts over left bottom */}
      <div className="absolute bottom-[4%] left-[4%] text-white z-10 flex flex-col items-center">
        <span className="font-bold leading-none" style={{ fontSize: '12px' }}>CÓD. USO:</span>
        <span className="font-bold tracking-widest leading-none mt-1 bg-black/20 px-2 py-0.5 rounded" style={{ fontSize: '16px' }}>
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
            <span className="bg-white text-blue-900 font-bold px-2 flex items-center justify-center h-full border-r-[1.5px] border-slate-300 tracking-tight shrink-0" style={{ fontSize: '13px' }}>
              {row.label}
            </span>
            <span className={`text-slate-800 font-bold px-2 bg-white flex-1 h-full flex items-center ${row.isName ? 'text-left justify-start whitespace-normal leading-[1.05] break-words' : 'justify-center whitespace-nowrap overflow-hidden text-ellipsis'}`} style={{ fontSize: row.isName ? '12px' : '12px' }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

       {/* Center Logo FAJOPA */}
      <div className="absolute bottom-[23%] left-[36%] w-[28%] h-[50%] flex flex-col items-center justify-center opacity-95 z-10 pointer-events-none">
         <svg viewBox="0 0 300 300" className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
            {/* Left Wing (Light Blue - layered feathers) */}
            <path d="M140,165 C110,165 40,140 10,70 C50,110 110,140 140,145 Z" fill="#2096d3"/>
            <path d="M140,165 C100,175 30,160 5,100 C50,140 110,155 140,155 Z" fill="#1b7db0"/>
            <path d="M140,165 C80,185 20,185 10,135 C50,170 110,175 140,165 Z" fill="#16628c"/>
            
            {/* Right Wing (Dark Blue - layered feathers) */}
            <path d="M150,165 C180,165 250,140 280,70 C240,110 180,140 150,145 Z" fill="#1d2d5b"/>
            <path d="M150,165 C190,175 260,160 285,100 C240,140 180,155 150,155 Z" fill="#18254b"/>
            <path d="M150,165 C210,185 270,185 280,135 C240,170 180,175 150,165 Z" fill="#121b36"/>

            {/* Bird Body/Head */}
            <path d="M145,170 Q135,130 145,90 Q155,75 160,85 Q155,85 150,95 Q145,100 145,170 Z" fill="#2096d3" />

            {/* Ribbon */}
            <path d="M25,195 Q145,175 265,195 L265,220 Q145,200 25,220 Z" fill="#1d2d5b" />
            <path d="M25,195 L5,230 L40,217 Z" fill="#0f172a" />
            <path d="M265,195 L285,230 L250,217 Z" fill="#0f172a" />

            <path id="ribbon-curve-front" d="M35,214 Q145,194 255,214" fill="none" />
            <text fill="white" fontFamily="Arial, Helvetica, sans-serif" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="1.2">
               <textPath href="#ribbon-curve-front" startOffset="50%">FIDES ET RATIO</textPath>
            </text>

            <text x="145" y="265" fill="#1d2d5b" fontFamily="Impact, Arial Black, sans-serif" fontSize="48" fontWeight="900" textAnchor="middle" letterSpacing="1">FAJOPA</text>
            <text x="145" y="285" fill="#333333" fontFamily="Arial, Helvetica, sans-serif" fontSize="13" fontWeight="bold" textAnchor="middle" letterSpacing="0.3">FACULDADE JOÃO PAULO II</text>
         </svg>
      </div>

      {/* Right Area (Photo & QR Code) */}
      <div className="absolute top-[20%] right-[3%] w-[28%] h-[78%] flex flex-col items-center justify-start pt-[2%] z-20">
        <div className="w-[90%] bg-white rounded-[15%] border-[3px] border-slate-800 overflow-hidden shadow-md" style={{ aspectRatio: '3/3.8' }}>
          <img src={avatarUrl} crossOrigin="anonymous" alt="Fotografia" className="w-full h-full object-cover" />
        </div>
        
        <div className="w-[60%] aspect-square bg-white border-[2px] border-slate-800 p-1 shadow-sm mt-[6%]">
           <QRCodeSVG 
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
    <div 
      className={`absolute w-[600px] h-[378px] backface-hidden print-card bg-gradient-to-br from-indigo-50 to-sky-100 overflow-hidden shadow-2xl shrink-0`} 
      style={{ 
        borderRadius: '16px', 
        border: '1px solid rgba(0,0,0,0.1)',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        transform: exportMode ? 'translate3d(0,0,0)' : 'rotateY(180deg) translate3d(0,0,0)',
        WebkitTransform: exportMode ? 'translate3d(0,0,0)' : 'rotateY(180deg) translate3d(0,0,0)'
      }}
    >
      {/* Top left decors */}
      <div className="absolute top-0 left-0 w-[45%] h-[35%] bg-blue-950" style={{ clipPath: 'polygon(0 0, 100% 0, 30% 100%, 0 100%)' }}></div>
      <div className="absolute top-0 left-0 w-[35%] h-[25%] bg-cyan-500" style={{ clipPath: 'polygon(0 0, 100% 0, 40% 100%, 0 100%)' }}></div>
      
      <div className="absolute top-[8%] w-[86%] left-[7%] text-center text-blue-950 font-bold leading-tight bg-white/95 backdrop-blur-sm border-[2px] border-slate-200 shadow-md rounded-xl p-2 z-10" style={{ fontSize: '13px' }}>
        Este cartão é pessoal e intransferível, sendo o usuário responsável pela utilização. Em caso de perda, avise imediatamente a secretaria da faculdade.
      </div>

      <div className="absolute top-[35%] w-full flex flex-col items-center z-0">
        {/* Signature Area */}
        <div className="w-[80%] max-w-[200px] h-[50px] sm:h-[60px] border-b-[2.5px] border-slate-800 flex items-end justify-center pb-2 mt-2">
        </div>
        
        {directorName ? (
           <div className="flex flex-col items-center mt-1 leading-none">
             <div className="text-slate-800 font-bold uppercase tracking-tight text-[14px] leading-none mb-0.5">{directorName}</div>
             <div className="text-blue-900 font-bold text-[11px] leading-none">DIRETOR GERAL DA FACULDADE</div>
           </div>
        ) : (
           <div className="text-blue-900 font-bold mt-2 text-[11px]">DIRETOR GERAL DA FACULDADE</div>
        )}
        
        <div className="mt-[4%] flex items-center justify-center gap-2 opacity-90 pb-1">
           <div className="w-[60px] h-[60px]">
              <svg viewBox="0 0 300 170" className="w-full h-full drop-shadow-md pb-2">
                 <defs>
                    <linearGradient id="wd2" x1="0%" y1="0%" x2="100%" y2="100%">
                       <stop offset="0%" stopColor="#1e3a8a" />
                       <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                    <linearGradient id="wl2" x1="0%" y1="0%" x2="100%" y2="100%">
                       <stop offset="0%" stopColor="#0284c7" />
                       <stop offset="100%" stopColor="#0369a1" />
                    </linearGradient>
                 </defs>

                 {/* Left Wing (Light Blue - layered feathers) */}
                 <path d="M140,165 C110,165 40,140 10,70 C50,110 110,140 140,145 Z" fill="url(#wl2)"/>
                 <path d="M140,165 C100,175 30,160 5,100 C50,140 110,155 140,155 Z" fill="url(#wl2)" opacity="0.8"/>
                 <path d="M140,165 C80,185 20,185 10,135 C50,170 110,175 140,165 Z" fill="url(#wl2)" opacity="0.6"/>
                 
                 {/* Right Wing (Dark Blue - layered feathers) */}
                 <path d="M150,165 C180,165 250,140 280,70 C240,110 180,140 150,145 Z" fill="url(#wd2)"/>
                 <path d="M150,165 C190,175 260,160 285,100 C240,140 180,155 150,155 Z" fill="url(#wd2)" opacity="0.8"/>
                 <path d="M150,165 C210,185 270,185 280,135 C240,170 180,175 150,165 Z" fill="url(#wd2)" opacity="0.6"/>

                 <path d="M145,170 Q135,130 145,90 Q155,75 160,85 Q155,85 150,95 Q145,100 145,170 Z" fill="#2096d3" />
              </svg>
           </div>
           <div className="flex flex-col text-left">
              <div className="flex items-center gap-1">
                <span className="text-blue-900 font-black tracking-tighter" style={{ fontSize: '26px', lineHeight: '1' }}>FAJOPA</span>
              </div>
              <div className="bg-blue-900 text-white rounded font-bold px-1 py-0.5 text-center mt-0.5 whitespace-nowrap shadow-sm" style={{ fontSize: '8px' }}>
                 FIDES ET RATIO
              </div>
              <span className="text-blue-800 font-bold tracking-tight mt-1 leading-none" style={{ fontSize: '10px' }}>FACULDADE JOÃO PAULO II</span>
           </div>
        </div>
        
        <div className="mt-[3%] w-[85%] text-center text-blue-900 font-bold leading-tight" style={{ fontSize: '12px' }}>
          Documento padronizado nacionalmente conforme a lei 12.933/2013.<br/>Válido em todo território nacional até o findar da validade.
        </div>
      </div>

      <div className="absolute top-[2%] right-[4%] opacity-50 text-[6.5px] text-right font-bold text-blue-950 pointer-events-none leading-tight select-none">
         carteirinhafajopa.netlify.app<br/>
         ©2025 - Alison Fernando Rodrigues dos Santos - Verify ID<br/>
         Processado em: {processedAt}
      </div>

      {/* Bottom Footer decors */}
      <div className="absolute bottom-[8%] right-0 w-[25%] h-[15%] bg-blue-950" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
      <div className="absolute bottom-[4%] right-0 w-[15%] h-[10%] bg-cyan-500" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>

      <div className="absolute bottom-0 left-[5%] right-[5%] h-[14%] bg-blue-950 flex flex-col justify-center text-center px-[2%]" style={{ clipPath: 'polygon(2% 0, 98% 0, 100% 100%, 0 100%)' }}>
         <span className="text-white font-medium" style={{ fontSize: '10px' }}>
           Rua Bartolomeu de Gusmão, 531, São Miguel, Marília-SP, CEP 17506-280. Tel: (14) 3414-1965 - secretaria@fajopa.edu.br
         </span>
      </div>
    </div>
  );

  if (exportMode) {
    return (
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <div id="export-card-node" className="flex flex-col gap-10 w-[600px] items-center p-8 bg-white" style={{ position: 'relative' }}>
          <div className="relative w-[600px] h-[378px]">
            {frontSide}
          </div>
          <div className="relative w-[600px] h-[378px]">
             {backSide}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="perspective-1000 w-full max-w-[600px] aspect-[1.586/1] max-sm:portrait:aspect-[1/1.586] mx-auto cursor-pointer focus:outline-none no-print transition-transform origin-center flex items-center justify-center max-sm:portrait:my-4 sm:portrait:my-0" 
      onClick={() => setFlipped(!flipped)}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        <div className="w-[600px] h-[378px] transition-transform duration-500 max-sm:portrait:rotate-90 origin-center">
           <div 
          className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}
          style={{ 
            transformStyle: 'preserve-3d', 
            WebkitTransformStyle: 'preserve-3d',
            perspective: '1000px',
            WebkitPerspective: '1000px'
          }}
        >
          {frontSide}
          {backSide}
        </div>
        </div>
      </div>
    </div>
  );
}

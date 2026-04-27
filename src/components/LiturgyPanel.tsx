import React, { useState } from "react";
import { BookHeart, Sunrise, Sun, Sunset, Moon, ExternalLink, BookOpen, CalendarHeart, X } from "lucide-react";

export default function LiturgyPanel() {
  const [selectedHour, setSelectedHour] = useState<{ id: string, name: string, url: string } | null>(null);

  const hours = [
    { id: "liturgia-diaria", name: "Liturgia Diária", icon: BookOpen, time: "Missa do Dia", url: "https://liturgia.cancaonova.com/" },
    { id: "santo-do-dia", name: "Santo do Dia", icon: CalendarHeart, time: "Hagiografia", url: "https://santo.cancaonova.com/" },
    { id: "oficio", name: "Ofício das Leituras", icon: BookHeart, time: "Madrugada/Manhã", url: "https://liturgiadashoras.online/oficio-das-leituras/" },
    { id: "laudes", name: "Laudes", icon: Sunrise, time: "Manhã", url: "https://liturgiadashoras.online/laudes/" },
    { id: "hora-media", name: "Hora Média", icon: Sun, time: "Dia", url: "https://liturgiadashoras.online/hora-media/" },
    { id: "vesperas", name: "Vésperas", icon: Sunset, time: "Tarde/Noite", url: "https://liturgiadashoras.online/vesperas/" },
    { id: "completas", name: "Completas", icon: Moon, time: "Noite (Antes de dormir)", url: "https://liturgiadashoras.online/completas/" },
  ];

  return (
    <div className="space-y-6">
      {selectedHour && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900 animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="bg-rose-100 dark:bg-rose-900/30 p-2 rounded-lg">
                <BookHeart className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white leading-none mb-1">{selectedHour.name}</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Modo Leitura Sem Anúncios</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <a 
                 href={selectedHour.url} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
               >
                 Abrir no Navegador <ExternalLink className="w-3 h-3" />
               </a>
              <button
                onClick={() => setSelectedHour(null)}
                className="p-2 bg-slate-200 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 rounded-full transition-colors text-slate-600 dark:text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative">
            <iframe 
              src={selectedHour.url} 
              className="w-full h-full border-none"
              sandbox="allow-same-origin allow-forms"
              title={selectedHour.name}
            />
          </div>
        </div>
      )}

      <div className="bg-rose-600 dark:bg-rose-700 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-rose-500 dark:border-rose-600">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none mix-blend-overlay">
          <BookHeart className="w-32 h-32" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
              <BookHeart className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-2">
            Liturgia
          </h2>
          <p className="text-rose-100 font-medium text-sm sm:text-base max-w-md">
            Acesse rapidamente a Liturgia Diária, o Santo do Dia e as orações do ofício divino para rezar em comunhão com toda a Igreja.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {hours.map((hour) => (
          <button
            key={hour.id}
            onClick={() => setSelectedHour(hour)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-rose-400 dark:hover:border-rose-500 hover:shadow-md transition-all group flex flex-col items-center text-center gap-3"
          >
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <hour.icon className="w-6 h-6 text-rose-500 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-1 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                {hour.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {hour.time}
              </p>
            </div>
            <div className="mt-2 text-[10px] uppercase font-bold tracking-wider text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              Abrir Leitura <ExternalLink className="w-3 h-3" />
            </div>
          </button>
        ))}
      </div>
      
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          "Sete vezes ao dia eu te louvo, pelas tuas justas decisões." <br/>
          <span className="text-xs font-bold mt-2 inline-block">— Salmo 119, 164</span>
        </p>
      </div>
    </div>
  );
}

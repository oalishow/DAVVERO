import React, { useState } from "react";
import { BookHeart, Sunrise, Sun, Sunset, Moon, ExternalLink, BookOpen, CalendarHeart, X, Youtube, Maximize2, Minimize2 } from "lucide-react";

export default function LiturgyPanel() {
  const [selectedHour, setSelectedHour] = useState<{ id: string, name: string, url: string } | null>(null);
  const [showYoutube, setShowYoutube] = useState(false);
  const [ytIsExpanded, setYtIsExpanded] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytVideoId, setYtVideoId] = useState("");

  const handleYtUrl = (url: string) => {
    setYtUrl(url);
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      setYtVideoId(match[2]);
    }
  };

  const hours = [
    { id: "liturgia-diaria", name: "Liturgia Diária (CNBB)", icon: BookOpen, time: "Missa do Dia", url: "https://www.cnbb.org.br/liturgia-diaria/" },
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
               <button
                 onClick={() => setShowYoutube(!showYoutube)}
                 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                   showYoutube 
                    ? "bg-rose-600 text-white shadow-md active:scale-95" 
                    : "text-slate-600 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                 }`}
               >
                 <Youtube className="w-4 h-4" /> 
                 <span className="hidden xs:inline">{showYoutube ? "Fechar Vídeo" : "Assistir no YouTube"}</span>
               </button>
               <a 
                 href={selectedHour.url} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
               >
                 Abrir no Navegador <ExternalLink className="w-3 h-3" />
               </a>
              <button
                onClick={() => {
                  setSelectedHour(null);
                  setShowYoutube(false);
                }}
                className="p-2 bg-slate-200 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 rounded-full transition-colors text-slate-600 dark:text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative overflow-hidden">
            <iframe 
              src={selectedHour.url} 
              className="w-full h-full border-none"
              sandbox="allow-same-origin allow-forms allow-scripts allow-popups allow-popups-to-escape-sandbox"
              title={selectedHour.name}
            />

            {/* Miniature YouTube Player */}
            {showYoutube && (
              <div 
                className={`absolute bottom-4 right-4 z-20 bg-black rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 border-2 border-slate-800 dark:border-slate-700 group ${
                  ytIsExpanded ? "w-[90%] md:w-[640px] aspect-video" : "w-[240px] aspect-video"
                }`}
              >
                <div className="absolute top-0 left-0 w-full h-8 flex flex-row items-center justify-between px-2 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
                   <span className="text-[10px] text-white font-bold truncate pr-2">YouTube</span>
                   <div className="flex gap-1">
                     <button onClick={() => {
                        setYtUrl(""); 
                        setYtVideoId("");
                     }} className="text-white hover:text-sky-400 transition-colors text-[10px] px-1 font-bold">
                       NOVO
                     </button>
                     <button onClick={() => setYtIsExpanded(!ytIsExpanded)} className="text-white hover:text-sky-400 transition-colors">
                       {ytIsExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                     </button>
                     <button onClick={() => setShowYoutube(false)} className="text-white hover:text-rose-400 transition-colors">
                       <X className="w-3 h-3" />
                     </button>
                   </div>
                </div>
                {ytVideoId ? (
                  <div className="w-full h-full relative">
                    <iframe
                      src={ytVideoId.startsWith('videoseries') 
                        ? `https://www.youtube.com/embed?${ytVideoId}&autoplay=1` 
                        : `https://www.youtube.com/embed/${ytVideoId}?autoplay=1&rel=0`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      title="YouTube video player"
                    />
                    <button 
                      onClick={() => { setYtVideoId(""); setYtUrl(""); }}
                      className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full hover:bg-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-4 relative text-center">
                    <Youtube className={`text-rose-500 mb-2 transition-all ${ytIsExpanded ? 'w-12 h-12' : 'w-8 h-8'}`} />
                    <p className={`text-white font-bold mb-3 ${ytIsExpanded ? 'text-sm' : 'text-[10px]'}`}>Cole o Link do Vídeo</p>
                    
                    <div className="w-full max-w-xs space-y-2">
                      <input 
                        type="text" 
                        placeholder="Cole o link copiado aqui..." 
                        className={`w-full ${ytIsExpanded ? 'text-xs' : 'text-[9px]'} p-2 rounded bg-slate-800 text-white border border-slate-700 outline-none focus:border-rose-500 transition-colors`}
                        value={ytUrl}
                        onChange={(e) => handleYtUrl(e.target.value)}
                        autoFocus
                      />
                      
                      <button 
                        onClick={() => {
                          const today = new Date().toLocaleDateString('pt-BR');
                          const query = encodeURIComponent(`liturgia das horas ${today} ao vivo`);
                          setYtVideoId(`listType=search&list=${query}`);
                        }}
                        className={`w-full py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-600/30 rounded-lg transition-all font-bold uppercase tracking-widest ${ytIsExpanded ? 'text-[10px]' : 'text-[8px]'}`}
                      >
                        Buscar Liturgia de Hoje
                      </button>
                    </div>

                    <p className={`text-slate-500 mt-4 leading-relaxed ${ytIsExpanded ? 'text-[10px] px-4' : 'text-[8px] px-2'}`}>
                      <strong className="text-rose-400">Dica:</strong> Se o vídeo da página apresentar "conexão recusada", clique com o botão direito nele (ou segure no celular), escolha <strong>"Copiar endereço do link"</strong> e cole acima.
                    </p>
                  </div>
                )}
              </div>
            )}
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
            onClick={() => {
              setSelectedHour(hour);
              if (hour.id !== "liturgia-diaria" && hour.id !== "santo-do-dia") {
                setShowYoutube(true);
              }
            }}
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

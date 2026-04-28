import { useState, useEffect, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GraduationCap, Landmark, Image as ImageIcon, FileText, CheckCircle, Trash2, Pin, MessageSquare, BarChart2, Check, ExternalLink, X } from "lucide-react";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import { db, storage, auth, appId, handleFirestoreError, OperationType } from "../lib/firebase";
import { MuralPost, Member } from "../types";

export default function MuralPage() {
  const [activeTab, setActiveTab] = useState<"academico" | "seminario">("academico");
  const [posts, setPosts] = useState<MuralPost[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<{ id: string, name: string } | null>(null);
  const myUserId = currentUserData?.id || auth.currentUser?.uid || "anonymous";

  // Form states
  const [isComposing, setIsComposing] = useState(false);
  const [postText, setPostText] = useState("");
  const [postType, setPostType] = useState<"message" | "poll">("message");
  const [externalLink, setExternalLink] = useState("");
  const [externalLinkType, setExternalLinkType] = useState<"link" | "image" | "video" | "document">("link");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [isAnonymousPoll, setIsAnonymousPoll] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if user is admin via Firebase Auth (Management panel users)
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user && !user.isAnonymous) {
        setIsAdmin(true);
      } else {
        // If not a management user, check student profile for roles
        const bondedId = localStorage.getItem("davveroId_student_identity");
        if (bondedId) {
          getDoc(doc(db, `artifacts/${appId}/public/data/students`, bondedId)).then(snap => {
            if (snap.exists()) {
              const m = snap.data() as Member;
              setCurrentUserData({ id: m.id, name: m.name });
              if (m.roles && m.roles.some(r => ['admin', 'diretoria', 'gestão', 'comunicação', 'secretaria'].includes(r.toLowerCase()))) {
                setIsAdmin(true);
              }
            }
          });
        }
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, `artifacts/${appId}/public/data/mural_posts`),
      where("tabFn", "==", activeTab)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetched: MuralPost[] = [];
      snap.forEach(doc => fetched.push({ id: doc.id, ...doc.data() } as MuralPost));
      
      // Sort in memory (descending by createdAt)
      fetched.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      // Sort in memory to keep pinned posts at top
      fetched.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0; // maintain original desc order for others
      });
      setPosts(fetched);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `artifacts/${appId}/public/data/mural_posts`);
    });

    return () => unsub();
  }, [activeTab]);

  const handleAddPollOption = () => {
    setPollOptions([...pollOptions, ""]);
  };

  const updatePollOption = (index: number, val: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = val;
    setPollOptions(newOptions);
  };

  const handleRemovePollOption = (index: number) => {
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      alert("Apenas administradores podem fazer upload de arquivos.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("O arquivo é muito grande. O limite é de 10MB.");
      return;
    }

    console.log("Preparando upload:", file.name, file.type, file.size);
    setIsUploading(true);
    setUploadProgress(10);
    
    // Reduce retry time so it doesn't hang forever if CORS fails
    storage.maxUploadRetryTime = 15000;
    
    try {
      // Ensure we have an auth session
      if (!auth.currentUser) {
        console.log("Nenhum usuário detectado, tentando login anônimo...");
        setUploadProgress(20);
        await signInAnonymously(auth);
        console.log("Login anônimo realizado com sucesso.");
      }

      setUploadProgress(40);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      // Usar o caminho correto conforme definido nas rules
      const storageRef = ref(storage, `artifacts/${appId}/mural_uploads/${fileName}`);
      
      console.log("Fazendo upload para:", storageRef.fullPath);
      
      const uploadPromise = uploadBytes(storageRef, file, {
        cacheControl: 'public,max-age=31536000',
        contentType: file.type || 'application/octet-stream'
      });

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 10 : prev));
      }, 500);

      try {
        const uploadResult = await uploadPromise;
        clearInterval(progressInterval);
        
        console.log("Upload bem sucedido!");
        setUploadProgress(95);
        
        const downloadUrl = await getDownloadURL(uploadResult.ref);
        setExternalLink(downloadUrl);
        
        if (file.type.startsWith('image/')) {
          setExternalLinkType('image');
        } else if (file.type === 'application/pdf' || file.type.toLowerCase().includes('word') || file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) {
          setExternalLinkType('document');
        } else {
          setExternalLinkType('link');
        }

        setUploadProgress(100);
        console.log("URL de download obtida:", downloadUrl);
        setTimeout(() => setIsUploading(false), 500);
      } catch (uploadErr) {
        clearInterval(progressInterval);
        throw uploadErr;
      }
    } catch (err: any) {
      console.error("Erro crítico no upload:", err);
      let msg = "Erro ao enviar arquivo.";
      
      if (err.code === "auth/operation-not-allowed") {
         msg = "Login anônimo não está habilitado no Firebase Authentication.";
      } else if (err.code === "storage/unauthorized") {
        msg = "Sem permissão no Firebase Storage. Verifique as regras de segurança.";
      } else if (err.code === "storage/retry-limit-exceeded" || err.message?.includes("CORS")) {
        msg = "Não foi possível conectar ao Storage (Tempo Limite/CORS).\n\nPara consertar isso, você precisa configurar o CORS no seu Firebase Storage, autorizando os dominíos da sua aplicação web.";
      }
      
      alert(`⚠️ FALHA NO UPLOAD:\n\n${msg}\n\nDetalhes Técnicos: ${err.code || 'erro_desconhecido'}\n${err.message}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async () => {
    if (!postText.trim() && !externalLink.trim()) return;
    if (postType === "poll" && pollOptions.filter(o => o.trim()).length < 2) return;

    setIsSubmitting(true);
    try {
      const formattedPollOptions = postType === "poll" 
        ? pollOptions.filter(o => o.trim()).map(text => ({ id: Math.random().toString(36).substr(2, 9), text, votes: 0 }))
        : [];

      const newPost = {
        tabFn: activeTab,
        authorId: isAdmin ? "admin" : myUserId,
        authorName: isAdmin ? "Administração" : (currentUserData?.name || "Estudante"),
        text: postText.trim(),
        type: postType,
        mediaUrl: externalLink.trim() ? (
          externalLinkType === 'image' && externalLink.includes('drive.google.com/file/d/')
            ? `https://drive.google.com/uc?export=view&id=${externalLink.split('/d/')[1]?.split('/')[0] || ''}`
          : externalLinkType === 'document' && externalLink.includes('drive.google.com/file/d/')
            ? `https://drive.google.com/file/d/${externalLink.split('/d/')[1]?.split('/')[0] || ''}/preview`
          : externalLinkType === 'video' && externalLink.includes('youtube.com/watch')
            ? `https://www.youtube.com/embed/${new URLSearchParams(new URL(externalLink).search).get('v')}`
          : externalLinkType === 'video' && externalLink.includes('youtu.be/')
            ? `https://www.youtube.com/embed/${externalLink.split('youtu.be/')[1]?.split('?')[0]}`
          : externalLink.trim()
        ) : null,
        mediaType: externalLink.trim() ? externalLinkType : null,
        pollOptions: formattedPollOptions,
        isAnonymousPoll: postType === "poll" ? isAnonymousPoll : undefined,
        votedUserIds: [],
        voterDetails: [],
        createdAt: serverTimestamp(),
        isPinned: false,
        status: isAdmin ? "approved" : "pending",
        isAdminPost: isAdmin
      };

      await addDoc(collection(db, `artifacts/${appId}/public/data/mural_posts`), newPost);
      
      setPostText("");
      setExternalLink("");
      setExternalLinkType("link");
      setPostType("message");
      setPollOptions(["", ""]);
      setIsAnonymousPoll(true);
      setIsComposing(false);

      if (!isAdmin) {
        alert("Sua publicação foi enviada para aprovação! Ela aparecerá no mural para os outros alunos assim que um administrador aprovar.");
      }
    } catch (err) {
      console.error("Erro ao enviar publicação:", err);
      if (err instanceof Error && err.message.includes('permission')) {
          alert('Você não tem permissões no seu Firebase, por favor veja o aviso REGRAS_FIREBASE_CORRECAO.md!\n\nErro: ' + err.message);
          setIsSubmitting(false);
          handleFirestoreError(err, OperationType.CREATE, `artifacts/${appId}/public/data/mural_posts`);
      } else {
          alert("Erro ao enviar publicação: " + (err instanceof Error ? err.message : String(err)));
          setIsSubmitting(false);
      }
    }
  };

  const handleVote = async (post: MuralPost, optionId: string) => {
    const voterId = currentUserData?.id || auth.currentUser?.uid;
    const voterName = currentUserData?.name || "Usuário";
    if (!voterId) return;
    
    if (post.votedUserIds?.includes(voterId)) {
      alert("Você já votou nesta enquete.");
      return;
    }

    const updatedOptions = post.pollOptions?.map(opt => 
      opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
    );

    const newVoterDetail = { userId: voterId, userName: voterName, optionId };

    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/mural_posts`, post.id), {
        pollOptions: updatedOptions,
        votedUserIds: [...(post.votedUserIds || []), voterId],
        voterDetails: [...(post.voterDetails || []), newVoterDetail]
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `artifacts/${appId}/public/data/mural_posts`);
    }
  };

  const approvePost = async (id: string) => {
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/mural_posts`, id), { status: "approved" });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `artifacts/${appId}/public/data/mural_posts`);
    }
  };

  const togglePin = async (post: MuralPost) => {
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/mural_posts`, post.id), { isPinned: !post.isPinned });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `artifacts/${appId}/public/data/mural_posts`);
    }
  };

  const deletePost = async (id: string) => {
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/mural_posts`, id));
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `artifacts/${appId}/public/data/mural_posts`);
    }
  };

  // Identify visible posts
  const visiblePosts = posts.filter(post => isAdmin || post.status === "approved" || post.authorId === myUserId);
  const totalVotes = (post: MuralPost) => post.pollOptions?.reduce((acc, opt) => acc + opt.votes, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-10">
           <MessageSquare className="w-32 h-32 text-indigo-400" />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center justify-center gap-2 relative z-10">
          Mural de Recados
        </h2>
        <p className="text-xs text-slate-400 mt-2 relative z-10">
          Avisos, enquetes e comunicados importantes para a comunidade.
        </p>
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab("academico")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 lg:py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === "academico"
              ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Acadêmico
        </button>
        <button
          onClick={() => setActiveTab("seminario")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 lg:py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === "seminario"
              ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Landmark className="w-4 h-4" />
          Seminário
        </button>
      </div>

      {!isComposing && (
        <button onClick={() => setIsComposing(true)} className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2">
           <MessageSquare className="w-4 h-4" /> Nova Publicação
        </button>
      )}

      <AnimatePresence>
        {isComposing && (
          <motion.div
             initial={{ opacity: 0, height: 0 }}
             animate={{ opacity: 1, height: "auto" }}
             exit={{ opacity: 0, height: 0 }}
             className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"
          >
             <div className="flex gap-2 border-b border-slate-100 dark:border-slate-700 pb-4">
                <button onClick={() => setPostType("message")} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${postType === 'message' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500'}`}><MessageSquare className="w-3 h-3 inline-block mr-1"/> Mensagem</button>
                <button onClick={() => setPostType("poll")} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${postType === 'poll' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500'}`}><BarChart2 className="w-3 h-3 inline-block mr-1"/> Enquete</button>
             </div>
             
             <textarea 
                placeholder="Escreva sua publicação..."
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm min-h-[100px] border-none outline-none resize-y ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500"
                value={postText}
                onChange={e => setPostText(e.target.value)}
             />

             {postType === "message" && (
                <div className="flex flex-col gap-2">
                   {isAdmin ? (
                     <>
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-bold uppercase text-slate-500 text-left">Anexo ou Link Externo</p>
                          <div className="relative">
                             <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className={`h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${isUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed overflow-hidden' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:scale-95'}`}
                             >
                                {isUploading ? (
                                   <>
                                      <motion.div 
                                         className="absolute inset-y-0 left-0 bg-indigo-600/10"
                                         initial={{ width: 0 }}
                                         animate={{ width: `${uploadProgress}%` }}
                                      />
                                      <span className="relative z-10 flex items-center gap-1.5">
                                         <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                         {Math.round(uploadProgress)}%
                                      </span>
                                   </>
                                ) : (
                                   <>
                                      <ImageIcon className="w-3.5 h-3.5" /> Fazer Upload
                                   </>
                                )}
                             </button>
                          </div>
                          <input 
                             type="file" 
                             ref={fileInputRef} 
                             className="hidden" 
                             onChange={handleFileUpload}
                             accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select 
                             value={externalLinkType}
                             onChange={e => setExternalLinkType(e.target.value as any)}
                             className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border-none outline-none ring-1 ring-slate-200 dark:ring-slate-700 w-full sm:w-48"
                          >
                             <option value="link">Link Comum</option>
                             <option value="image">Exibir como Imagem</option>
                             <option value="video">Embutir Vídeo</option>
                             <option value="document">Exibir Documento (PDF/Docs)</option>
                          </select>
                          <input 
                             type="url" 
                             placeholder="https://..."
                             value={externalLink}
                             onChange={e => setExternalLink(e.target.value)}
                             className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border-none outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                     </>
                   ) : (
                     <div>
                        <p className="text-xs font-bold uppercase text-slate-500 text-left mb-1">Link Externo (Opcional)</p>
                        <input 
                           type="url" 
                           placeholder="https://..."
                           value={externalLink}
                           onChange={e => {
                             setExternalLink(e.target.value);
                             setExternalLinkType("link"); // Forçar link comum para não administradores
                           }}
                           className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border-none outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500"
                        />
                     </div>
                   )}
                </div>
             )}

             {postType === "poll" && (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                   <div className="flex justify-between items-center mb-2">
                     <p className="text-xs font-bold uppercase text-slate-500">Opções da Enquete</p>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={isAnonymousPoll} onChange={e => setIsAnonymousPoll(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 outline-none border-slate-300" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Voto Anônimo</span>
                     </label>
                   </div>
                   {pollOptions.map((opt, i) => (
                     <div key={i} className="flex gap-2">
                        <input value={opt} onChange={e => updatePollOption(i, e.target.value)} placeholder={`Opção ${i + 1}`} className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        {pollOptions.length > 2 && <button onClick={() => handleRemovePollOption(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>}
                     </div>
                   ))}
                   {pollOptions.length < 5 && (
                     <button onClick={handleAddPollOption} className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-2 hover:underline">+ Nova Opção</button>
                   )}
                </div>
             )}

             <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button onClick={() => setIsComposing(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                <button disabled={isSubmitting} onClick={handleSubmit} className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50">
                  {isSubmitting ? "Enviando..." : "Publicar"}
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
         {visiblePosts.length === 0 ? (
           <div className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-8">
             <div className="text-center space-y-4 max-w-sm">
               <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                 {activeTab === "academico" ? <GraduationCap className="w-8 h-8" /> : <Landmark className="w-8 h-8" />}
               </div>
               <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                 Nenhuma publicação
               </h3>
             </div>
           </div>
         ) : (
           visiblePosts.map(post => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={post.id} 
              className={`p-5 rounded-3xl border transition-all duration-300 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 ${post.isPinned ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/50 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} relative`}
            >
                {post.isPinned && (
                  <div className="absolute top-0 right-8 -translate-y-1/2 bg-indigo-600 text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <Pin className="w-3 h-3" /> <span className="text-[10px] font-black uppercase tracking-widest">Fixado</span>
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner ${post.isAdminPost ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                         {post.isAdminPost ? <CheckCircle className="w-5 h-5"/> : <GraduationCap className="w-5 h-5"/>}
                      </div>
                      <div>
                         <p className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">{post.authorName} {post.isAdminPost && <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Admin</span>}</p>
                         <p className="text-[10px] text-slate-500 font-medium">
                            {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleString('pt-BR') : 'Aguarde...'}
                         </p>
                      </div>
                   </div>
                   
                   {/* Status Badge & Admn Controls */}
                   <div className="flex items-center gap-2">
                     {post.status === "pending" && (
                       <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] rounded-lg font-bold uppercase">Pendente</span>
                     )}
                     {(isAdmin || post.authorId === myUserId) && (
                       <div className="flex items-center gap-1">
                          {isAdmin && post.status === "pending" && (
                            <button onClick={() => approvePost(post.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md" title="Aprovar">
                              <Check className="w-4 h-4"/>
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => togglePin(post)} className={`p-1.5 rounded-md ${post.isPinned ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:bg-slate-100'}`} title={post.isPinned ? "Desafixar" : "Fixar no topo"}>
                               <Pin className="w-4 h-4"/>
                            </button>
                          )}
                           <button onClick={() => setDeleteConfirmId(post.id)} className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-md" title="Apagar Publicação">
                             <Trash2 className="w-4 h-4"/>
                          </button>
                       </div>
                     )}
                   </div>
                </div>

                <div className="mt-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                   {post.text}
                </div>

                {post.mediaUrl && (
                   <div className="mt-4">
                     {(post.mediaType === 'image' || post.mediaUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || post.mediaUrl.includes('drive.google.com/uc?export=view')) ? (
                        <div className="rounded-xl overflow-hidden cursor-pointer bg-slate-100 dark:bg-slate-900 flex justify-center" onClick={() => window.open(post.mediaUrl, '_blank')}>
                          <img 
                             src={post.mediaUrl} 
                             alt="Visualização" 
                             className="max-w-full max-h-96 object-contain hover:opacity-95 transition-opacity" 
                             referrerPolicy="no-referrer"
                          />
                        </div>
                     ) : (post.mediaType === 'video' || post.mediaType === 'document' || post.mediaUrl.includes('youtube.com/embed') || post.mediaUrl.includes('youtu.be/') || post.mediaUrl.includes('/preview') || post.mediaUrl.includes('.docx') || post.mediaUrl.includes('.doc')) ? (
                        <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                          <iframe 
                             src={post.mediaUrl.includes('firebasestorage') && (post.mediaUrl.toLowerCase().includes('.docx') || post.mediaUrl.toLowerCase().includes('.doc')) 
                               ? `https://docs.google.com/viewer?url=${encodeURIComponent(post.mediaUrl)}&embedded=true` 
                               : post.mediaUrl} 
                             className="w-full aspect-video border-0" 
                             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                             allowFullScreen>
                          </iframe>
                        </div>
                     ) : post.mediaType === 'pdf' ? (
                        <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-indigo-600 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                           <FileText className="w-5 h-5"/> Abrir Anexo PDF <ExternalLink className="w-3 h-3"/>
                        </a>
                     ) : (
                        <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-indigo-600 text-sm font-bold truncate max-w-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                           <ExternalLink className="w-5 h-5 flex-shrink-0"/> <span className="truncate">{post.mediaUrl}</span>
                        </a>
                     )}
                  </div>
                )}

                {post.type === "poll" && post.pollOptions && (
                  <div className="mt-5 space-y-2">
                     {post.pollOptions.map((opt) => {
                       const vTotal = totalVotes(post);
                       const percentage = vTotal > 0 ? Math.round((opt.votes / vTotal) * 100) : 0;
                       
                       return (
                         <button 
                           key={opt.id} 
                           onClick={() => handleVote(post, opt.id)}
                           className="w-full relative group overflow-hidden bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-left hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                         >
                            <div className="absolute top-0 left-0 bottom-0 bg-indigo-100 dark:bg-indigo-900/30 transition-all duration-500 ease-out" style={{ width: `${percentage}%` }} />
                            <div className="relative z-10 flex justify-between items-center text-sm font-medium">
                               <span className="text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">{opt.text}</span>
                               <span className="text-xs font-bold text-slate-500">{percentage}% ({opt.votes})</span>
                            </div>
                         </button>
                       )
                     })}
                     
                     <div className="flex justify-between items-end mt-2">
                        {post.isAnonymousPoll === false ? (
                           <div className="flex-1">
                              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Quem votou:</p>
                              <div className="flex flex-wrap gap-1">
                                {(post.voterDetails || []).map((vote, idx) => {
                                   const optText = post.pollOptions?.find(o => o.id === vote.optionId)?.text || "Opção";
                                   return (
                                     <span key={idx} className="text-[9px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md text-slate-500" title={optText}>
                                        {vote.userName}
                                     </span>
                                   );
                                })}
                                {(!post.voterDetails || post.voterDetails.length === 0) && <span className="text-[9px] text-slate-400">Nenhum voto ainda.</span>}
                              </div>
                           </div>
                        ) : (
                           <div className="flex-1">
                             <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-2">Enquete Anônima</p>
                           </div>
                        )}
                        <p className="text-[10px] uppercase font-bold text-slate-400 text-right shrink-0">{totalVotes(post)} votos no total</p>
                     </div>
                  </div>
                )}
              </motion.div>
            ))
          )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700 text-center"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 mx-auto rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">Excluir Publicação?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Esta ação não poderá ser desfeita. O recado será removido permanentemente do mural.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => deletePost(deleteConfirmId)}
                  className="py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

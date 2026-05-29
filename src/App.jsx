import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Edit3, Trash2, ExternalLink, Image as ImageIcon, 
  PlayCircle, Clock, CheckCircle2, PauseCircle, XCircle, 
  Tv, Star, X, Loader2, ChevronRight, BarChart3, Trophy, 
  Target, Flame, Medal, Download, Compass,
  LayoutGrid, List, Calendar, Upload, Share2, Users, ArrowUpRight,
  Sparkles, Check, Info, AlertTriangle, BookOpen, MessageSquare, Heart,
  Gamepad2, Dices, Award, Zap, Menu
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, getDoc } from 'firebase/firestore';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCY5gkT7HWQPV3jV3wn1-iBeef1v7FOkPE",
  authDomain: "mi-anime-tracker.firebaseapp.com",
  projectId: "mi-anime-tracker",
  storageBucket: "mi-anime-tracker.firebasestorage.app",
  messagingSenderId: "281744457691",
  appId: "1:281744457691:web:d1eaaf8c679fb60d82f1fe"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const STATUS_CONFIG = {
  'Viendo': { icon: PlayCircle, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  'Pendiente': { icon: Clock, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
  'Terminado': { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
  'Pausado': { icon: PauseCircle, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
  'Abandonado': { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' }
};

// Generador de audio limpio retro en tiempo real
const playSound = (type) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'tick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'success') {
      const now = audioCtx.currentTime;
      osc.type = 'triangle';
      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      const notes = [261.63, 329.63, 392.00, 523.25];
      notes.forEach((freq, idx) => {
        osc.frequency.setValueAtTime(freq, now + (idx * 0.08));
      });
      osc.start();
      osc.stop(now + 0.4);
    } else if (type === 'quest_complete') {
      const now = audioCtx.currentTime;
      osc.type = 'sine';
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      osc.start();
      osc.stop(now + 0.3);
    }
  } catch (e) {
    console.warn("Audio desactivado temporalmente.");
  }
};

export default function App() {
  const [animes, setAnimes] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState('list'); 
  const [listLayout, setListLayout] = useState('grid'); 
  
  const [user, setUser] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '', status: 'Viendo', progress: 0, totalEpisodes: 0, watchUrl: '', coverUrl: '', rating: 0, duration: 24, genres: [], malId: '', notes: ''
  });
  
  const [apiSearchQuery, setApiSearchQuery] = useState('');
  const [apiResults, setApiResults] = useState([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ESTADOS DEL NUEVO NAVEGADOR
  const [catalogAnimes, setCatalogAnimes] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [browseData, setBrowseData] = useState({ trending: [], upcoming: [], popular: [] });

  const [calendarAnimes, setCalendarAnimes] = useState([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 }); 
  const fileInputRef = useRef(null);

  const [toasts, setToasts] = useState([]); 
  const [selectedDetails, setSelectedDetails] = useState(null); 
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsExtraInfo, setDetailsExtraInfo] = useState(null);
  
  const [isPublic, setIsPublic] = useState(false);
  const [sharedProfiles, setSharedProfiles] = useState([]);
  const [isCommunityLoading, setIsCommunityLoading] = useState(false);
  const [viewingSharedList, setViewingSharedList] = useState(null); 

  const [celebrationAnime, setCelebrationAnime] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const [quests, setQuests] = useState([
    { id: 'maraton', text: 'Maratón Diario: Avanza +1 episodio en tu lista', points: 50, done: false },
    { id: 'ruleta', text: 'El Oráculo: Haz girar la Ruleta del Destino hoy', points: 50, done: false },
    { id: 'explorar', text: 'Explorador: Busca un anime en el Catálogo Global', points: 50, done: false }
  ]);
  const [claimedQuests, setClaimedQuests] = useState([]); 
  const [bonusXp, setBonusXp] = useState(0); 

  const [rouletteMode, setRouletteMode] = useState('pendiente'); 
  const [rouletteList, setRouletteList] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinOffset, setSpinOffset] = useState(0);
  const [winnerAnime, setWinnerAnime] = useState(null);
  const carouselRef = useRef(null);

  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    try {
      const storedDate = localStorage.getItem('otaku_quest_date');
      const todayStr = new Date().toDateString();
      
      if (storedDate !== todayStr) {
        localStorage.setItem('otaku_quest_date', todayStr);
        localStorage.setItem('otaku_quests', JSON.stringify([
          { id: 'maraton', text: 'Maratón Diario: Avanza +1 episodio en tu lista', points: 50, done: false },
          { id: 'ruleta', text: 'El Oráculo: Haz girar la Ruleta del Destino hoy', points: 50, done: false },
          { id: 'explorar', text: 'Explorador: Busca un anime en el Catálogo Global', points: 50, done: false }
        ]));
        localStorage.setItem('otaku_claimed_quests', JSON.stringify([]));
        localStorage.setItem('otaku_bonus_xp', '0');
      } else {
        const savedQuests = localStorage.getItem('otaku_quests');
        const savedClaimed = localStorage.getItem('otaku_claimed_quests');
        const savedBonusXp = localStorage.getItem('otaku_bonus_xp');
        
        if (savedQuests) setQuests(JSON.parse(savedQuests));
        if (savedClaimed) setClaimedQuests(JSON.parse(savedClaimed));
        if (savedBonusXp) setBonusXp(parseInt(savedBonusXp, 10) || 0);
      }
    } catch (e) {
      console.warn("LocalStorage no disponible");
    }
  }, []);

  const triggerQuestComplete = (questId) => {
    setQuests(prev => {
      const updated = prev.map(q => q.id === questId ? { ...q, done: true } : q);
      try { localStorage.setItem('otaku_quests', JSON.stringify(updated)); } catch(e){}
      return updated;
    });
  };

  const claimQuestXp = (questId, xpPoints) => {
    if (claimedQuests.includes(questId)) return;
    const nextClaimed = [...claimedQuests, questId];
    setClaimedQuests(nextClaimed);
    try { localStorage.setItem('otaku_claimed_quests', JSON.stringify(nextClaimed)); } catch(e){}
    
    const nextBonusXp = bonusXp + xpPoints;
    setBonusXp(nextBonusXp);
    try { localStorage.setItem('otaku_bonus_xp', String(nextBonusXp)); } catch(e){}
    
    playSound('quest_complete');
    showToast(`¡Reclamaste +${xpPoints} XP del Gremio!`, 'success');
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showToast("¡Sesión iniciada con Google con éxito!", "success");
    } catch (error) {
      setErrorMsg("No se pudo iniciar sesión con Google.");
      showToast("Error de autenticación con Google", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast("Sesión cerrada", "info");
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    } catch (error) {}
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {}
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) { setLoadingData(false); return; }
    const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
    const unsubscribe = onSnapshot(animesRef, (snapshot) => {
      const fetchedAnimes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedAnimes.sort((a, b) => b.id.localeCompare(a.id));
      setAnimes(fetchedAnimes);
      setLoadingData(false);
    }, () => {
      showToast("Error de conexión a la base de datos.", "error");
      setLoadingData(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const privacyRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'privacy');
    getDoc(privacyRef).then((snap) => {
      if (snap.exists()) setIsPublic(snap.data().isPublic || false);
    }).catch(()=>{});
  }, [user]);

  const handleTogglePrivacy = async (checked) => {
    if (!user || user.isAnonymous) {
      showToast("Inicia sesión con Google para usar funciones sociales.", "warning");
      return;
    }
    setIsPublic(checked);
    try {
      const privacyRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'privacy');
      await setDoc(privacyRef, { isPublic: checked });

      const sharedRef = doc(db, 'artifacts', appId, 'public', 'data', 'shared_lists', user.uid);
      if (checked) {
        await setDoc(sharedRef, {
          username: user.displayName || 'Otaku Legendario',
          photoURL: user.photoURL || '',
          animes: animes,
          updatedAt: Date.now()
        });
        showToast("¡Tu lista de anime ahora es pública en la Comunidad!", "success");
      } else {
        await deleteDoc(sharedRef);
        showToast("Tu perfil ahora es privado.", "info");
      }
    } catch (e) {
      showToast("Error al configurar la privacidad.", "error");
    }
  };

  useEffect(() => {
    if (user && isPublic && animes.length > 0) {
      const updateShared = async () => {
        try {
          const sharedRef = doc(db, 'artifacts', appId, 'public', 'data', 'shared_lists', user.uid);
          await setDoc(sharedRef, {
            username: user.displayName || 'Otaku Legendario',
            photoURL: user.photoURL || '',
            animes: animes,
            updatedAt: Date.now()
          });
        } catch(e){}
      };
      updateShared();
    }
  }, [animes, isPublic, user]);

  useEffect(() => {
    if (currentView !== 'community' || !user) return;
    setIsCommunityLoading(true);
    const sharedCollection = collection(db, 'artifacts', appId, 'public', 'data', 'shared_lists');
    const unsubscribe = onSnapshot(sharedCollection, (snapshot) => {
      const lists = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      lists.sort((a, b) => b.updatedAt - a.updatedAt);
      setSharedProfiles(lists);
      setIsCommunityLoading(false);
    }, () => setIsCommunityLoading(false));
    return () => unsubscribe();
  }, [currentView, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (apiSearchQuery.trim().length > 2) {
        setIsSearchingApi(true);
        fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(apiSearchQuery)}&limit=5`)
          .then(res => res.json())
          .then(data => { setApiResults(data.data || []); setIsSearchingApi(false); })
          .catch(() => setIsSearchingApi(false));
      } else {
        setApiResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [apiSearchQuery]);

  const selectApiResult = (anime) => {
    let parsedDuration = 24;
    if (anime.duration) {
      const match = anime.duration.match(/(\d+)\s*min/);
      if (match) parsedDuration = parseInt(match[1], 10);
    }
    setFormData({
      ...formData,
      title: anime.title,
      totalEpisodes: anime.episodes || 0,
      coverUrl: anime.images?.jpg?.large_image_url || '',
      genres: anime.genres ? anime.genres.map(g => g.name) : [],
      duration: parsedDuration,
      malId: anime.mal_id ? String(anime.mal_id) : ''
    });
    setApiResults([]);
    setApiSearchQuery('');
  };

  // --- LÓGICA ACTUALIZADA DEL NAVEGADOR (CATÁLOGO TIPO ANILIST) ---
  useEffect(() => {
    if (currentView !== 'catalog') return;
    let isActive = true;
    
    const fetchBrowseData = async () => {
      if (catalogSearch.trim().length > 2) {
        // Modo Búsqueda
        setIsCatalogLoading(true);
        try {
          const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(catalogSearch)}&limit=24`;
          triggerQuestComplete('explorar'); 
          const res = await fetch(url);
          const data = await res.json();
          if (isActive) setCatalogAnimes(data.data || []);
        } catch (error) {
          console.error("Error fetching catalog search");
        } finally {
          if (isActive) setIsCatalogLoading(false);
        }
      } else {
        // Modo Navegador AniList (Si aún no se han cargado)
        if (browseData.trending.length === 0) {
          setIsCatalogLoading(true);
          try {
            triggerQuestComplete('explorar');
            // Fetch 1: Tendencias (En emisión)
            const res1 = await fetch('https://api.jikan.moe/v4/seasons/now?limit=12');
            const data1 = await res1.json();
            await new Promise(r => setTimeout(r, 450)); 

            // Fetch 2: Próximos
            const res2 = await fetch('https://api.jikan.moe/v4/seasons/upcoming?limit=12');
            const data2 = await res2.json();
            await new Promise(r => setTimeout(r, 450));

            // Fetch 3: Populares de todos los tiempos
            const res3 = await fetch('https://api.jikan.moe/v4/top/anime?bypopularity=true&limit=12');
            const data3 = await res3.json();

            if (isActive) {
              setBrowseData({
                trending: data1.data || [],
                upcoming: data2.data || [],
                popular: data3.data || []
              });
            }
          } catch (error) {
            console.error("Error fetching browse data");
          } finally {
            if (isActive) setIsCatalogLoading(false);
          }
        }
      }
    };

    const timer = setTimeout(() => { fetchBrowseData(); }, 500);
    return () => { isActive = false; clearTimeout(timer); };
  }, [currentView, catalogSearch]);

  const handleAddFromCatalog = (anime) => {
    let parsedDuration = 24;
    if (anime.duration) {
      const match = anime.duration.match(/(\d+)\s*min/);
      if (match) parsedDuration = parseInt(match[1], 10);
    }
    setFormData({
      title: anime.title,
      status: 'Pendiente', 
      progress: 0,
      totalEpisodes: anime.episodes || 0,
      watchUrl: '',
      coverUrl: anime.images?.jpg?.large_image_url || '',
      rating: 0,
      duration: parsedDuration,
      genres: anime.genres ? anime.genres.map(g => g.name) : [],
      malId: anime.mal_id ? String(anime.mal_id) : '',
      notes: ''
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  // Helper para renderizar los carruseles del nuevo navegador
  const renderBrowseCarousel = (title, animeList) => {
    if (!animeList || animeList.length === 0) return null;
    return (
      <div className="mb-12">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">{title}</h3>
        </div>
        <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-4">
          {animeList.map(anime => (
            <div key={anime.mal_id} onClick={() => handleOpenDetails(anime)} className="w-36 sm:w-44 shrink-0 group relative bg-[#1e293b] rounded-2xl overflow-hidden border border-slate-700/50 hover:border-pink-500/50 transition-all duration-300 flex flex-col hover:shadow-xl hover:shadow-pink-500/10 cursor-pointer">
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-800">
                <img src={anime.images?.jpg?.large_image_url || 'https://via.placeholder.com/400x600'} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/10 to-transparent opacity-90" />
                <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-slate-900/90 backdrop-blur-md px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg flex items-center gap-1 border border-slate-700">
                  <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-[10px] sm:text-xs font-bold text-white">{anime.score || 'N/A'}</span>
                </div>
                <div className="absolute bottom-0 left-0 w-full p-2 sm:p-3">
                  <h3 className="text-xs sm:text-base font-bold text-white line-clamp-2 leading-tight mb-0.5 sm:mb-1 drop-shadow-md">{anime.title}</h3>
                  <div className="text-[9px] sm:text-xs text-slate-300 font-medium">{anime.year || anime.status}</div>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-slate-800 flex-1 flex flex-col justify-end border-t border-slate-700/50">
                <button onClick={(e) => { e.stopPropagation(); handleAddFromCatalog(anime); }} className="w-full flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-700 hover:bg-pink-600 text-white py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold transition-colors">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" /><span className="hidden sm:inline">Añadir a mi lista</span><span className="sm:hidden">Añadir</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (currentView !== 'calendar') return;
    let isActive = true;
    const fetchViendoSchedules = async () => {
      setIsCalendarLoading(true);
      const viendoAnimes = animes.filter(a => a && a.status === 'Viendo');
      const schedules = [];
      
      for (const anime of viendoAnimes) {
        if (!isActive) break;
        try {
          const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(anime.title)}&status=airing&limit=1`);
          const data = await res.json();
          if (data.data && data.data.length > 0 && data.data[0].broadcast?.day) {
             schedules.push({ ...anime, broadcast: data.data[0].broadcast, apiEpisodes: data.data[0].episodes });
          }
          await new Promise(r => setTimeout(r, 450)); 
        } catch (e) {}
      }
      if (isActive) {
        setCalendarAnimes(schedules);
        setIsCalendarLoading(false);
      }
    };
    fetchViendoSchedules();
    return () => { isActive = false; };
  }, [currentView, animes]);

  const handleOpenDetails = async (anime) => {
    if (!anime) return;
    setSelectedDetails(anime);
    setDetailsExtraInfo(null);
    setIsDetailsLoading(true);
    const targetMalId = anime.malId || anime.mal_id;
    try {
      if (targetMalId) {
        const res = await fetch(`https://api.jikan.moe/v4/anime/${targetMalId}`);
        if (res.ok) {
          const data = await res.json();
          setDetailsExtraInfo(data.data);
        }
      } else {
        const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(anime.title)}&limit=1`);
        if (res.ok) {
          const data = await res.json();
          if (data.data && data.data.length > 0) setDetailsExtraInfo(data.data[0]);
        }
      }
    } catch (e) {} finally {
      setIsDetailsLoading(false);
    }
  };

  const handleQuickProgress = async (e, anime, increment) => {
    e.stopPropagation(); 
    if (!user) return showToast("Acceso denegado. No autenticado.", "error");
    
    const targetEpisodes = anime.totalEpisodes || 0;
    const currentProgress = anime.progress || 0;
    const nextProgress = Math.max(0, currentProgress + increment);

    if (targetEpisodes > 0 && nextProgress > targetEpisodes) {
      return showToast(`¡Ya estás en el límite de episodios (${targetEpisodes})!`, "warning");
    }

    let nextStatus = anime.status;
    if (targetEpisodes > 0 && nextProgress === targetEpisodes) {
      nextStatus = 'Terminado';
      setCelebrationAnime(anime);
    } else if (currentProgress === 0 && nextProgress > 0 && anime.status === 'Pendiente') {
      nextStatus = 'Viendo';
    }

    const updatedAnime = { ...anime, progress: nextProgress, status: nextStatus };
    try {
      const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
      await setDoc(doc(animesRef, anime.id), updatedAnime);
      showToast(`Progreso actualizado a ${nextProgress} EPS`, "success");
      if (increment > 0) triggerQuestComplete('maraton');
    } catch (error) {
      showToast("Error al actualizar progreso.", "error");
    }
  };

  const safeFormatDate = (timestamp) => {
    if (!timestamp) return 'Fecha desconocida';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Fecha desconocida';
      return date.toLocaleDateString();
    } catch (e) {
      return 'Fecha desconocida';
    }
  };

  const stats = useMemo(() => {
    let totalEps = 0, totalMinutes = 0, completedCount = 0, genreCounts = {};
    animes.forEach(a => {
      if (!a) return;
      const eps = a.progress || 0;
      totalEps += eps;
      totalMinutes += eps * (a.duration || 24);
      if (a.status === 'Terminado') completedCount++;
      if (a.genres && eps > 0) {
        a.genres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
      }
    });

    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5); 
    const maxGenreCount = sortedGenres.length > 0 ? sortedGenres[0][1] : 1;

    const achievements = [
      { id: 1, title: 'Otaku Novato', desc: 'Añade tu primer anime', unlocked: animes.length >= 1, icon: Star },
      { id: 2, title: 'Maratonista', desc: 'Mira 100 episodios en total', unlocked: totalEps >= 100, icon: Flame },
      { id: 3, title: 'Coleccionista', desc: 'Ten 10 animes en tu lista', unlocked: animes.length >= 10, icon: Target },
      { id: 4, title: 'Completista', desc: 'Termina 5 animes', unlocked: completedCount >= 5, icon: CheckCircle2 },
      { id: 5, title: 'Amante del Shounen', desc: 'Mira un anime Shounen', unlocked: Object.keys(genreCounts).includes('Shounen'), icon: Trophy },
      { id: 6, title: 'Hikikomori', desc: 'Acumula 5 días de visualización', unlocked: days >= 5, icon: Medal },
    ];

    const unlockedAchievementsCount = achievements.filter(a => a.unlocked).length;
    const baseProgressXp = (totalEps * 15) + (completedCount * 150) + (unlockedAchievementsCount * 200);
    const totalXp = baseProgressXp + bonusXp;

    const computedLevel = Math.floor(Math.sqrt(totalXp) / 8) + 1;
    const xpForCurrentLevel = Math.pow((computedLevel - 1) * 8, 2);
    const xpForNextLevel = Math.pow(computedLevel * 8, 2);
    const progressInCurrentLevel = totalXp - xpForCurrentLevel;
    const levelRange = xpForNextLevel - xpForCurrentLevel;
    const levelProgressPercent = Math.min(100, Math.round((progressInCurrentLevel / levelRange) * 100)) || 0;

    let rankTitle = 'Estudiante de la Academia';
    if (computedLevel >= 40) rankTitle = 'Monarca de las Sombras';
    else if (computedLevel >= 30) rankTitle = 'Sannin Legendario';
    else if (computedLevel >= 20) rankTitle = 'Rey de los Piratas';
    else if (computedLevel >= 15) rankTitle = 'Pilar de la Niebla (Hashira)';
    else if (computedLevel >= 10) rankTitle = 'Cazador de Rango S';
    else if (computedLevel >= 5) rankTitle = 'Genin Elite';

    return { 
      totalEps, days, hours, topGenres: sortedGenres, maxGenreCount, achievements, completedCount,
      totalXp, level: computedLevel, levelProgressPercent, xpForNextLevel, progressInCurrentLevel, levelRange, rankTitle
    };
  }, [animes, bonusXp]);

  const filteredAnimes = animes.filter(anime => {
    if (!anime) return false;
    const matchesSearch = (anime.title || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    const matchesFilter = activeFilter === 'Todos' || anime.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const animesToRender = viewingSharedList ? (viewingSharedList.animes || []) : filteredAnimes;

  const handleOpenModal = (anime = null) => {
    setErrorMsg('');
    setApiResults([]);
    setApiSearchQuery('');
    if (anime) {
      setFormData({
        title: anime.title || '', status: anime.status || 'Viendo', progress: anime.progress || 0,
        totalEpisodes: anime.totalEpisodes || 12, watchUrl: anime.watchUrl || '', coverUrl: anime.coverUrl || '',
        rating: anime.rating || 0, duration: anime.duration || 24, genres: anime.genres || [],
        malId: anime.malId || '', notes: anime.notes || ''
      });
      setEditingId(anime.id);
    } else {
      setFormData({ title: '', status: 'Viendo', progress: 0, totalEpisodes: 0, watchUrl: '', coverUrl: '', rating: 0, duration: 24, genres: [], malId: '', notes: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => { setIsModalOpen(false); setEditingId(null); };

  const handleSave = async () => {
    if (!formData.title.trim()) return setErrorMsg('El título es obligatorio.');
    if (!user) return setErrorMsg('No estás conectado. Recarga la página.');
    try {
      const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
      await setDoc(doc(animesRef, editingId || Date.now().toString()), formData);
      showToast(editingId ? "¡Anime actualizado!" : "¡Añadido a tu lista con éxito!", "success");
      handleCloseModal();
    } catch (error) { setErrorMsg('Error al guardar en la nube.'); }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try { 
      const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
      await deleteDoc(doc(animesRef, id)); 
      showToast("Anime eliminado de tu lista", "info");
    } catch (error) {}
  };

  const handleShareLink = (friendId) => {
    const profileLink = `${window.location.origin}/?friend=${friendId}`;
    const textArea = document.createElement("textarea");
    textArea.value = profileLink;
    textArea.style.position = "absolute";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast("¡Enlace de perfil copiado al portapapeles!", "success");
    } catch (err) {
      showToast("No se pudo copiar el enlace. Cópialo manualmente.", "warning");
    }
    document.body.removeChild(textArea);
  };

  const handleCloneAnime = async (anime) => {
    if (!user) return showToast("Debes iniciar sesión para clonar animes.", "warning");
    try {
      const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
      const cloneData = {
        title: anime.title, status: 'Pendiente', progress: 0, totalEpisodes: anime.totalEpisodes || 0,
        watchUrl: anime.watchUrl || '', coverUrl: anime.coverUrl || '', rating: 0, duration: anime.duration || 24,
        genres: anime.genres || [], malId: anime.malId || ''
      };
      await setDoc(doc(animesRef, Date.now().toString() + Math.random().toString(36).substring(2, 5)), cloneData);
      showToast(`¡Clonado "${anime.title}" a tu lista como Pendiente!`, "success");
    } catch (e) {
      showToast("Error al copiar anime.", "error");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    setImportProgress({ current: 0, total: 0 });
    try {
      const text = await file.text();
      if (!file.name.toLowerCase().endsWith('.xml')) {
         showToast("El archivo debe ser un .xml estándar.", "error");
         setIsImporting(false); return;
      }
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      const animeNodes = xmlDoc.getElementsByTagName("anime");
      const animesToProcess = [];
      for (let i = 0; i < animeNodes.length; i++) {
        const node = animeNodes[i];
        const getVal = (tag) => {
          let val = node.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
          return val.replace(/^<!\[CDATA\[(.*)\]\]>$/, '$1'); 
        };
        const malId = getVal("series_animedb_id");
        const title = getVal("series_title") || 'Desconocido';
        const progress = parseInt(getVal("my_watched_episodes")) || 0;
        const totalEpisodes = parseInt(getVal("series_episodes")) || 0;
        const rawStatus = getVal("my_status").toLowerCase();
        let status = 'Pendiente';
        if (['1', 'watching', 'current'].includes(rawStatus)) status = 'Viendo';
        else if (['2', 'completed'].includes(rawStatus)) status = 'Terminado';
        else if (['3', 'on-hold', 'paused'].includes(rawStatus)) status = 'Pausado';
        else if (['4', 'dropped'].includes(rawStatus)) status = 'Abandonado';
        else if (['6', 'plan to watch', 'planning'].includes(rawStatus)) status = 'Pendiente';
        let rating = parseFloat(getVal("my_score")) || 0;
        if (rating > 10) rating = Math.round(rating / 10);
        let coverUrl = getVal("series_image") || getVal("anime_image_path") || '';
        animesToProcess.push({ malId, title, progress, totalEpisodes, status, rating, coverUrl, duration: 24, watchUrl: '', genres: [] });
      }
      if (animesToProcess.length === 0) {
         showToast("No se encontraron animes compatibles.", "error");
         setIsImporting(false); return;
      }
      setImportProgress({ current: 0, total: animesToProcess.length });
      const finalAnimes = [];
      for (let i = 0; i < animesToProcess.length; i++) {
         const anime = animesToProcess[i];
         setImportProgress({ current: i + 1, total: animesToProcess.length });
         if (!anime.coverUrl && anime.malId) {
           try {
              const res = await fetch(`https://api.jikan.moe/v4/anime/${anime.malId}`);
              if (res.ok) {
                 const data = await res.json();
                 anime.coverUrl = data.data?.images?.jpg?.large_image_url || '';
                 anime.genres = data.data?.genres ? data.data.genres.map(g => g.name) : [];
                 if (data.data?.duration) {
                   const match = data.data.duration.match(/(\d+)\s*min/);
                   if (match) anime.duration = parseInt(match[1], 10);
                 }
              }
              await new Promise(r => setTimeout(r, 450)); 
           } catch (err) {}
         }
         finalAnimes.push(anime);
      }
      if (user) {
        const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
        const savePromises = finalAnimes.map(anime => setDoc(doc(animesRef, Date.now().toString() + Math.random().toString(36).substring(2, 9)), anime));
        await Promise.all(savePromises);
        showToast(`¡Éxito! Importados ${finalAnimes.length} animes.`, "success");
      }
    } catch (err) {
      showToast("Error crítico al procesar XML.", "error");
    } finally {
      setIsImporting(false); setImportProgress({ current: 0, total: 0 }); e.target.value = null; 
    }
  };

  const exportToCSV = () => {
    if (animes.length === 0) return;
    const headers = ['Título', 'Estado', 'Progreso', 'Total Episodios', 'Calificación', 'Géneros', 'URL de Portada'];
    const csvRows = [headers.join(',')];
    animes.forEach(anime => {
      const row = [
        `"${(anime.title || '').replace(/"/g, '""')}"`, `"${anime.status || ''}"`, anime.progress || 0,
        anime.totalEpisodes || 0, anime.rating || 0, `"${(anime.genres || []).join(', ')}"`, `"${anime.coverUrl || ''}"`
      ];
      csvRows.push(row.join(','));
    });
    const csvContent = "\uFEFF" + csvRows.join('\n'); 
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'mi_lista_anime.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Archivo CSV descargado correctamente.", "success");
  };

  const handleStartRoulette = async () => {
    if (isSpinning) return;
    setWinnerAnime(null);

    let candidates = [];
    if (rouletteMode === 'pendiente') {
      candidates = animes.filter(a => a.status === 'Pendiente');
      if (candidates.length === 0) {
        showToast("No tienes pendientes. ¡Cambiando a modo Invocación!", "warning");
        setRouletteMode('descubrir'); return;
      }
    }

    setIsSpinning(true);
    if (rouletteMode === 'descubrir') {
      try {
        const page = Math.floor(Math.random() * 5) + 1;
        const res = await fetch(`https://api.jikan.moe/v4/top/anime?page=${page}&limit=20`);
        const data = await res.json();
        candidates = data.data ? data.data.map(item => ({
          title: item.title, coverUrl: item.images?.jpg?.large_image_url, genres: item.genres?.map(g => g.name) || [],
          totalEpisodes: item.episodes || 12, score: item.score || 0, malId: String(item.mal_id)
        })) : [];
      } catch (e) {
        showToast("Error de conexión", "error");
        setIsSpinning(false); return;
      }
    }

    if (candidates.length === 0) {
      showToast("No se encontraron candidatos.", "error");
      setIsSpinning(false); return;
    }

    const arraySize = 50;
    const generatedList = Array.from({ length: arraySize }, (_, idx) => {
      const candidateIndex = idx % candidates.length;
      return { ...candidates[candidateIndex], rouletteId: `${idx}-${Date.now()}` };
    });

    setRouletteList(generatedList);
    const targetIndex = 40; 
    const cardWidth = 144 + 12; 
    const targetOffset = (targetIndex * cardWidth) - (carouselRef.current?.offsetWidth / 2) + (cardWidth / 2);
    
    setSpinOffset(0);
    setTimeout(() => { setSpinOffset(targetOffset); }, 100);

    let currentTick = 0;
    const playTickSequence = () => {
      if (currentTick < targetIndex) {
        playSound('tick');
        currentTick++;
        const delay = Math.pow(currentTick / (targetIndex * 0.95), 3) * 200 + 40; 
        setTimeout(playTickSequence, delay);
      }
    };
    playTickSequence();

    setTimeout(() => {
      setIsSpinning(false);
      setWinnerAnime(generatedList[targetIndex]);
      playSound('success');
      triggerQuestComplete('ruleta');
    }, 5500);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-purple-500/30 pb-16 relative overflow-x-hidden">
      
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* --- NOTIFICACIONES FLOTANTES --- */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="animate-in slide-in-from-right-5 fade-in duration-300 pointer-events-auto flex items-center gap-3 p-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl">
            {toast.type === 'success' && <Check className="w-5 h-5 text-green-400 shrink-0" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-400 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />}
            <span className="text-sm font-semibold text-slate-100">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* HEADER PRINCIPAL */}
      <header className="sticky top-0 z-30 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex items-center justify-between gap-4">
            
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setCurrentView('list'); setViewingSharedList(null); }}>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-purple-500/20 border border-purple-500/30">
                <img src="/icono.png" alt="AniTracker Logo" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-300">
                AniTracker
              </h1>
            </div>

            {/* --- ACCIONES PARA CELULARES --- */}
            <div className="flex items-center gap-2 lg:hidden">
              {(currentView === 'list' || currentView === 'catalog') && !viewingSharedList && (
                <button 
                  onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                  className={`p-2 rounded-xl border transition-all ${isMobileSearchOpen ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                >
                  <Search className="w-4 h-4" />
                </button>
              )}

              {currentView === 'list' && !viewingSharedList && (
                <button onClick={() => handleOpenModal()} className="p-2 bg-purple-600 text-white rounded-xl shadow-md shadow-purple-600/20"><Plus className="w-4 h-4" /></button>
              )}

              <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl"><Menu className="w-5 h-5" /></button>
            </div>

            {/* --- ACCIONES PARA ESCRITORIO --- */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="bg-slate-800/50 p-1 rounded-xl mr-2 border border-slate-700/50 flex">
                <button onClick={() => { setCurrentView('list'); setViewingSharedList(null); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentView === 'list' && !viewingSharedList ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Mi Lista</button>
                <button onClick={() => { setCurrentView('catalog'); setViewingSharedList(null); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${currentView === 'catalog' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Compass size={15}/>Navegar</button>
                <button onClick={() => { setCurrentView('guild'); setViewingSharedList(null); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${currentView === 'guild' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}><Gamepad2 size={15}/>Gremio & Ruleta</button>
                <button onClick={() => { setCurrentView('calendar'); setViewingSharedList(null); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${currentView === 'calendar' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Calendar size={15}/>Calendario</button>
                <button onClick={() => { setCurrentView('community'); setViewingSharedList(null); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${currentView === 'community' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Users size={15}/>Comunidad</button>
                <button onClick={() => { setCurrentView('stats'); setViewingSharedList(null); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${currentView === 'stats' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><BarChart3 size={15}/>Estadísticas</button>
              </div>

              {user && !user.isAnonymous ? (
                <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full shadow-lg">
                  <img src={user.photoURL || 'https://via.placeholder.com/32'} alt="Perfil" className="w-7 h-7 rounded-full border border-purple-500/50" />
                  <span className="text-sm font-semibold text-slate-200 max-w-[120px] truncate">{user.displayName || 'Usuario'}</span>
                  <button onClick={handleLogout} title="Cerrar sesión" className="text-slate-400 hover:text-red-400 transition-colors ml-1"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={handleGoogleLogin} className="flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-full text-sm font-bold transition-all shadow-md">
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  <span>Google Login</span>
                </button>
              )}

              {currentView === 'list' && !viewingSharedList && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Filtrar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-40 bg-slate-800/50 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500 transition-all" />
                  </div>
                  
                  <div className="flex shrink-0 bg-slate-800 border border-slate-700 rounded-full p-1">
                    <button onClick={() => setListLayout('grid')} className={`p-1.5 rounded-full transition-all ${listLayout === 'grid' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><LayoutGrid className="w-4 h-4" /></button>
                    <button onClick={() => setListLayout('list')} className={`p-1.5 rounded-full transition-all ${listLayout === 'list' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><List className="w-4 h-4" /></button>
                  </div>

                  <input type="file" accept=".xml" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isImporting || !user} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3.5 py-2 rounded-full text-sm font-bold transition-all border border-slate-700 shadow-md">
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> : <Upload className="w-4 h-4" />}
                    <span>{isImporting ? 'Importando...' : 'Importar'}</span>
                  </button>

                  <button onClick={exportToCSV} disabled={animes.length === 0} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3.5 py-2 rounded-full text-sm font-bold transition-all border border-slate-700 shadow-md"><Download className="w-4 h-4" /><span>Exportar</span></button>

                  <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-full text-sm font-bold transition-all shadow-lg shadow-purple-600/20"><Plus className="w-4 h-4" /><span>Añadir</span></button>
                </>
              )}
            </div>
          </div>

          {/* --- BUSCADOR EXPANDIBLE SÓLO EN MÓVIL --- */}
          {(currentView === 'list' || currentView === 'catalog') && !viewingSharedList && isMobileSearchOpen && (
            <div className="mt-3.5 lg:hidden flex gap-2 animate-in slide-in-from-top-3 duration-200">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" placeholder={currentView === 'catalog' ? "Buscar animes..." : "Buscar en mi lista..."} 
                  value={currentView === 'catalog' ? catalogSearch : searchQuery} 
                  onChange={(e) => currentView === 'catalog' ? setCatalogSearch(e.target.value) : setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500 text-slate-200"
                />
              </div>
              {currentView === 'list' && (
                <div className="flex bg-slate-800 border border-slate-700 rounded-xl p-0.5">
                  <button onClick={() => setListLayout('grid')} className={`p-1.5 rounded-lg ${listLayout === 'grid' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
                  <button onClick={() => setListLayout('list')} className={`p-1.5 rounded-lg ${listLayout === 'list' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}><List className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          )}

          {currentView === 'list' && !viewingSharedList && (
            <div className="flex overflow-x-auto hide-scrollbar gap-2 mt-4 pb-1">
              {['Todos', ...Object.keys(STATUS_CONFIG)].map(status => (
                <button
                  key={status} onClick={() => setActiveFilter(status)}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                    activeFilter === status ? 'bg-[#1e293b] text-white shadow-md border border-slate-700' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* --- MENÚ LATERAL DESPLEGABLE MÓVIL (DRAWER) --- */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-4/5 max-w-sm bg-[#0f172a] border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center border border-purple-500/30">
                    <img src="/icono.png" alt="AniTracker Logo" className="w-full h-full object-cover" />
                  </div>
                  <span className="font-black text-lg text-white">AniTracker</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="py-6 border-b border-slate-800">
                {user && !user.isAnonymous ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <img src={user.photoURL || 'https://via.placeholder.com/40'} alt="Perfil" className="w-10 h-10 rounded-full border border-purple-500" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate text-sm">{user.displayName || 'Usuario'}</p>
                        <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">{stats.rankTitle} • Nivel {stats.level}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                        <Share2 size={12} className="text-purple-400"/> Compartir Lista
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer scale-90">
                        <input type="checkbox" checked={isPublic} onChange={(e) => handleTogglePrivacy(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    {isPublic && (
                      <button onClick={() => { handleShareLink(user.uid); setIsMobileMenuOpen(false); }} className="w-full text-center bg-slate-800 text-xs text-purple-400 font-bold py-2 rounded-lg border border-purple-500/20">
                        Copiar mi Enlace Otaku
                      </button>
                    )}
                    <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="w-full text-center bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold py-2 rounded-lg">
                      Cerrar Sesión
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400 leading-normal">Inicia sesión para sincronizar tu lista en la nube y acceder a misiones del Gremio.</p>
                    <button onClick={() => { handleGoogleLogin(); setIsMobileMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 bg-white text-slate-900 py-2.5 rounded-xl text-xs font-extrabold shadow-md">
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Iniciar con Google
                    </button>
                  </div>
                )}
              </div>

              <nav className="py-6 space-y-2">
                <button onClick={() => { setCurrentView('list'); setViewingSharedList(null); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'list' && !viewingSharedList ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Tv size={16}/> Mi Lista de Anime</button>
                <button onClick={() => { setCurrentView('catalog'); setViewingSharedList(null); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'catalog' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Compass size={16}/> Navegar</button>
                <button onClick={() => { setCurrentView('guild'); setViewingSharedList(null); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'guild' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}><Gamepad2 size={16}/> Gremio & Ruleta</button>
                <button onClick={() => { setCurrentView('calendar'); setViewingSharedList(null); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'calendar' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Calendar size={16}/> Calendario Estrenos</button>
                <button onClick={() => { setCurrentView('community'); setViewingSharedList(null); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'community' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Users size={16}/> Comunidad Social</button>
                <button onClick={() => { setCurrentView('stats'); setViewingSharedList(null); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${currentView === 'stats' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><BarChart3 size={16}/> Estadísticas Otaku</button>
              </nav>
            </div>

            {currentView === 'list' && !viewingSharedList && (
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <button onClick={() => { fileInputRef.current?.click(); setIsMobileMenuOpen(false); }} disabled={isImporting || !user} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 py-2.5 rounded-xl text-xs font-bold border border-slate-700"><Upload size={14}/> Importar XML (MAL)</button>
                <button onClick={() => { exportToCSV(); setIsMobileMenuOpen(false); }} disabled={animes.length === 0} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 py-2.5 rounded-xl text-xs font-bold border border-slate-700"><Download size={14}/> Exportar CSV</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- VISTA: NAVEGADOR (CATÁLOGO ANILIST STYLE) --- */}
      {currentView === 'catalog' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white flex items-center gap-3"><Compass className="text-pink-500 w-8 h-8" /> Navegar</h2>
              <p className="text-slate-400 mt-2">Descubre tendencias, próximos estrenos y los animes más populares de todos los tiempos.</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="Buscar animes específicos..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} className="w-full bg-[#1e293b] border border-slate-700 rounded-full py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-pink-500 transition-all shadow-lg text-slate-200" />
            </div>
          </div>
          
          {isCatalogLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500"><Loader2 className="w-12 h-12 mb-4 animate-spin text-pink-500" /><p className="font-medium">Sintonizando frecuencias de anime...</p></div>
          ) : catalogSearch.trim().length > 2 ? (
            /* RESULTADOS DE BÚSQUEDA GRID MODO */
            catalogAnimes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500"><Compass className="w-16 h-16 mb-4 opacity-20" /><p className="text-lg">No se encontraron resultados.</p></div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6">
                {catalogAnimes.map(anime => (
                  <div key={anime.mal_id} onClick={() => handleOpenDetails(anime)} className="group relative bg-[#1e293b] rounded-2xl overflow-hidden border border-slate-700/50 hover:border-pink-500/50 transition-all duration-300 flex flex-col hover:shadow-xl hover:shadow-pink-500/10 cursor-pointer">
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-800">
                      <img src={anime.images?.jpg?.large_image_url || 'https://via.placeholder.com/400x600'} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/10 to-transparent opacity-90" />
                      <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-slate-900/90 backdrop-blur-md px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg flex items-center gap-1 border border-slate-700">
                        <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-[10px] sm:text-xs font-bold text-white">{anime.score || 'N/A'}</span>
                      </div>
                      <div className="absolute bottom-0 left-0 w-full p-2 sm:p-3">
                        <h3 className="text-xs sm:text-base font-bold text-white line-clamp-2 leading-tight mb-0.5 sm:mb-1 drop-shadow-md">{anime.title}</h3>
                        <div className="text-[9px] sm:text-xs text-slate-300 font-medium">{anime.year || anime.status}</div>
                      </div>
                    </div>
                    <div className="p-2 sm:p-3 bg-slate-800 flex-1 flex flex-col justify-end border-t border-slate-700/50">
                      <button onClick={(e) => { e.stopPropagation(); handleAddFromCatalog(anime); }} className="w-full flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-700 hover:bg-pink-600 text-white py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold transition-colors">
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4" /><span className="hidden sm:inline">Añadir a mi lista</span><span className="sm:hidden">Añadir</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* CARRUSELES ESTILO ANILIST */
            <div className="space-y-4">
              {renderBrowseCarousel("Tendencias Actuales", browseData.trending)}
              {renderBrowseCarousel("Popular Esta Temporada (Próximos)", browseData.upcoming)}
              {renderBrowseCarousel("Popular De Todos Los Tiempos", browseData.popular)}
            </div>
          )}
        </main>
      )}

      {/* --- VISTA: GREMIO DE AVENTUREROS & RULETA GACHA --- */}
      {currentView === 'guild' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <div className="bg-[#1e293b]/90 border border-yellow-500/30 p-6 rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Trophy size={140} className="text-yellow-500" /></div>
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center border border-yellow-500/40 text-yellow-400"><Award size={28} /></div>
                  <div>
                    <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest">{stats.rankTitle}</span>
                    <h2 className="text-2xl font-black text-white">{user?.displayName || 'Aventurero'}</h2>
                  </div>
                </div>
                <div className="space-y-2 mt-6">
                  <div className="flex justify-between text-xs font-bold text-slate-300"><span>Nivel {stats.level}</span><span>{stats.levelProgressPercent}% para el Siguiente Rango</span></div>
                  <div className="h-3 w-full bg-slate-900 rounded-full border border-slate-800 overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-1000" style={{ width: `${stats.levelProgressPercent}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1"><span>{stats.progressInCurrentLevel} XP ganados</span><span>Progreso Total: {stats.totalXp} XP</span></div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/60 flex justify-between items-center text-[10px] sm:text-xs text-slate-400"><span>⚔️ Episodio: +15 XP</span><span>👑 Series: +150 XP</span><span>🏅 Logros: +200 XP</span></div>
            </div>

            <div className="lg:col-span-2 bg-[#1e293b]/60 border border-slate-800 p-6 rounded-3xl shadow-xl">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4"><Zap className="text-purple-500 w-5 h-5 animate-pulse" /> Misiones Otaku de Hoy</h3>
              <p className="text-slate-400 text-xs mb-6">Completa tus misiones diariamente para subir tu nivel de aventurero.</p>
              <div className="space-y-4">
                {quests.map(q => {
                  const isClaimed = claimedQuests.includes(q.id);
                  return (
                    <div key={q.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${q.done ? 'bg-purple-500/5 border-purple-500/20' : 'bg-[#0f172a] border-slate-800'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${q.done ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-700 bg-slate-800 text-slate-500'}`}>{q.done ? <Check size={14} strokeWidth={3} /> : null}</div>
                        <div className="text-xs sm:text-sm">
                          <p className={`font-semibold ${q.done ? 'text-slate-300' : 'text-slate-400'}`}>{q.text}</p>
                          <span className="text-[10px] text-purple-400 font-bold font-mono">+{q.points} XP</span>
                        </div>
                      </div>
                      {q.done ? (
                        <button onClick={() => claimQuestXp(q.id, q.points)} disabled={isClaimed} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow ${isClaimed ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-500'}`}>{isClaimed ? 'Reclamado' : 'Reclamar'}</button>
                      ) : (<span className="text-[10px] bg-slate-900 px-2.5 py-1 rounded-lg text-slate-400 border border-slate-800 font-bold uppercase tracking-wider">Activo</span>)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-[#1e293b]/40 rounded-3xl border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
            <div className="max-w-xl mx-auto text-center mb-8">
              <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5 w-fit mx-auto mb-3"><Dices size={14} /> La Ruleta del Destino</span>
              <h2 className="text-3xl font-black text-white">¿No sabes qué ver hoy? Gira la Ruleta</h2>
              <p className="text-slate-400 text-sm mt-2">Sortea entre tus animes en lista "Pendiente" o invoca un anime recomendado aleatoriamente de MyAnimeList.</p>
            </div>

            <div className="flex justify-center gap-3 mb-8">
              <button onClick={() => setRouletteMode('pendiente')} disabled={isSpinning} className={`px-6 py-2.5 rounded-2xl text-xs font-extrabold tracking-wider uppercase transition-all border ${rouletteMode === 'pendiente' ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/10' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}>Girar mis Pendientes</button>
              <button onClick={() => setRouletteMode('descubrir')} disabled={isSpinning} className={`px-6 py-2.5 rounded-2xl text-xs font-extrabold tracking-wider uppercase transition-all border ${rouletteMode === 'descubrir' ? 'bg-pink-600 text-white border-pink-500 shadow-lg shadow-pink-600/10' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}>Invocación Mundial (MAL)</button>
            </div>

            <div className="relative max-w-4xl mx-auto h-52 bg-slate-900 rounded-3xl border border-slate-800 flex items-center overflow-hidden shadow-inner mb-8">
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1.5 bg-yellow-500 z-10 shadow-[0_0_15px_rgba(234,179,8,0.6)]">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-500 rotate-45 rounded-sm" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-500 rotate-45 rounded-sm" />
              </div>
              <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
              <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none" />

              <div ref={carouselRef} className="flex items-center gap-3 px-4 h-full" style={{ transform: `translateX(-${spinOffset}px)`, transition: isSpinning ? 'transform 5.5s cubic-bezier(0.1, 0.8, 0.15, 1)' : 'none', willChange: 'transform' }}>
                {rouletteList.map((item) => (
                  <div key={item.rouletteId} className="w-36 h-44 rounded-2xl bg-[#1e293b] border border-slate-700 overflow-hidden shrink-0 flex flex-col justify-between relative shadow-lg">
                    <img src={item.coverUrl} className="w-full h-full object-cover opacity-80" onError={(e) => e.target.src='https://via.placeholder.com/150x200'} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/20 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2"><p className="text-[10px] font-black text-white line-clamp-2 drop-shadow-md">{item.title}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={handleStartRoulette} disabled={isSpinning} className="px-12 py-4 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-40 text-slate-900 font-black text-sm sm:text-base uppercase tracking-widest rounded-2xl shadow-xl shadow-yellow-500/10 transition-all transform hover:scale-102 flex items-center gap-2">
                {isSpinning ? <><Loader2 className="w-5 h-5 animate-spin" /> Consultando Oráculo...</> : <><Dices className="w-5 h-5" /> ¡Girar Ruleta!</>}
              </button>
            </div>

            {winnerAnime && !isSpinning && (
              <div className="max-w-xl mx-auto mt-12 bg-[#1e293b] rounded-3xl border border-yellow-500/30 p-6 shadow-2xl flex flex-col sm:flex-row items-center gap-6 animate-in zoom-in-95 duration-300">
                <img src={winnerAnime.coverUrl} className="w-28 h-40 object-cover rounded-xl border border-slate-700 shadow-xl" onError={(e) => e.target.src='https://via.placeholder.com/150x200'} />
                <div className="flex-1 text-center sm:text-left">
                  <span className="px-2.5 py-0.5 bg-yellow-500/15 border border-yellow-500/30 text-[10px] font-bold text-yellow-500 rounded-md uppercase tracking-wider">¡Sorteo Completado!</span>
                  <h3 className="text-xl font-black text-white leading-tight mt-2 mb-1">{winnerAnime.title}</h3>
                  <p className="text-xs text-slate-400 mb-4">{winnerAnime.genres?.slice(0,3).join(' • ') || 'Géneros desconocidos'}</p>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <button onClick={() => handleOpenDetails(winnerAnime)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors">Ver Sinopsis</button>
                    {rouletteMode === 'pendiente' ? (
                      <button onClick={() => {
                        const updated = { ...winnerAnime, status: 'Viendo' };
                        const animesRef = collection(db, 'artifacts', appId, 'users', user?.uid, 'animes');
                        setDoc(doc(animesRef, winnerAnime.id), updated);
                        showToast("¡Anime marcado como Viendo!", "success");
                      }} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-colors">Empezar a ver ahora</button>
                    ) : (
                      <button onClick={() => handleAddFromCatalog(winnerAnime)} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl transition-colors">Añadir a mi lista</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {currentView === 'community' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 bg-[#1e293b]/50 p-6 rounded-3xl border border-slate-800">
            <div>
              <h2 className="text-3xl font-bold text-white flex items-center gap-3"><Users className="text-blue-500 w-8 h-8" /> Sala de Otakus</h2>
              <p className="text-slate-400 mt-2">Explora las colecciones compartidas por la comunidad, clona títulos y comparte tu ranking personal.</p>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <div className="flex items-center justify-between gap-4 bg-slate-900 px-5 py-3 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2.5"><Share2 className="w-4 h-4 text-purple-400" /><span className="text-sm font-semibold">Perfil Público</span></div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isPublic} onChange={(e) => handleTogglePrivacy(e.target.checked)} className="sr-only peer" disabled={!user || user.isAnonymous}/>
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              {isPublic && user && (
                <button onClick={() => handleShareLink(user.uid)} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md"><Share2 size={14}/> Copiar mi Enlace de Otaku</button>
              )}
            </div>
          </div>

          {isCommunityLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-12 h-12 mb-4 animate-spin text-blue-500" /><p className="font-medium">Sintonizando listas públicas de la red...</p>
            </div>
          ) : sharedProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Users className="w-16 h-16 mb-4 opacity-10" /><p className="text-lg">No hay listas compartidas de momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sharedProfiles.map(profile => (
                <div key={profile.uid} className="bg-[#1e293b]/60 rounded-3xl p-5 border border-slate-800 hover:border-blue-500/40 transition-all flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <img src={profile.photoURL || 'https://via.placeholder.com/40'} alt={profile.username} className="w-10 h-10 rounded-full border border-slate-700" />
                      <div>
                        <h3 className="font-bold text-white text-base leading-tight">{profile.username}</h3>
                        <p className="text-[10px] text-slate-500">Compartido {safeFormatDate(profile.updatedAt)}</p>
                      </div>
                      <span className="ml-auto bg-blue-500/10 text-blue-400 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-500/20">{profile.animes?.length || 0} Series</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {(profile.animes || []).slice(0, 4).map((anime, i) => (
                        <div key={i} className="aspect-[3/4] rounded-lg overflow-hidden bg-slate-950 relative group">
                          <img src={anime?.coverUrl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" onError={(e)=>e.target.src='https://via.placeholder.com/100'} />
                          {anime?.rating > 0 && <div className="absolute top-1 left-1 bg-slate-900/95 px-1 py-0.5 rounded text-[8px] text-yellow-500 flex items-center gap-0.5">★{anime.rating}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => { setViewingSharedList(profile); setCurrentView('list'); }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"><BookOpen size={13}/> Ver Lista</button>
                    <button onClick={() => handleShareLink(profile.uid)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"><Share2 size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* --- VISTA: CALENDARIO DE ESTRENOS --- */}
      {currentView === 'calendar' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3"><Calendar className="text-emerald-500 w-8 h-8" /> Calendario de Estrenos</h2>
            <p className="text-slate-400 mt-2">Cuenta regresiva exacta para los próximos episodios de los animes que estás viendo actualmente.</p>
          </div>
          {isCalendarLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500"><Loader2 className="w-12 h-12 mb-4 animate-spin text-emerald-500" /><p className="font-medium">Sincronizando horarios con Japón...</p></div>
          ) : calendarAnimes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-[#1e293b] rounded-3xl border border-slate-700/50 p-8 text-center max-w-2xl mx-auto shadow-xl">
              <Calendar className="w-16 h-16 mb-4 opacity-20 text-emerald-500" />
              <p className="text-xl font-bold text-slate-300 mb-2">No hay estrenos próximos</p>
              <p className="text-sm text-slate-400">Asegúrate de tener animes en estado "Viendo" que estén en emisión actualmente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {calendarAnimes.map(anime => (
                <div key={anime.id} onClick={() => handleOpenDetails(anime)} className="bg-[#1e293b] border border-slate-700/50 p-5 rounded-2xl flex items-center gap-5 hover:border-emerald-500/50 transition-all hover:shadow-xl hover:shadow-emerald-500/10 group cursor-pointer">
                  <div className="relative shrink-0">
                    <img src={anime.coverUrl} alt={anime.title} className="w-24 h-32 object-cover rounded-xl shadow-md group-hover:scale-105 transition-transform" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x600/1e293b/475569?text=Sin+Portada' }}/>
                    <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">EP {anime.progress + 1}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white line-clamp-2 mb-1 text-sm sm:text-base" title={anime.title}>{anime.title}</h3>
                    <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-500" /> {anime.broadcast.day} a las {anime.broadcast.time} (JST)</div>
                    <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700/50">
                      <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-bold mb-1">Se estrena en:</p>
                      <div className="text-slate-100 font-mono font-bold text-sm sm:text-base"><CountdownTimer broadcast={anime.broadcast} /></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {currentView === 'stats' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3"><BarChart3 className="text-indigo-500 w-8 h-8" /> Tu Panel de Otaku</h2>
            <p className="text-slate-400 mt-2">Un resumen de todo tu progreso y tiempo invertido.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-indigo-900/40 to-slate-800 border border-indigo-500/30 p-6 rounded-3xl relative overflow-hidden">
              <Clock className="absolute -right-4 -bottom-4 w-32 h-32 text-indigo-500/10" />
              <div className="relative z-10">
                <p className="text-indigo-400 font-bold mb-1 text-sm uppercase tracking-wider">Tiempo Invertido</p>
                <div className="flex items-end gap-2 text-white">
                  <span className="text-5xl font-black">{stats.days}</span><span className="text-lg font-medium text-slate-300 pb-1">días</span>
                  <span className="text-5xl font-black ml-2">{stats.hours}</span><span className="text-lg font-medium text-slate-300 pb-1">hrs</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/40 to-slate-800 border border-purple-500/30 p-6 rounded-3xl relative overflow-hidden">
              <Tv className="absolute -right-4 -bottom-4 w-32 h-32 text-purple-500/10" />
              <div className="relative z-10">
                <p className="text-purple-400 font-bold mb-1 text-sm uppercase tracking-wider">Episodios Vistos</p>
                <div className="flex items-end gap-2 text-white">
                  <span className="text-5xl font-black">{stats.totalEps}</span><span className="text-lg font-medium text-slate-300 pb-1">eps</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-900/40 to-slate-800 border border-green-500/30 p-6 rounded-3xl relative overflow-hidden">
              <CheckCircle2 className="absolute -right-4 -bottom-4 w-32 h-32 text-green-500/10" />
              <div className="relative z-10">
                <p className="text-green-400 font-bold mb-1 text-sm uppercase tracking-wider">Animes Terminados</p>
                <div className="flex items-end gap-2 text-white">
                  <span className="text-5xl font-black">{stats.completedCount}</span><span className="text-lg font-medium text-slate-300 pb-1">series</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1e293b] border border-slate-700/50 p-6 rounded-3xl">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-pink-400" /> Géneros Más Vistos</h3>
              {stats.topGenres.length === 0 ? (
                <p className="text-slate-500 text-center py-10">Añade animes usando el buscador para ver tus géneros favoritos.</p>
              ) : (
                <div className="space-y-4">
                  {stats.topGenres.map(([genre, count], idx) => {
                    const percent = Math.round((count / stats.maxGenreCount) * 100);
                    const colors = ['bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500', 'bg-emerald-500'];
                    return (
                      <div key={genre}>
                        <div className="flex justify-between text-sm font-medium text-slate-300 mb-1"><span>{genre}</span><span className="text-slate-400">{count} animes</span></div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${colors[idx % colors.length]} transition-all duration-1000`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="bg-[#1e293b] border border-slate-700/50 p-6 rounded-3xl">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-400" /> Sistema de Logros</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {stats.achievements.map(ach => {
                  const AchIcon = ach.icon;
                  return (
                    <div key={ach.id} className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${ach.unlocked ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-slate-800/50 border-slate-700/50 opacity-50 grayscale'}`}>
                      <div className={`p-2 rounded-full ${ach.unlocked ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400'}`}><AchIcon className="w-5 h-5" /></div>
                      <div>
                        <h4 className={`font-bold text-sm ${ach.unlocked ? 'text-yellow-400' : 'text-slate-300'}`}>{ach.title}</h4>
                        <p className="text-xs text-slate-400 leading-tight mt-0.5">{ach.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      )}

      {currentView === 'list' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4">
          {viewingSharedList && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-3xl flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <img src={viewingSharedList.photoURL} className="w-10 h-10 rounded-full border border-blue-500" />
                <div><h3 className="font-bold text-white text-base">Viendo lista de {viewingSharedList.username}</h3><p className="text-xs text-slate-400">Puedes clonar sus animes.</p></div>
              </div>
              <button onClick={() => setViewingSharedList(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition-colors">Volver a Mi Lista</button>
            </div>
          )}

          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500"><Loader2 className="w-12 h-12 mb-4 animate-spin text-purple-500" /><p className="font-medium">Sincronizando...</p></div>
          ) : animesToRender.filter(Boolean).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Tv className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">No hay animes de momento.</p>
              {!viewingSharedList && (<button onClick={() => setCurrentView('catalog')} className="mt-4 text-purple-400 hover:text-purple-300 font-bold text-sm">¡Explora el catálogo!</button>)}
            </div>
          ) : (
            <div className={listLayout === 'grid' ? "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6" : "flex flex-col gap-3 sm:gap-4"}>
              {animesToRender.filter(Boolean).map(anime => {
                const statusConf = STATUS_CONFIG[anime.status] || STATUS_CONFIG['Viendo'];
                const StatusIcon = statusConf.icon;
                const progressPercent = anime.totalEpisodes ? Math.min(100, Math.round((anime.progress / anime.totalEpisodes) * 100)) : 0;

                if (listLayout === 'grid') {
                  return (
                    <div key={anime.id || anime.title} onClick={() => handleOpenDetails(anime)} className="group relative bg-[#1e293b] rounded-xl sm:rounded-2xl overflow-hidden border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 cursor-pointer">
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-800">
                        {anime.coverUrl ? (<img src={anime.coverUrl} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x600/1e293b/475569?text=Sin+Portada' }} />) : (<div className="w-full h-full flex items-center justify-center text-slate-600"><ImageIcon className="w-8 h-8 sm:w-12 sm:h-12" /></div>)}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/20 to-transparent opacity-90" />
                        
                        <div className="absolute top-1.5 right-1.5 sm:top-3 sm:right-3 flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e)=>e.stopPropagation()}>
                          {viewingSharedList ? (
                            <button onClick={() => handleCloneAnime(anime)} className="p-1 sm:p-2 bg-black/75 backdrop-blur rounded-full hover:bg-blue-600 text-white transition-colors"><ArrowUpRight className="w-3.5 h-3.5" /></button>
                          ) : (
                            <>
                              <button onClick={() => handleOpenModal(anime)} className="p-1 sm:p-2 bg-black/75 backdrop-blur rounded-full hover:bg-purple-600 text-white transition-colors"><Edit3 className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                              <button onClick={() => handleDelete(anime.id)} className="p-1 sm:p-2 bg-black/75 backdrop-blur rounded-full hover:bg-red-600 text-white transition-colors"><Trash2 className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                            </>
                          )}
                        </div>

                        <div className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3">
                          <div className={`flex items-center gap-1 sm:gap-1.5 px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[8px] sm:text-xs font-bold backdrop-blur-md ${statusConf.bg} ${statusConf.color} border ${statusConf.border}`}>
                            <StatusIcon className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">{anime.status}</span>
                          </div>
                        </div>

                        <div className="absolute bottom-0 left-0 w-full p-2.5 sm:p-4">
                          <h3 className="text-[10px] sm:text-base font-bold text-white line-clamp-2 leading-tight mb-1 sm:mb-2 drop-shadow-md">{anime.title}</h3>
                          <div className="space-y-1 sm:space-y-1.5">
                            <div className="flex justify-between text-[9px] sm:text-xs text-slate-300 font-bold"><span>EP {anime.progress} <span className="hidden sm:inline">/ {anime.totalEpisodes || '?'}</span></span><span>{progressPercent}%</span></div>
                            <div className="h-1 sm:h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50"><div className={`h-full rounded-full transition-all duration-500 ${anime.status === 'Terminado' ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${progressPercent}%` }} /></div>
                          </div>
                        </div>
                      </div>

                      {!viewingSharedList && (
                        <div className="bg-[#1e293b] p-1 sm:p-2 border-t border-slate-700/50 flex items-center justify-between" onClick={(e)=>e.stopPropagation()}>
                          <button disabled={anime.progress === 0} onClick={(e) => handleQuickProgress(e, anime, -1)} className="text-[10px] font-bold px-2 py-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md transition-all disabled:opacity-40">-1</button>
                          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">Progreso</span>
                          <button onClick={(e) => handleQuickProgress(e, anime, 1)} className="bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white text-[10px] font-bold px-2 py-1 rounded-md transition-all">+1 EP</button>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={anime.id || anime.title} onClick={() => handleOpenDetails(anime)} className="group flex flex-row bg-[#1e293b] rounded-2xl overflow-hidden border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 cursor-pointer">
                    <div className="relative w-20 sm:w-28 shrink-0 bg-slate-800">
                      {anime.coverUrl ? (<img src={anime.coverUrl} className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x600/1e293b/475569?text=Sin+Portada' }} />) : (<div className="w-full h-full flex items-center justify-center text-slate-600"><ImageIcon className="w-8 h-8" /></div>)}
                    </div>
                    <div className="flex-1 p-3 sm:p-5 flex flex-col justify-between min-w-0">
                      <div className="flex justify-between items-start gap-2 sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
                            <div className={`flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[9px] sm:text-xs font-bold ${statusConf.bg} ${statusConf.color} border ${statusConf.border} w-fit`}>
                              <StatusIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {anime.status}
                            </div>
                          </div>
                          <h3 className="text-xs sm:text-xl font-bold text-white mb-0.5 sm:mb-1 line-clamp-2 leading-tight">{anime.title}</h3>
                          {anime.genres && anime.genres.length > 0 && <p className="text-[9px] sm:text-xs text-slate-500 truncate">{anime.genres.slice(0,3).join(', ')}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" onClick={(e)=>e.stopPropagation()}>
                          {viewingSharedList ? (
                            <button onClick={() => handleCloneAnime(anime)} className="p-2 bg-slate-800 hover:bg-blue-600 text-white rounded-xl transition-all" title="Clonar"><ArrowUpRight size={14} /></button>
                          ) : (
                            <>
                              <button onClick={() => handleOpenModal(anime)} className="p-1.5 sm:p-2 bg-slate-800 hover:bg-purple-600 rounded-lg sm:rounded-xl text-white transition-colors" title="Editar"><Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                              <button onClick={() => handleDelete(anime.id)} className="p-1.5 sm:p-2 bg-slate-800 hover:bg-red-600 rounded-lg sm:rounded-xl text-white transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 ml-1">
                                <button disabled={anime.progress === 0} onClick={(e) => handleQuickProgress(e, anime, -1)} className="px-2 py-1 text-slate-500 hover:text-white font-mono text-xs">-</button>
                                <span className="text-xs px-1 text-slate-400 font-bold">{anime.progress}</span>
                                <button onClick={(e) => handleQuickProgress(e, anime, 1)} className="px-2 py-1 text-purple-400 hover:text-white font-mono text-xs">+</button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 sm:mt-4 w-full">
                        <div className="flex justify-between text-[10px] sm:text-xs text-slate-400 font-semibold mb-1"><span>Episodios: {anime.progress} / {anime.totalEpisodes || '?'}</span><span>{progressPercent}%</span></div>
                        <div className="h-1.5 sm:h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50"><div className={`h-full rounded-full transition-all duration-500 ${anime.status === 'Terminado' ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${progressPercent}%` }} /></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* --- WIKI & DETALLES DRAWER / MODAL --- */}
      {selectedDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setSelectedDetails(null)} />
          <div className="relative h-full w-full max-w-xl bg-[#0f172a] border-l border-slate-800 shadow-2xl overflow-y-auto custom-scrollbar flex flex-col justify-between animate-in slide-in-from-right duration-300">
            <div className="relative aspect-video w-full bg-[#0f172a]">
              <img src={selectedDetails.coverUrl} className="w-full h-full object-cover opacity-30 filter blur-sm absolute inset-0" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] to-transparent" />
              <button onClick={() => setSelectedDetails(null)} className="absolute top-4 right-4 p-2 bg-[#0f172a]/80 hover:bg-slate-800/80 rounded-full text-white border border-slate-800 transition-colors z-10"><X size={20}/></button>
              <div className="absolute bottom-4 left-4 right-4 flex gap-4 items-end">
                <img src={selectedDetails.coverUrl} className="w-20 sm:w-28 aspect-[3/4] object-cover rounded-xl border border-slate-800 shadow-2xl" />
                <div className="flex-1 min-w-0">
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold rounded-md tracking-wider uppercase">Wiki Info</span>
                  <h2 className="text-sm sm:text-xl font-black text-white leading-tight mt-1 line-clamp-2">{selectedDetails.title}</h2>
                </div>
              </div>
            </div>
            <div className="p-6 flex-1 space-y-6">
              {isDetailsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500"><Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-2"/><p className="text-xs">Consultando base de datos mundial...</p></div>
              ) : detailsExtraInfo ? (
                <>
                  {detailsExtraInfo.synopsis && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5"><BookOpen size={14}/> Sinopsis</h4>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-[#1e293b] p-4 rounded-2xl border border-slate-800">{detailsExtraInfo.synopsis}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Estudio</p><p className="text-xs font-semibold text-slate-200 truncate">{detailsExtraInfo.studios?.[0]?.name || 'Desconocido'}</p>
                    </div>
                    <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Origen</p><p className="text-xs font-semibold text-slate-200">{detailsExtraInfo.source || 'Original'}</p>
                    </div>
                    <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Popularidad / MAL ID</p><p className="text-xs font-semibold text-slate-200">#{detailsExtraInfo.popularity || '?'} (ID: {detailsExtraInfo.mal_id})</p>
                    </div>
                    <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Estado de Emisión</p><p className="text-xs font-semibold text-slate-200">{detailsExtraInfo.status}</p>
                    </div>
                  </div>
                  {selectedDetails.notes && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5"><MessageSquare size={14}/> Tus Notas</h4>
                      <p className="text-xs text-slate-300 italic bg-indigo-500/5 p-3.5 rounded-xl border border-indigo-500/20">{selectedDetails.notes}</p>
                    </div>
                  )}
                  {detailsExtraInfo.genres && (
                    <div className="flex flex-wrap gap-1.5">
                      {detailsExtraInfo.genres.map(g => (<span key={g.mal_id} className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">{g.name}</span>))}
                    </div>
                  )}
                  {detailsExtraInfo.trailer?.url && (
                    <a href={detailsExtraInfo.trailer.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 bg-red-600/10 hover:bg-red-600 border border-red-500/30 hover:border-red-600 text-red-400 hover:text-white rounded-2xl text-xs sm:text-sm font-bold transition-all">Ver Tráiler Oficial en YouTube <ArrowUpRight size={16}/></a>
                  )}
                </>
              ) : (
                <div className="text-center py-8"><Compass className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50"/><p className="text-xs text-slate-400">No hay información adicional disponible.</p></div>
              )}
            </div>
            <div className="p-6 border-t border-slate-800 bg-[#0f172a]">
              <div className="flex gap-3">
                <button onClick={() => setSelectedDetails(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-400 transition-colors">Cerrar Ficha</button>
                {viewingSharedList ? (
                  <button onClick={() => handleCloneAnime(selectedDetails)} className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1">Clonar Anime</button>
                ) : (
                  <button onClick={() => { setSelectedDetails(null); handleOpenModal(selectedDetails); }} className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold text-white transition-colors">Editar Anime</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE FELICITACIÓN --- */}
      {celebrationAnime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-md" onClick={() => setCelebrationAnime(null)} />
          <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-[#0f172a] border-2 border-yellow-500/40 p-8 rounded-3xl text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto bg-yellow-500/15 rounded-full flex items-center justify-center text-yellow-400 border border-yellow-500/30 mb-4 animate-bounce"><Trophy size={32}/></div>
            <h2 className="text-2xl font-black text-yellow-400 mb-1 flex items-center justify-center gap-1.5"><Sparkles size={22}/> ¡Felicidades! <Sparkles size={22}/></h2>
            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-4">Completaste un Anime</p>
            <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-800 mb-6 flex flex-col items-center">
              <img src={celebrationAnime.coverUrl} className="w-24 h-36 object-cover rounded-xl border border-slate-700 shadow-xl mb-3" />
              <h3 className="font-bold text-white text-base leading-snug">{celebrationAnime.title}</h3>
              <p className="text-xs text-slate-400 mt-1">Acabas de terminar de ver los {celebrationAnime.totalEpisodes} episodios.</p>
            </div>
            <button onClick={() => setCelebrationAnime(null)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-3 rounded-xl text-sm transition-all">¡Seguir Maratoneando!</button>
          </div>
        </div>
      )}

      {/* --- MODAL PARA AÑADIR/EDITAR --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative w-full max-w-xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-[#0f172a]/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">{editingId ? 'Editar Anime' : 'Añadir a mi lista'}</h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              {!editingId && (
                <div className="relative">
                  <label className="block text-sm font-bold text-purple-400 mb-2">Buscar Anime (MyAnimeList)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={apiSearchQuery} onChange={(e) => setApiSearchQuery(e.target.value)} placeholder="Escribe para buscar portadas y géneros..." className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 pl-10 text-slate-200 focus:outline-none focus:border-purple-500 transition-all text-sm" />
                    {isSearchingApi && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-500" />}
                  </div>
                  {apiResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-[#1e293b] border border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2">
                      {apiResults.map(anime => (
                        <button key={anime.mal_id} type="button" onClick={() => selectApiResult(anime)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 transition-colors border-b border-slate-700 last:border-0">
                          <img src={anime.images.jpg.small_image_url} className="w-10 h-14 object-cover rounded shadow" alt="cover" />
                          <div className="text-left">
                            <div className="text-sm font-bold text-slate-100 line-clamp-1">{anime.title}</div>
                            <div className="text-xs text-slate-500">{anime.type} • {anime.episodes || '?'} EP • {anime.year || ''}</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-600 ml-auto" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {errorMsg && <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium">{errorMsg}</div>}
              <div className="space-y-4 border-t border-slate-800/50 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Información Manual</p>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Título del Anime *</label>
                  <input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="Ej. Shingeki no Kyojin" className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Estado</label>
                    <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 appearance-none">
                      {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Calificación (0-10)</label>
                    <div className="relative">
                      <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500" />
                      <input type="number" min="0" max="10" value={formData.rating} onChange={(e) => setFormData({...formData, rating: Number(e.target.value)})} className="w-full bg-[#1e293b] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Episodios Vistos</label>
                    <input type="number" min="0" value={formData.progress} onChange={(e) => setFormData({...formData, progress: Number(e.target.value)})} className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Total Episodios</label>
                    <input type="number" min="0" value={formData.totalEpisodes} onChange={(e) => setFormData({...formData, totalEpisodes: Number(e.target.value)})} className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Link de visualización (Opcional)</label>
                  <input type="url" value={formData.watchUrl} onChange={(e) => setFormData({...formData, watchUrl: e.target.value})} placeholder="https://..." className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Notas personales (Opcional)</label>
                  <textarea rows="3" value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="Escribe tus impresiones del anime..." className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all text-sm" />
                </div>
                <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700">
                  <label className="block text-sm font-medium text-slate-300 mb-3">URL de la Portada</label>
                  <input type="url" value={formData.coverUrl} onChange={(e) => setFormData({...formData, coverUrl: e.target.value})} placeholder="Pega una URL de imagen..." className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-purple-500 transition-all" />
                  {formData.coverUrl && (
                    <div className="mt-4 flex justify-center">
                      <img src={formData.coverUrl} alt="Preview" className="h-32 rounded-lg object-cover border border-slate-700 shadow-lg" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-800 bg-[#0f172a] flex justify-end gap-3">
              <button onClick={handleCloseModal} className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancelar</button>
              <button onClick={handleSave} className="px-8 py-2.5 rounded-xl text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-600/20">{editingId ? 'Actualizar' : 'Guardar Anime'}</button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER COMPACTO */}
      <footer className="text-center py-8 text-xs text-slate-600 border-t border-slate-900 mt-12 bg-[#0f172a]">
        <p className="font-semibold">AniTracker Premium Suite © 2026</p>
        <p className="mt-1">Gestiona, rastrea y comparte tu pasión por el Anime.</p>
      </footer>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}} />
    </div>
  );
}

// Icono simple para PieChart
function PieChartIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

// Componente de Cuenta Regresiva (Calcula JST -> Hora Local automáticamente)
function CountdownTimer({ broadcast }) {
  const [timeLeft, setTimeLeft] = useState('Calculando...');

  useEffect(() => {
    if (!broadcast || !broadcast.day || !broadcast.time) {
      setTimeLeft('Horario de emisión desconocido');
      return;
    }

    const calculateTimeLeft = () => {
      const daysMap = { 
        'Sundays': 0, 'Mondays': 1, 'Tuesdays': 2, 'Wednesdays': 3, 'Thursdays': 4, 'Fridays': 5, 'Saturdays': 6,
        'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
      };
      const targetDay = daysMap[broadcast.day];
      if (targetDay === undefined) return 'Horario desconocido';

      const [hours, minutes] = broadcast.time.split(':').map(Number);
      
      const now = new Date();
      const tokyoStr = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
      const tokyoNow = new Date(tokyoStr);

      let target = new Date(tokyoNow);
      target.setHours(hours, minutes, 0, 0);

      let daysToAdd = targetDay - tokyoNow.getDay();
      if (daysToAdd < 0 || (daysToAdd === 0 && target.getTime() <= tokyoNow.getTime())) {
        daysToAdd += 7;
      }
      target.setDate(target.getDate() + daysToAdd);

      const diff = target.getTime() - tokyoNow.getTime();
      if (diff <= 0) return '¡Emitiéndose ahora!';

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);

      return `${d}d ${h}h ${m}m ${s}s`;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [broadcast]);

  return <>{timeLeft}</>;
}
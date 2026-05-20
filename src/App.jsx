import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Edit3, Trash2, ExternalLink, Image as ImageIcon, 
  PlayCircle, Clock, CheckCircle2, PauseCircle, XCircle, 
  Tv, Star, X, Loader2, ChevronRight, BarChart3, Trophy, 
  Clock as ClockIcon, Target, Flame, Medal, Download, Compass,
  LayoutGrid, List, Calendar, Upload
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// Configuración de Firebase en la Nube
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

export default function App() {
  const [animes, setAnimes] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState('list'); // 'list', 'stats', o 'catalog'
  const [listLayout, setListLayout] = useState('grid'); // 'grid' o 'list'
  
  const [user, setUser] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '', status: 'Viendo', progress: 0, totalEpisodes: 0, watchUrl: '', coverUrl: '', rating: 0, duration: 24, genres: []
  });
  
  // Search API State (Modal)
  const [apiSearchQuery, setApiSearchQuery] = useState('');
  const [apiResults, setApiResults] = useState([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Catalog State
  const [catalogAnimes, setCatalogAnimes] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  // Calendar State
  const [calendarAnimes, setCalendarAnimes] = useState([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 }); // NUEVO: Estado de progreso
  const fileInputRef = useRef(null);

  // --- AUTENTICACIÓN ---
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error con Google Auth:", error);
      setErrorMsg("No se pudo iniciar sesión con Google.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    } catch (error) { console.error("Error al cerrar sesión:", error); }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Error de autenticación:", error); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // --- BASE DE DATOS ---
  useEffect(() => {
    if (!user) { setLoadingData(false); return; }
    
    const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
    const unsubscribe = onSnapshot(animesRef, (snapshot) => {
      const fetchedAnimes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedAnimes.sort((a, b) => b.id.localeCompare(a.id));
      setAnimes(fetchedAnimes);
      setLoadingData(false);
    }, (error) => {
      console.error("Error al obtener datos:", error);
      setLoadingData(false);
    });
    return () => unsubscribe();
  }, [user]);

  // --- BUSCADOR JIKAN API (Modal) ---
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
      duration: parsedDuration
    });
    setApiResults([]);
    setApiSearchQuery('');
  };

  // --- CATÁLOGO GLOBAL (JIKAN API) ---
  useEffect(() => {
    if (currentView !== 'catalog') return;
    
    const fetchCatalog = async () => {
      setIsCatalogLoading(true);
      try {
        let url = 'https://api.jikan.moe/v4/top/anime?limit=24'; // Top animes por defecto
        if (catalogSearch.trim().length > 2) {
          url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(catalogSearch)}&limit=24`;
        }
        const res = await fetch(url);
        const data = await res.json();
        setCatalogAnimes(data.data || []);
      } catch (error) {
        console.error("Error fetching catalog:", error);
      } finally {
        setIsCatalogLoading(false);
      }
    };

    const timer = setTimeout(() => { fetchCatalog(); }, 500);
    return () => clearTimeout(timer);
  }, [currentView, catalogSearch]);

  const handleAddFromCatalog = (anime) => {
    let parsedDuration = 24;
    if (anime.duration) {
      const match = anime.duration.match(/(\d+)\s*min/);
      if (match) parsedDuration = parseInt(match[1], 10);
    }

    setFormData({
      title: anime.title,
      status: 'Pendiente', // Lo añadimos como pendiente por defecto
      progress: 0,
      totalEpisodes: anime.episodes || 0,
      watchUrl: '',
      coverUrl: anime.images?.jpg?.large_image_url || '',
      rating: 0,
      duration: parsedDuration,
      genres: anime.genres ? anime.genres.map(g => g.name) : []
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  // --- CALENDARIO DE ESTRENOS ---
  useEffect(() => {
    if (currentView !== 'calendar') return;
    
    let isActive = true;
    const fetchViendoSchedules = async () => {
      setIsCalendarLoading(true);
      const viendoAnimes = animes.filter(a => a.status === 'Viendo');
      const schedules = [];
      
      for (const anime of viendoAnimes) {
        if (!isActive) break;
        try {
          const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(anime.title)}&status=airing&limit=1`);
          const data = await res.json();
          
          if (data.data && data.data.length > 0 && data.data[0].broadcast?.day) {
             schedules.push({
               ...anime,
               broadcast: data.data[0].broadcast,
               apiEpisodes: data.data[0].episodes
             });
          }
          // Retraso seguro de la API (Jikan permite 3 peticiones por segundo)
          await new Promise(r => setTimeout(r, 350));
        } catch (e) {
          console.error(e);
        }
      }
      
      if (isActive) {
        setCalendarAnimes(schedules);
        setIsCalendarLoading(false);
      }
    };

    fetchViendoSchedules();
    return () => { isActive = false; };
  }, [currentView, animes]);

  // --- CÁLCULO DE ESTADÍSTICAS ---
  const stats = useMemo(() => {
    let totalEps = 0;
    let totalMinutes = 0;
    let completedCount = 0;
    let genreCounts = {};

    animes.forEach(a => {
      const eps = a.progress || 0;
      totalEps += eps;
      totalMinutes += eps * (a.duration || 24);

      if (a.status === 'Terminado') completedCount++;

      if (a.genres && eps > 0) {
        a.genres.forEach(g => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      }
    });

    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);

    const sortedGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); 
    const maxGenreCount = sortedGenres.length > 0 ? sortedGenres[0][1] : 1;

    const achievements = [
      { id: 1, title: 'Otaku Novato', desc: 'Añade tu primer anime', unlocked: animes.length >= 1, icon: Star },
      { id: 2, title: 'Maratonista', desc: 'Mira 100 episodios en total', unlocked: totalEps >= 100, icon: Flame },
      { id: 3, title: 'Coleccionista', desc: 'Ten 10 animes en tu lista', unlocked: animes.length >= 10, icon: Target },
      { id: 4, title: 'Completista', desc: 'Termina 5 animes', unlocked: completedCount >= 5, icon: CheckCircle2 },
      { id: 5, title: 'Amante del Shounen', desc: 'Mira un anime Shounen', unlocked: Object.keys(genreCounts).includes('Shounen'), icon: Trophy },
      { id: 6, title: 'Sin Vida Social', desc: 'Acumula 5 días de visualización', unlocked: days >= 5, icon: Medal },
    ];

    return { totalEps, days, hours, topGenres: sortedGenres, maxGenreCount, achievements, completedCount };
  }, [animes]);

  // --- FUNCIONES UI ---
  const filteredAnimes = animes.filter(anime => {
    const matchesSearch = (anime.title || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    const matchesFilter = activeFilter === 'Todos' || anime.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const handleOpenModal = (anime = null) => {
    setErrorMsg('');
    setApiResults([]);
    setApiSearchQuery('');
    if (anime) {
      setFormData({
        title: anime.title || '',
        status: anime.status || 'Viendo',
        progress: anime.progress || 0,
        totalEpisodes: anime.totalEpisodes || 12,
        watchUrl: anime.watchUrl || '',
        coverUrl: anime.coverUrl || '',
        rating: anime.rating || 0,
        duration: anime.duration || 24,
        genres: anime.genres || []
      });
      setEditingId(anime.id);
    } else {
      setFormData({ title: '', status: 'Viendo', progress: 0, totalEpisodes: 0, watchUrl: '', coverUrl: '', rating: 0, duration: 24, genres: [] });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return setErrorMsg('El título es obligatorio.');
    if (!user) return setErrorMsg('No estás conectado. Recarga la página.');

    try {
      const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
      await setDoc(doc(animesRef, editingId || Date.now().toString()), formData);
      handleCloseModal();
    } catch (error) { setErrorMsg('Error al guardar en la nube.'); }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try { 
      const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
      await deleteDoc(doc(animesRef, id)); 
    } catch (error) {}
  };

  // --- IMPORTAR DESDE MYANIMELIST/ANILIST (XML) ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: 0 });
    try {
      const text = await file.text();
      
      if (!file.name.toLowerCase().endsWith('.xml')) {
         alert("El archivo debe ser un .xml exportado de MyAnimeList o AniList.");
         setIsImporting(false);
         return;
      }

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      const animeNodes = xmlDoc.getElementsByTagName("anime");
      
      const animesToProcess = [];
      for (let i = 0; i < animeNodes.length; i++) {
        const node = animeNodes[i];
        
        // Función auxiliar para leer etiquetas y limpiar CDATA
        const getVal = (tag) => {
          let val = node.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
          return val.replace(/^<!\[CDATA\[(.*)\]\]>$/, '$1'); 
        };

        const malId = getVal("series_animedb_id");
        const title = getVal("series_title") || 'Desconocido';
        const progress = parseInt(getVal("my_watched_episodes")) || 0;
        const totalEpisodes = parseInt(getVal("series_episodes")) || 0;
        
        // Detección Inteligente de Estado (Soporta IDs numéricos y textos de AniList)
        const rawStatus = getVal("my_status").toLowerCase();
        let status = 'Pendiente';
        if (['1', 'watching', 'current'].includes(rawStatus)) status = 'Viendo';
        else if (['2', 'completed'].includes(rawStatus)) status = 'Terminado';
        else if (['3', 'on-hold', 'paused'].includes(rawStatus)) status = 'Pausado';
        else if (['4', 'dropped'].includes(rawStatus)) status = 'Abandonado';
        else if (['6', 'plan to watch', 'planning'].includes(rawStatus)) status = 'Pendiente';

        // Detección de calificación (Convierte la escala de 100 de AniList a escala de 10 automáticamente)
        let rating = parseFloat(getVal("my_score")) || 0;
        if (rating > 10) rating = Math.round(rating / 10);

        let coverUrl = getVal("series_image") || getVal("anime_image_path") || '';
        
        animesToProcess.push({ 
          malId, title, progress, totalEpisodes, status, rating, 
          coverUrl, duration: 24, watchUrl: '', genres: [] 
        });
      }

      if (animesToProcess.length === 0) {
         alert("No se encontraron animes en el archivo.");
         setIsImporting(false);
         return;
      }

      setImportProgress({ current: 0, total: animesToProcess.length });
      const finalAnimes = [];

      // Descarga de portadas profundas (Si el XML no trae la foto, la buscamos por su ID)
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
              // Retraso de seguridad (400ms) para que la API no nos bloquee por descargar rápido
              await new Promise(r => setTimeout(r, 400));
           } catch (err) {
              console.error("Error descargando portada de", anime.title);
           }
         }
         finalAnimes.push(anime);
      }

      // Guardar todo en Firebase de forma segura
      if (user) {
        const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
        const savePromises = finalAnimes.map(anime => 
          setDoc(doc(animesRef, Date.now().toString() + Math.random().toString(36).substring(2, 9)), anime)
        );
        await Promise.all(savePromises);
        alert(`¡Éxito! Se han importado ${finalAnimes.length} animes con sus imágenes, estados y calificaciones correctamente.`);
      }
    } catch (err) {
      console.error(err);
      alert("Hubo un error al procesar el archivo. Verifica que sea un XML válido.");
    } finally {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0 });
      e.target.value = null; 
    }
  };

  const exportToCSV = () => {
    if (animes.length === 0) return;
    const headers = ['Título', 'Estado', 'Progreso', 'Total Episodios', 'Calificación', 'Géneros', 'URL de Portada'];
    const csvRows = [headers.join(',')];

    animes.forEach(anime => {
      const row = [
        `"${(anime.title || '').replace(/"/g, '""')}"`, 
        `"${anime.status || ''}"`,
        anime.progress || 0,
        anime.totalEpisodes || 0,
        anime.rating || 0,
        `"${(anime.genres || []).join(', ')}"`,
        `"${anime.coverUrl || ''}"`
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
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-purple-500/30 pb-10">
      
      {/* HEADER PRINCIPAL */}
      <header className="sticky top-0 z-20 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            
            <div className="flex items-center gap-3 w-full lg:w-auto justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Tv className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-300">
                  AniTracker
                </h1>
              </div>

              {/* Toggles Vista Móvil */}
              <div className="flex overflow-x-auto hide-scrollbar bg-slate-800/50 p-1 rounded-xl lg:hidden max-w-[50vw]">
                <button onClick={() => setCurrentView('list')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentView === 'list' ? 'bg-purple-600 text-white shadow' : 'text-slate-400'}`}>Mi Lista</button>
                <button onClick={() => setCurrentView('catalog')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${currentView === 'catalog' ? 'bg-pink-600 text-white shadow' : 'text-slate-400'}`}><Compass size={14}/>Catálogo</button>
                <button onClick={() => setCurrentView('calendar')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${currentView === 'calendar' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'}`}><Calendar size={14}/>Calendario</button>
                <button onClick={() => setCurrentView('stats')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${currentView === 'stats' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}><BarChart3 size={14}/>Stats</button>
              </div>
            </div>

            <div className="flex flex-wrap md:flex-nowrap w-full lg:w-auto items-center justify-end gap-3">
              
              {/* Toggles Vista Escritorio */}
              <div className="hidden lg:flex bg-slate-800/50 p-1 rounded-xl mr-2">
                <button onClick={() => setCurrentView('list')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentView === 'list' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Mi Lista</button>
                <button onClick={() => setCurrentView('catalog')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1 ${currentView === 'catalog' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Compass size={16}/>Catálogo</button>
                <button onClick={() => setCurrentView('calendar')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1 ${currentView === 'calendar' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Calendar size={16}/>Calendario</button>
                <button onClick={() => setCurrentView('stats')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1 ${currentView === 'stats' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><BarChart3 size={16}/>Estadísticas</button>
              </div>

              {/* Autenticación */}
              {user && !user.isAnonymous ? (
                <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full">
                  <img src={user.photoURL || 'https://via.placeholder.com/32'} alt="Perfil" className="w-7 h-7 rounded-full" />
                  <span className="text-sm font-medium text-slate-200 hidden lg:block max-w-[120px] truncate">
                    {user.displayName || 'Usuario'}
                  </span>
                  <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors ml-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={handleGoogleLogin} className="flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-full text-sm font-bold transition-all shadow-md">
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="hidden sm:inline">Google Login</span>
                </button>
              )}

              {currentView === 'list' && (
                <>
                  <div className="relative w-full sm:w-auto flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" placeholder="Filtrar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:w-40 bg-slate-800/50 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                  
                  {/* Toggles de Vista Grid/Lista */}
                  <div className="flex shrink-0 bg-slate-800 border border-slate-700 rounded-full p-1">
                    <button onClick={() => setListLayout('grid')} className={`p-1.5 rounded-full transition-all ${listLayout === 'grid' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button onClick={() => setListLayout('list')} className={`p-1.5 rounded-full transition-all ${listLayout === 'list' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                      <List className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Botones de Importación y Exportación */}
                  <input type="file" accept=".xml" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isImporting || !user} title="Importar lista (XML)" className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-4 py-2 rounded-full text-sm font-bold transition-all border border-slate-700 shadow-md">
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span className="hidden sm:inline">
                      {isImporting && importProgress.total > 0 
                        ? `Importando... ${importProgress.current}/${importProgress.total}` 
                        : (isImporting ? 'Cargando...' : 'Importar')}
                    </span>
                  </button>

                  <button onClick={exportToCSV} disabled={animes.length === 0} title="Exportar a Excel/CSV" className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-4 py-2 rounded-full text-sm font-bold transition-all border border-slate-700 shadow-md">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Exportar</span>
                  </button>

                  <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-full text-sm font-bold transition-all shadow-lg shadow-purple-600/20">
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Añadir</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {currentView === 'list' && (
            <div className="flex overflow-x-auto hide-scrollbar gap-2 mt-6 pb-2">
              {['Todos', ...Object.keys(STATUS_CONFIG)].map(status => (
                <button
                  key={status} onClick={() => setActiveFilter(status)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    activeFilter === status ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* --- VISTA: CATÁLOGO MUNDIAL --- */}
      {currentView === 'catalog' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <Compass className="text-pink-500 w-8 h-8" />
                Catálogo Global
              </h2>
              <p className="text-slate-400 mt-2">Explora todos los animes del mundo y añádelos directamente a tu lista.</p>
            </div>
            
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" placeholder="Buscar nuevos animes..." 
                value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-full py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-pink-500 transition-all shadow-lg"
              />
            </div>
          </div>

          {isCatalogLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-12 h-12 mb-4 animate-spin text-pink-500" />
              <p className="font-medium">Explorando MyAnimeList...</p>
            </div>
          ) : catalogAnimes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Compass className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">No se encontraron resultados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6">
              {catalogAnimes.map(anime => (
                <div key={anime.mal_id} className="group relative bg-[#1e293b] rounded-xl sm:rounded-2xl overflow-hidden border border-slate-700/50 hover:border-pink-500/50 transition-all duration-300 flex flex-col hover:shadow-xl hover:shadow-pink-500/10">
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-800">
                    <img 
                      src={anime.images?.jpg?.large_image_url || 'https://via.placeholder.com/400x600'} 
                      alt={anime.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/10 to-transparent opacity-90" />
                    
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-slate-900/80 backdrop-blur-md px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg flex items-center gap-1 border border-slate-700">
                      <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-[10px] sm:text-xs font-bold text-white">{anime.score || 'N/A'}</span>
                    </div>

                    <div className="absolute bottom-0 left-0 w-full p-2 sm:p-3">
                      <h3 className="text-xs sm:text-base font-bold text-white line-clamp-2 leading-tight mb-0.5 sm:mb-1 drop-shadow-md">
                        {anime.title}
                      </h3>
                      <div className="text-[9px] sm:text-xs text-slate-300 font-medium">
                        {anime.year || anime.status} • {anime.episodes ? `${anime.episodes} EPS` : '? EPS'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-2 sm:p-3 bg-slate-800 flex-1 flex flex-col justify-end border-t border-slate-700/50">
                    <button 
                      onClick={() => handleAddFromCatalog(anime)}
                      className="w-full flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-700 hover:bg-pink-600 text-white py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold transition-colors"
                    >
                      <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Añadir a mi lista</span>
                      <span className="sm:hidden">Añadir</span>
                    </button>
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
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              <Calendar className="text-emerald-500 w-8 h-8" />
              Calendario de Estrenos
            </h2>
            <p className="text-slate-400 mt-2">Cuenta regresiva exacta para los próximos episodios de los animes que estás viendo actualmente.</p>
          </div>

          {isCalendarLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-12 h-12 mb-4 animate-spin text-emerald-500" />
              <p className="font-medium">Sincronizando horarios con Japón...</p>
            </div>
          ) : calendarAnimes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-[#1e293b] rounded-3xl border border-slate-700/50 p-8 text-center max-w-2xl mx-auto shadow-xl">
              <Calendar className="w-16 h-16 mb-4 opacity-20 text-emerald-500" />
              <p className="text-xl font-bold text-slate-300 mb-2">No hay estrenos próximos</p>
              <p className="text-sm text-slate-400">Asegúrate de tener animes en estado <span className="text-purple-400 font-bold">"Viendo"</span> que estén en emisión actualmente para verlos aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {calendarAnimes.map(anime => (
                <div key={anime.id} className="bg-[#1e293b] border border-slate-700/50 p-5 rounded-2xl flex items-center gap-5 hover:border-emerald-500/50 transition-colors hover:shadow-xl hover:shadow-emerald-500/10 group">
                  <div className="relative shrink-0">
                    <img src={anime.coverUrl} alt={anime.title} className="w-24 h-32 object-cover rounded-xl shadow-md group-hover:scale-105 transition-transform" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x600/1e293b/475569?text=Sin+Portada' }}/>
                    <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                      EP {anime.progress + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white line-clamp-2 mb-1" title={anime.title}>{anime.title}</h3>
                    <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {anime.broadcast.day} a las {anime.broadcast.time} (JST)
                    </div>
                    <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700/50">
                      <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-bold mb-1">Se estrena en:</p>
                      <div className="text-slate-100 font-mono font-bold text-sm sm:text-base">
                        <CountdownTimer broadcast={anime.broadcast} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* --- VISTA: DASHBOARD DE ESTADÍSTICAS --- */}
      {currentView === 'stats' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="text-indigo-500 w-8 h-8" />
              Tu Panel de Otaku
            </h2>
            <p className="text-slate-400 mt-2">Un resumen de todo tu progreso y tiempo invertido.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-indigo-900/40 to-slate-800 border border-indigo-500/30 p-6 rounded-3xl relative overflow-hidden">
              <ClockIcon className="absolute -right-4 -bottom-4 w-32 h-32 text-indigo-500/10" />
              <div className="relative z-10">
                <p className="text-indigo-400 font-bold mb-1 text-sm uppercase tracking-wider">Tiempo Invertido</p>
                <div className="flex items-end gap-2 text-white">
                  <span className="text-5xl font-black">{stats.days}</span>
                  <span className="text-lg font-medium text-slate-300 pb-1">días</span>
                  <span className="text-5xl font-black ml-2">{stats.hours}</span>
                  <span className="text-lg font-medium text-slate-300 pb-1">hrs</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/40 to-slate-800 border border-purple-500/30 p-6 rounded-3xl relative overflow-hidden">
              <Tv className="absolute -right-4 -bottom-4 w-32 h-32 text-purple-500/10" />
              <div className="relative z-10">
                <p className="text-purple-400 font-bold mb-1 text-sm uppercase tracking-wider">Episodios Vistos</p>
                <div className="flex items-end gap-2 text-white">
                  <span className="text-5xl font-black">{stats.totalEps}</span>
                  <span className="text-lg font-medium text-slate-300 pb-1">eps</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-900/40 to-slate-800 border border-green-500/30 p-6 rounded-3xl relative overflow-hidden">
              <CheckCircle2 className="absolute -right-4 -bottom-4 w-32 h-32 text-green-500/10" />
              <div className="relative z-10">
                <p className="text-green-400 font-bold mb-1 text-sm uppercase tracking-wider">Animes Terminados</p>
                <div className="flex items-end gap-2 text-white">
                  <span className="text-5xl font-black">{stats.completedCount}</span>
                  <span className="text-lg font-medium text-slate-300 pb-1">series</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1e293b] border border-slate-700/50 p-6 rounded-3xl">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-pink-400" /> Géneros Más Vistos
              </h3>
              {stats.topGenres.length === 0 ? (
                <p className="text-slate-500 text-center py-10">Añade animes usando el buscador para ver tus géneros favoritos.</p>
              ) : (
                <div className="space-y-4">
                  {stats.topGenres.map(([genre, count], idx) => {
                    const percent = Math.round((count / stats.maxGenreCount) * 100);
                    const colors = ['bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500', 'bg-emerald-500'];
                    return (
                      <div key={genre}>
                        <div className="flex justify-between text-sm font-medium text-slate-300 mb-1">
                          <span>{genre}</span>
                          <span>{count} animes</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${colors[idx % colors.length]} transition-all duration-1000`} 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-[#1e293b] border border-slate-700/50 p-6 rounded-3xl">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" /> Sistema de Logros
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {stats.achievements.map(ach => {
                  const AchIcon = ach.icon;
                  return (
                    <div key={ach.id} className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                      ach.unlocked 
                        ? 'bg-yellow-500/10 border-yellow-500/30' 
                        : 'bg-slate-800/50 border-slate-700/50 opacity-50 grayscale'
                    }`}>
                      <div className={`p-2 rounded-full ${ach.unlocked ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400'}`}>
                        <AchIcon className="w-5 h-5" />
                      </div>
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

      {/* --- VISTA: LISTA DE ANIME --- */}
      {currentView === 'list' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4">
          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-12 h-12 mb-4 animate-spin text-purple-500" />
              <p className="font-medium">Sincronizando con la nube...</p>
            </div>
          ) : filteredAnimes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Tv className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">No hay animes en tu lista.</p>
              <button onClick={() => setCurrentView('catalog')} className="mt-4 text-purple-400 hover:text-purple-300 font-semibold">
                ¡Explora el catálogo para añadir uno!
              </button>
            </div>
          ) : (
            <div className={listLayout === 'grid' ? "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6" : "flex flex-col gap-3 sm:gap-4"}>
              {filteredAnimes.map(anime => {
                const statusConf = STATUS_CONFIG[anime.status];
                const StatusIcon = statusConf.icon;
                const progressPercent = anime.totalEpisodes ? Math.min(100, Math.round((anime.progress / anime.totalEpisodes) * 100)) : 0;

                if (listLayout === 'grid') {
                  return (
                    <div key={anime.id} className="group relative bg-[#1e293b] rounded-xl sm:rounded-2xl overflow-hidden border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10">
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-800">
                        {anime.coverUrl ? (
                          <img src={anime.coverUrl} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x600/1e293b/475569?text=Sin+Portada' }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600"><ImageIcon className="w-8 h-8 sm:w-12 sm:h-12" /></div>
                        )}
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-80" />
                        
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col sm:flex-row gap-1.5 sm:gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenModal(anime)} className="p-1.5 sm:p-2 bg-black/60 backdrop-blur rounded-full hover:bg-purple-600 text-white transition-colors"><Edit3 className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                          <button onClick={() => handleDelete(anime.id)} className="p-1.5 sm:p-2 bg-black/60 backdrop-blur rounded-full hover:bg-red-600 text-white transition-colors"><Trash2 className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                        </div>

                        <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
                          <div className={`flex items-center gap-1 sm:gap-1.5 px-1.5 py-1 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-semibold backdrop-blur-md ${statusConf.bg} ${statusConf.color} border ${statusConf.border}`}>
                            <StatusIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> 
                            <span className="hidden sm:inline">{anime.status}</span>
                          </div>
                        </div>

                        <div className="absolute bottom-0 left-0 w-full p-2 sm:p-4">
                          <h3 className="text-xs sm:text-lg font-bold text-white line-clamp-2 leading-tight mb-1 sm:mb-2 drop-shadow-md">{anime.title}</h3>
                          <div className="space-y-1 sm:space-y-1.5">
                            <div className="flex justify-between text-[9px] sm:text-xs text-slate-300 font-medium">
                              <span>EP {anime.progress} <span className="hidden sm:inline">/ {anime.totalEpisodes || '?'}</span></span>
                              <span>{progressPercent}%</span>
                            </div>
                            <div className="h-1 sm:h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${anime.status === 'Terminado' ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${progressPercent}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                      {anime.watchUrl && (
                        <div className="bg-slate-800/50 p-2 sm:p-3 border-t border-slate-700/50 hidden sm:block">
                          <a href={anime.watchUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-1.5 sm:py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-colors">
                            Ir al sitio <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                }

                // VISTA DE LISTA (HORIZONTAL)
                return (
                  <div key={anime.id} className="group flex flex-row bg-[#1e293b] rounded-xl sm:rounded-2xl overflow-hidden border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10">
                    <div className="relative w-24 sm:w-32 shrink-0 bg-slate-800">
                      {anime.coverUrl ? (
                        <img src={anime.coverUrl} alt={anime.title} className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x600/1e293b/475569?text=Sin+Portada' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600"><ImageIcon className="w-8 h-8" /></div>
                      )}
                    </div>
                    
                    <div className="flex-1 p-3 sm:p-5 flex flex-col justify-between min-w-0">
                      <div className="flex justify-between items-start gap-2 sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                            <div className={`flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${statusConf.bg} ${statusConf.color} border ${statusConf.border} w-fit`}>
                              <StatusIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {anime.status}
                            </div>
                          </div>
                          <h3 className="text-sm sm:text-xl font-bold text-white mb-0.5 sm:mb-1 line-clamp-2 leading-tight">{anime.title}</h3>
                          {anime.genres && anime.genres.length > 0 && (
                            <p className="text-[10px] sm:text-xs text-slate-400 truncate">{anime.genres.slice(0,3).join(', ')}</p>
                          )}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2 shrink-0">
                          <button onClick={() => handleOpenModal(anime)} className="p-1.5 sm:p-2 bg-slate-800 hover:bg-purple-600 rounded-lg sm:rounded-xl text-white transition-colors" title="Editar"><Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                          <button onClick={() => handleDelete(anime.id)} className="p-1.5 sm:p-2 bg-slate-800 hover:bg-red-600 rounded-lg sm:rounded-xl text-white transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                          {anime.watchUrl && (
                            <a href={anime.watchUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 sm:p-2 bg-slate-800 hover:bg-blue-600 rounded-lg sm:rounded-xl text-white transition-colors" title="Ver Anime">
                              <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-2 sm:mt-4 w-full">
                        <div className="flex justify-between text-[10px] sm:text-xs text-slate-300 font-medium mb-1 sm:mb-1.5">
                          <span>Episodios: {anime.progress} / {anime.totalEpisodes || '?'}</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <div className="h-1.5 sm:h-2 w-full bg-slate-700/50 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${anime.status === 'Terminado' ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${progressPercent}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* --- MODAL PARA AÑADIR/EDITAR --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={handleCloseModal} />
          
          <div className="relative w-full max-w-xl bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-800/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {editingId ? 'Editar Anime' : 'Añadir a mi lista'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              
              {!editingId && (
                <div className="relative">
                  <label className="block text-sm font-bold text-purple-400 mb-2">Buscar Anime (MyAnimeList)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" value={apiSearchQuery} onChange={(e) => setApiSearchQuery(e.target.value)}
                      placeholder="Escribe para buscar portadas y géneros..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 pl-10 text-slate-200 focus:outline-none focus:border-purple-500 transition-all"
                    />
                    {isSearchingApi && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-500" />}
                  </div>

                  {apiResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2">
                      {apiResults.map(anime => (
                        <button key={anime.mal_id} onClick={() => selectApiResult(anime)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0">
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

              <div className="space-y-4 border-t border-slate-700/50 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Información Manual</p>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Título del Anime *</label>
                  <input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="Ej. Shingeki no Kyojin" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Estado</label>
                    <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 appearance-none">
                      {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Calificación (0-10)</label>
                    <div className="relative">
                      <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500" />
                      <input type="number" min="0" max="10" value={formData.rating} onChange={(e) => setFormData({...formData, rating: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Episodios Vistos</label>
                    <input type="number" min="0" value={formData.progress} onChange={(e) => setFormData({...formData, progress: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Total Episodios</label>
                    <input type="number" min="0" value={formData.totalEpisodes} onChange={(e) => setFormData({...formData, totalEpisodes: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Link de visualización (Opcional)</label>
                  <input type="url" value={formData.watchUrl} onChange={(e) => setFormData({...formData, watchUrl: e.target.value})} placeholder="https://..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all" />
                </div>

                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                  <label className="block text-sm font-medium text-slate-300 mb-3">URL de la Portada</label>
                  <input type="url" value={formData.coverUrl} onChange={(e) => setFormData({...formData, coverUrl: e.target.value})} placeholder="Pega una URL de imagen..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-purple-500 transition-all" />
                  {formData.coverUrl && (
                    <div className="mt-4 flex justify-center">
                      <img src={formData.coverUrl} alt="Preview" className="h-32 rounded-lg object-cover border border-slate-700 shadow-lg" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
              <button onClick={handleCloseModal} className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancelar</button>
              <button onClick={handleSave} className="px-8 py-2.5 rounded-xl text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-600/20">{editingId ? 'Actualizar' : 'Guardar Anime'}</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
}

// Simple icon for the PieChart
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
      setTimeLeft('Horario desconocido');
      return;
    }

    const calculateTimeLeft = () => {
      const daysMap = { 'Sundays': 0, 'Mondays': 1, 'Tuesdays': 2, 'Wednesdays': 3, 'Thursdays': 4, 'Fridays': 5, 'Saturdays': 6 };
      const targetDay = daysMap[broadcast.day];
      if (targetDay === undefined) return 'Horario desconocido';

      const [hours, minutes] = broadcast.time.split(':').map(Number);
      
      const now = new Date();
      // Obtenemos la hora actual en la zona horaria de Japón
      const tokyoStr = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
      const tokyoNow = new Date(tokyoStr);

      let target = new Date(tokyoNow);
      target.setHours(hours, minutes, 0, 0);

      // Encontrar el siguiente día de emisión
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
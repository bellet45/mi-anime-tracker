import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit3, Trash2, ExternalLink, Image as ImageIcon, 
  Wand2, PlayCircle, Clock, CheckCircle2, PauseCircle, XCircle, 
  Tv, Star, ChevronRight, X, Loader2, Sparkles, MessageSquareText
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// API Key for Gemini/Imagen
const apiKey = "AIzaSyCYmCzmt1Zu7PJnrtRzyFb_bDh0T7w8rAo";
//firebase
const firebaseConfig = {
  apiKey: "AIzaSyCY5gkT7HWQPV3jV3wn1-iBeef1v7FOkPE",
  authDomain: "mi-anime-tracker.firebaseapp.com",
  projectId: "mi-anime-tracker",
  storageBucket: "mi-anime-tracker.firebasestorage.app",
  messagingSenderId: "281744457691",
  appId: "1:281744457691:web:d1eaaf8c679fb60d82f1fe"
};
// Helper for API calls with exponential backoff
const fetchWithBackoff = async (url, options, retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

// Helper to compress base64 images so they fit in Firestore's 1MB limit
const compressImage = (base64Str, maxWidth = 400, quality = 0.6) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str); // Fallback to original on error
  });
};

const STATUS_CONFIG = {
  'Viendo': { icon: PlayCircle, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  'Pendiente': { icon: Clock, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
  'Terminado': { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
  'Pausado': { icon: PauseCircle, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
  'Abandonado': { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' }
};

const INITIAL_ANIMES = [
  {
    id: '1',
    title: 'Jujutsu Kaisen',
    status: 'Viendo',
    progress: 15,
    totalEpisodes: 24,
    watchUrl: 'https://crunchyroll.com',
    coverUrl: 'https://cdn.myanimelist.net/images/anime/1171/109222l.jpg',
    rating: 9
  },
  {
    id: '2',
    title: 'Frieren: Más allá del final del viaje',
    status: 'Terminado',
    progress: 28,
    totalEpisodes: 28,
    watchUrl: 'https://crunchyroll.com',
    coverUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006l.jpg',
    rating: 10
  },
  {
    id: '3',
    title: 'Solo Leveling',
    status: 'Pendiente',
    progress: 0,
    totalEpisodes: 12,
    watchUrl: '',
    coverUrl: 'https://cdn.myanimelist.net/images/anime/1101/139943l.jpg',
    rating: 0
  }
];

// Configuración de Firebase en la Nube
// Merge any runtime-provided config (__firebase_config) with the default firebaseConfig declared above
const runtimeFirebaseConfig = typeof __firebase_config !== 'undefined' && __firebase_config ? JSON.parse(__firebase_config) : {};
const mergedFirebaseConfig = { ...firebaseConfig, ...runtimeFirebaseConfig };
const app = initializeApp(mergedFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' && __app_id ? __app_id : 'default-app-id';

export default function App() {
  const [animes, setAnimes] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estado de Autenticación y Carga
  const [user, setUser] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '', status: 'Viendo', progress: 0, totalEpisodes: 12, watchUrl: '', coverUrl: '', rating: 0, synopsis: ''
  });
  
  // Loading & Error states for form actions
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isFetchingReal, setIsFetchingReal] = useState(false);
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // LLM Recommendations State
  const [showRecsModal, setShowRecsModal] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);

  // Funciones de Autenticación con Google
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error con Google Auth:", error);
      setErrorMsg("No se pudo iniciar sesión con Google. Revisa las ventanas emergentes.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Volver a iniciar sesión anónima/custom para que la app siga funcionando según las reglas
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // 1. Inicializar la Autenticación Silenciosa
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error de autenticación:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Sincronizar datos de Firestore en tiempo real
  useEffect(() => {
    if (!user) {
      setLoadingData(false);
      return;
    }
    
    // Ruta segura y privada para los datos del usuario
    const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
    
    const unsubscribe = onSnapshot(animesRef, (snapshot) => {
      const fetchedAnimes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenamos para que los últimos añadidos salgan primero
      fetchedAnimes.sort((a, b) => b.id.localeCompare(a.id));
      setAnimes(fetchedAnimes);
      setLoadingData(false);
    }, (error) => {
      console.error("Error al obtener datos:", error);
      setLoadingData(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredAnimes = animes.filter(anime => {
    const matchesSearch = anime.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'Todos' || anime.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const handleOpenModal = (anime = null) => {
    setErrorMsg('');
    if (anime) {
      setFormData({
        title: anime.title || '',
        status: anime.status || 'Viendo',
        progress: anime.progress || 0,
        totalEpisodes: anime.totalEpisodes || 12,
        watchUrl: anime.watchUrl || '',
        coverUrl: anime.coverUrl || '',
        rating: anime.rating || 0,
        synopsis: anime.synopsis || ''
      });
      setEditingId(anime.id);
    } else {
      setFormData({ title: '', status: 'Viendo', progress: 0, totalEpisodes: 12, watchUrl: '', coverUrl: '', rating: 0, synopsis: '' });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setErrorMsg('El título es obligatorio.');
      return;
    }
    if (!user) {
      setErrorMsg('No estás conectado a la nube. Recarga la página.');
      return;
    }

    try {
      const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
      
      if (editingId) {
        await setDoc(doc(animesRef, editingId), formData);
      } else {
        const newId = Date.now().toString(); // Usamos la fecha como ID único
        await setDoc(doc(animesRef, newId), formData);
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error al guardar:", error);
      setErrorMsg('Error al guardar en la nube.');
    }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'animes', id));
    } catch (error) {
      console.error('Error al eliminar:', error);
    }
  };

  const generateAICover = async () => {
    if (!formData.title) {
      setErrorMsg('Escribe un título primero para generar la portada.');
      return;
    }
    setIsGeneratingAI(true);
    setErrorMsg('');
    
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
      const payload = {
        instances: { prompt: `A breathtaking anime style promotional poster for a show called "${formData.title}", highly detailed, vibrant colors, anime art style, masterpiece, studio ghibli or ufotable style` },
        parameters: { sampleCount: 1 }
      };

      const result = await fetchWithBackoff(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (result.predictions && result.predictions[0]) {
        const rawBase64 = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
        const compressedBase64 = await compressImage(rawBase64);
        setFormData(prev => ({ ...prev, coverUrl: compressedBase64 }));
      } else {
        setErrorMsg('No se pudo generar la imagen. Intenta de nuevo.');
      }
    } catch (err) {
      setErrorMsg('Error al conectar con la IA. Verifica tu conexión.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const fetchRealCover = async () => {
    if (!formData.title) {
      setErrorMsg('Escribe un título primero para buscar la portada.');
      return;
    }
    setIsFetchingReal(true);
    setErrorMsg('');
    
    try {
      // Using Jikan API (Unoficial MyAnimeList API)
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(formData.title)}&limit=1`);
      const data = await res.json();
      
      if (data?.data?.[0]?.images?.jpg?.large_image_url) {
        setFormData(prev => ({ ...prev, coverUrl: data.data[0].images.jpg.large_image_url }));
      } else {
        setErrorMsg('No se encontró portada oficial para este título.');
      }
    } catch (err) {
      setErrorMsg('Error al buscar la portada. Intenta de nuevo.');
    } finally {
      setIsFetchingReal(false);
    }
  };

  const generateAISynopsis = async () => {
    if (!formData.title) {
      setErrorMsg('Escribe un título primero para generar la sinopsis.');
      return;
    }
    setIsGeneratingSynopsis(true);
    setErrorMsg('');
    
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const result = await fetchWithBackoff(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Escribe una sinopsis muy breve y sin spoilers (máximo 2 oraciones) del anime "${formData.title}". Responde en español.` }] }]
        })
      });
      
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setFormData(prev => ({ ...prev, synopsis: text.trim() }));
      } else {
        setErrorMsg('No se pudo generar la sinopsis.');
      }
    } catch (err) {
      setErrorMsg('Error al conectar con la IA de texto.');
    } finally {
      setIsGeneratingSynopsis(false);
    }
  };

  const generateRecommendations = async () => {
    setIsGeneratingRecs(true);
    setShowRecsModal(true);
    setRecommendations([]);
    
    try {
      const likedAnimes = animes.filter(a => a.rating >= 7 || a.status === 'Terminado').map(a => a.title).join(', ');
      const prompt = `Me gustan estos animes: ${likedAnimes || 'cualquier anime shonen popular'}. Recomiéndame 3 animes altamente valorados que NO estén en esta lista. Devuelve SOLO un JSON estricto con un array de objetos, cada objeto con "title" y "reason" (una razón muy breve de por qué me gustará).`;
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const result = await fetchWithBackoff(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setRecommendations(JSON.parse(text));
      }
    } catch (e) {
      console.error("Error generando recomendaciones:", e);
    } finally {
      setIsGeneratingRecs(false);
    }
  };

  const handleAddRecommended = (title) => {
    setShowRecsModal(false);
    setFormData({ title: title, status: 'Pendiente', progress: 0, totalEpisodes: 12, watchUrl: '', coverUrl: '', rating: 0, synopsis: '' });
    setEditingId(null);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-purple-500/30">
      
      {/* Header & Navigation */}
      <header className="sticky top-0 z-10 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-300">
                AniTracker
              </h1>
            </div>

            <div className="flex flex-wrap md:flex-nowrap w-full md:w-auto items-center justify-end gap-3">
              
              {/* Botón de Perfil / Google Auth */}
              {user && !user.isAnonymous ? (
                <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full">
                  <img src={user.photoURL || 'https://via.placeholder.com/32'} alt="Perfil" className="w-7 h-7 rounded-full" />
                  <span className="text-sm font-medium text-slate-200 hidden sm:block max-w-[120px] truncate">
                    {user.displayName || 'Usuario'}
                  </span>
                  <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors ml-1" title="Cerrar Sesión">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleGoogleLogin} 
                  className="flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-md whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="hidden sm:inline">Google</span>
                </button>
              )}

              {/* Buscador */}
          <div className="relative w-full sm:w-auto flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-48 bg-slate-800/50 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
          </div>

          {/* Botón Recomendaciones IA */}
          <button 
            onClick={generateRecommendations}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-lg shadow-purple-500/20 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Descubrir IA ✨</span>
          </button>

          {/* Botón Añadir */}
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-lg shadow-purple-600/20 whitespace-nowrap"
          >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Añadir</span>
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex overflow-x-auto hide-scrollbar gap-2 mt-6 pb-2">
            {['Todos', ...Object.keys(STATUS_CONFIG)].map(status => (
              <button
                key={status}
                onClick={() => setActiveFilter(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeFilter === status 
                    ? 'bg-slate-700 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-12 h-12 mb-4 animate-spin text-purple-500" />
            <p className="text-lg">Sincronizando con la nube...</p>
          </div>
        ) : filteredAnimes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Tv className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg">No se encontraron animes en esta categoría.</p>
            <button onClick={() => handleOpenModal()} className="mt-4 text-purple-400 hover:text-purple-300">
              ¡Añade uno nuevo!
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAnimes.map(anime => {
              const statusConf = STATUS_CONFIG[anime.status];
              const StatusIcon = statusConf.icon;
              const progressPercent = anime.totalEpisodes ? Math.min(100, Math.round((anime.progress / anime.totalEpisodes) * 100)) : 0;

              return (
                <div key={anime.id} className="group relative bg-[#1e293b] rounded-2xl overflow-hidden border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10">
                  
                  {/* Image Container */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-800">
                    {anime.coverUrl ? (
                      <img 
                        src={anime.coverUrl} 
                        alt={anime.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/400x600/1e293b/475569?text=Sin+Portada' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <ImageIcon className="w-12 h-12" />
                      </div>
                    )}
                    
                    {/* Overlay Gradients & Actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-80" />
                    
                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal(anime)} className="p-2 bg-black/50 backdrop-blur rounded-full hover:bg-purple-600/80 text-white transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(anime.id)} className="p-2 bg-black/50 backdrop-blur rounded-full hover:bg-red-600/80 text-white transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="absolute top-3 left-3">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${statusConf.bg} ${statusConf.color} border ${statusConf.border}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {anime.status}
                      </div>
                    </div>

                    {/* Bottom Info on Image */}
                    <div className="absolute bottom-0 left-0 w-full p-4">
                      <h3 className="text-lg font-bold text-white line-clamp-2 leading-tight mb-2 drop-shadow-md">
                        {anime.title}
                      </h3>
                      
                      {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-300 font-medium">
                      <span>EP {anime.progress} / {anime.totalEpisodes || '?'}</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${anime.status === 'Terminado' ? 'bg-green-500' : 'bg-purple-500'}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Synopsis Snippet */}
                  {anime.synopsis && (
                    <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {anime.synopsis}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions Bar */}
              {anime.watchUrl && (
                    <div className="bg-slate-800/50 p-3 border-t border-slate-700/50">
                      <a 
                        href={anime.watchUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-medium transition-colors"
                      >
                        Ver Anime <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={handleCloseModal} />
          
          <div className="relative w-full max-w-xl bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-800/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {editingId ? <Edit3 className="w-5 h-5 text-purple-400" /> : <Plus className="w-5 h-5 text-purple-400" />}
                {editingId ? 'Editar Anime' : 'Añadir Nuevo Anime'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Título del Anime *</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Ej. Shingeki no Kyojin"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Estado</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 appearance-none"
                    >
                      {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {/* Rating */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Calificación (0-10)</label>
                    <div className="relative">
                      <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500" />
                      <input 
                        type="number" min="0" max="10"
                        value={formData.rating}
                        onChange={(e) => setFormData({...formData, rating: Number(e.target.value)})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Progress */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Episodios Vistos</label>
                    <input 
                      type="number" min="0"
                      value={formData.progress}
                      onChange={(e) => setFormData({...formData, progress: Number(e.target.value)})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                  {/* Total Episodes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Total Episodios</label>
                <input 
                  type="number" min="0"
                  value={formData.totalEpisodes}
                  onChange={(e) => setFormData({...formData, totalEpisodes: Number(e.target.value)})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            {/* Synopsis AI */}
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <label className="block text-sm font-medium text-slate-300">Sinopsis</label>
                <button 
                  onClick={generateAISynopsis}
                  disabled={isGeneratingSynopsis || !formData.title}
                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors"
                  title="Generar con IA"
                >
                  {isGeneratingSynopsis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Redactar con IA ✨
                </button>
              </div>
              <textarea 
                rows={2}
                value={formData.synopsis || ''}
                onChange={(e) => setFormData({...formData, synopsis: e.target.value})}
                placeholder="Un breve resumen del anime..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all resize-none"
              />
            </div>

            {/* Watch URL */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Link para Ver (Opcional)</label>
                  <div className="relative">
                    <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="url" 
                      value={formData.watchUrl}
                      onChange={(e) => setFormData({...formData, watchUrl: e.target.value})}
                      placeholder="https://crunchyroll.com/..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                {/* Cover URL & Magic Buttons */}
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                  <label className="block text-sm font-medium text-slate-300 mb-3">Portada del Anime</label>
                  
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <button 
                      onClick={fetchRealCover}
                      disabled={isFetchingReal}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                    >
                      {isFetchingReal ? <span className="animate-pulse">Buscando...</span> : <><Search className="w-4 h-4" /> Buscar Real</>}
                    </button>
                    
                    <button 
                      onClick={generateAICover}
                      disabled={isGeneratingAI}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-purple-500/20"
                    >
                      {isGeneratingAI ? <span className="animate-pulse">Generando IA...</span> : <><Wand2 className="w-4 h-4" /> Generar IA</>}
                    </button>
                  </div>

                  <input 
                    type="url" 
                    value={formData.coverUrl}
                    onChange={(e) => setFormData({...formData, coverUrl: e.target.value})}
                    placeholder="O pega una URL de imagen..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-purple-500 transition-all"
                  />
                  
                  {formData.coverUrl && (
                    <div className="mt-4 flex justify-center">
                      <img 
                        src={formData.coverUrl} 
                        alt="Preview" 
                        className="h-32 rounded-lg object-cover border border-slate-700 shadow-md"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div className="p-6 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
          <button 
            onClick={handleCloseModal}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-600/20"
          >
            Guardar Anime
          </button>
        </div>

      </div>
    </div>
  )}

  {/* Recommendations Modal */}
  {showRecsModal && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowRecsModal(false)} />
      
      <div className="relative w-full max-w-lg bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Descubrimientos IA
          </h2>
          <button onClick={() => setShowRecsModal(false)} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
          {isGeneratingRecs ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Wand2 className="w-10 h-10 mb-4 animate-bounce text-purple-500" />
              <p className="text-center">Analizando tus gustos...<br/>La IA está buscando joyas ocultas para ti ✨</p>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 mb-4">Basado en los animes que has terminado o valorado alto, aquí tienes 3 sugerencias:</p>
              {recommendations.map((rec, idx) => (
                <div key={idx} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                  <h3 className="text-lg font-bold text-slate-200 mb-1">{rec.title}</h3>
                  <p className="text-sm text-slate-400 mb-4">{rec.reason}</p>
                  <button 
                    onClick={() => handleAddRecommended(rec.title)}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-purple-600/20 text-purple-400 py-2 rounded-xl text-sm font-medium transition-all"
                  >
                    <Plus className="w-4 h-4" /> Añadir a mi lista
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-4">No se pudieron generar recomendaciones. Intenta de nuevo.</p>
          )}
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
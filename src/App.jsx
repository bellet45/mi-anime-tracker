import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit3, Trash2, ExternalLink, Image as ImageIcon, 
  PlayCircle, Clock, CheckCircle2, PauseCircle, XCircle, 
  Tv, Star, X, Loader2, ChevronRight
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
  
  const [user, setUser] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '', status: 'Viendo', progress: 0, totalEpisodes: 12, watchUrl: '', coverUrl: '', rating: 0
  });
  
  // Search API State
  const [apiSearchQuery, setApiSearchQuery] = useState('');
  const [apiResults, setApiResults] = useState([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

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

  useEffect(() => {
    if (!user) {
      setLoadingData(false);
      return;
    }
    
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

  // Debounce for API Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (apiSearchQuery.trim().length > 2) {
        searchAnimeDatabase(apiSearchQuery);
      } else {
        setApiResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [apiSearchQuery]);

  const searchAnimeDatabase = async (query) => {
    setIsSearchingApi(true);
    try {
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      setApiResults(data.data || []);
    } catch (err) {
      console.error("Error searching API:", err);
    } finally {
      setIsSearchingApi(false);
    }
  };

  const selectApiResult = (anime) => {
    setFormData({
      ...formData,
      title: anime.title,
      totalEpisodes: anime.episodes || 0,
      coverUrl: anime.images.jpg.large_image_url || ''
    });
    setApiResults([]);
    setApiSearchQuery('');
  };

  const filteredAnimes = animes.filter(anime => {
    const matchesSearch = anime.title.toLowerCase().includes(searchQuery.toLowerCase());
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
        rating: anime.rating || 0
      });
      setEditingId(anime.id);
    } else {
      setFormData({ title: '', status: 'Viendo', progress: 0, totalEpisodes: 0, watchUrl: '', coverUrl: '', rating: 0 });
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
      setErrorMsg('No estás conectado. Recarga la página.');
      return;
    }

    try {
      const animesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'animes');
      if (editingId) {
        await setDoc(doc(animesRef, editingId), formData);
      } else {
        const newId = Date.now().toString();
        await setDoc(doc(animesRef, newId), formData);
      }
      handleCloseModal();
    } catch (error) {
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

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-purple-500/30">
      
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
              
              {user && !user.isAnonymous ? (
                <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full">
                  <img src={user.photoURL || 'https://via.placeholder.com/32'} alt="Perfil" className="w-7 h-7 rounded-full" />
                  <span className="text-sm font-medium text-slate-200 hidden sm:block max-w-[120px] truncate">
                    {user.displayName || 'Usuario'}
                  </span>
                  <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors ml-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleGoogleLogin} 
                  className="flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-md"
                >
                  <span className="hidden sm:inline font-semibold">Google Login</span>
                </button>
              )}

              <div className="relative w-full sm:w-auto flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filtrar lista..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-48 bg-slate-800/50 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500 transition-all"
                />
              </div>

              <button 
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-50 text-white px-5 py-2 rounded-full text-sm font-bold transition-all shadow-lg shadow-purple-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Añadir</span>
              </button>
            </div>
          </div>

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-12 h-12 mb-4 animate-spin text-purple-500" />
            <p className="font-medium">Sincronizando con la nube...</p>
          </div>
        ) : filteredAnimes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Tv className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg">No hay animes en tu lista.</p>
            <button onClick={() => handleOpenModal()} className="mt-4 text-purple-400 hover:text-purple-300 font-semibold">
              ¡Añade tu primer anime!
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAnimes.map(anime => {
              const statusConf = STATUS_CONFIG[anime.status];
              const StatusIcon = statusConf.icon;
              const progressPercent = anime.totalEpisodes ? Math.min(100, Math.round((anime.progress / anime.totalEpisodes) * 100)) : 0;

              return (
                <div key={anime.id} className="group relative bg-[#1e293b] rounded-2xl overflow-hidden border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300">
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
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-80" />
                    
                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal(anime)} className="p-2 bg-black/60 backdrop-blur rounded-full hover:bg-purple-600 text-white transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(anime.id)} className="p-2 bg-black/60 backdrop-blur rounded-full hover:bg-red-600 text-white transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="absolute top-3 left-3">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${statusConf.bg} ${statusConf.color} border ${statusConf.border}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {anime.status}
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 w-full p-4">
                      <h3 className="text-lg font-bold text-white line-clamp-2 leading-tight mb-2 drop-shadow-md">
                        {anime.title}
                      </h3>
                      
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-300 font-medium">
                          <span>EP {anime.progress} / {anime.totalEpisodes || '?'}</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${anime.status === 'Terminado' ? 'bg-green-500' : 'bg-purple-500'}`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {anime.watchUrl && (
                    <div className="bg-slate-800/50 p-3 border-t border-slate-700/50">
                      <a 
                        href={anime.watchUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-medium transition-colors"
                      >
                        Ir al sitio <ExternalLink className="w-4 h-4" />
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
                {editingId ? 'Editar Anime' : 'Añadir Nuevo Anime'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              
              {/* API Search Bar */}
              {!editingId && (
                <div className="relative">
                  <label className="block text-sm font-bold text-purple-400 mb-2">Buscar Anime (MyAnimeList)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={apiSearchQuery}
                      onChange={(e) => setApiSearchQuery(e.target.value)}
                      placeholder="Escribe el nombre del anime..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 pl-10 text-slate-200 focus:outline-none focus:border-purple-500 transition-all"
                    />
                    {isSearchingApi && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-500" />}
                  </div>

                  {/* API Search Results */}
                  {apiResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2">
                      {apiResults.map(anime => (
                        <button 
                          key={anime.mal_id}
                          onClick={() => selectApiResult(anime)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0"
                        >
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

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4 border-t border-slate-700/50 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Información Manual</p>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Título del Anime *</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Ej. Shingeki no Kyojin"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Estado</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 appearance-none"
                    >
                      {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
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
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Episodios Vistos</label>
                    <input 
                      type="number" min="0"
                      value={formData.progress}
                      onChange={(e) => setFormData({...formData, progress: Number(e.target.value)})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
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

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Link de visualización (Opcional)</label>
                  <input 
                    type="url" 
                    value={formData.watchUrl}
                    onChange={(e) => setFormData({...formData, watchUrl: e.target.value})}
                    placeholder="https://..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                  <label className="block text-sm font-medium text-slate-300 mb-3">URL de la Portada</label>
                  <input 
                    type="url" 
                    value={formData.coverUrl}
                    onChange={(e) => setFormData({...formData, coverUrl: e.target.value})}
                    placeholder="Pega una URL de imagen..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-purple-500 transition-all"
                  />
                  
                  {formData.coverUrl && (
                    <div className="mt-4 flex justify-center">
                      <img 
                        src={formData.coverUrl} 
                        alt="Preview" 
                        className="h-32 rounded-lg object-cover border border-slate-700 shadow-lg"
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
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-8 py-2.5 rounded-xl text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-600/20"
              >
                {editingId ? 'Actualizar' : 'Guardar Anime'}
              </button>
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
import { useState, useEffect } from 'react'
import axios from 'axios'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Table from './Table'

function MatchesView({ matches, onSelectMatch }) {
  if (matches.length === 0) return <div className="text-center py-20 text-gray-500">Brak meczów.</div>

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-white flex items-center">
        <span className="bg-emerald-500 w-1 h-8 mr-3 rounded-full"></span>
        Nadchodzące Mecze
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {matches.map(match => (
          <div 
            key={match.id}
            onClick={() => onSelectMatch(match)}
            className="bg-slate-800 rounded-xl border border-slate-700 p-0 overflow-hidden hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-900/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
          >
            <div className="bg-slate-900/50 p-4 flex justify-between items-center border-b border-slate-700">
              <span className="text-xs font-mono text-emerald-500">Premier League</span>
              <span className="text-xs text-gray-400">
                {new Date(match.date).toLocaleDateString()}
              </span>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="text-center flex-1">
                  {match.logo_home && <img src={match.logo_home} className="w-10 h-10 mx-auto mb-2 object-contain"/>}
                  <div className="text-lg font-bold text-white mb-1 truncate">{match.home_team}</div>
                </div>
                <div className="px-4 text-gray-500 font-black text-sm">VS</div>
                <div className="text-center flex-1">
                  {match.logo_away && <img src={match.logo_away} className="w-10 h-10 mx-auto mb-2 object-contain"/>}
                  <div className="text-lg font-bold text-white mb-1 truncate">{match.away_team}</div>
                </div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Predykcja</p>
                <p className={`font-bold ${match.prediction?.winner === "Draw" ? "text-yellow-400" : "text-emerald-400"}`}>
                  {match.prediction ? match.prediction.winner : "Brak danych"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchDetails({ match, onBack, onAnalyze, loading }) {
  const formatAnalysisContent = (content) => {
    if (!content) return <p className="text-gray-500 italic">Brak danych historycznych.</p>
    return content.split('\n').map((line, index) => {
      if (line.includes('---') || line.includes('===')) return <h4 key={index} className="text-emerald-400 font-bold mt-4 mb-1 border-b border-gray-700 pb-1">{line.replace(/[-=]/g, '').trim()}</h4>
      if (line.startsWith('Match:') || line.startsWith('Prediction:')) return <p key={index} className="font-bold text-white mb-1">{line}</p>
      return <p key={index} className="text-gray-300 text-sm ml-2 mb-1">{line}</p>
    })
  }

  return (
    <div className="animate-slide-up">
      <button onClick={onBack} className="mb-6 flex items-center text-gray-400 hover:text-white transition group px-4 py-2 rounded-lg hover:bg-slate-800">
        <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span> Wróć do listy
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center">
              <span className="text-xl mr-2">📊</span><h3 className="font-bold text-white">Statystyki (Last 5 & xG)</h3>
            </div>
            <div className="p-5 max-h-[600px] overflow-y-auto custom-scrollbar">
              <div className="text-sm font-mono leading-relaxed">
                {match.prediction?.analysis_content ? formatAnalysisContent(match.prediction.analysis_content) : "Brak danych 'analysis_content'."}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
            <div className="flex justify-center items-center gap-8 mb-4">
               {match.logo_home && <img src={match.logo_home} className="w-20 h-20 object-contain"/>}
               <span className="text-2xl font-black text-gray-600">VS</span>
               {match.logo_away && <img src={match.logo_away} className="w-20 h-20 object-contain"/>}
            </div>
            <h2 className="text-3xl font-black text-white mb-2">{match.home_team} vs {match.away_team}</h2>
          </div>

          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <h3 className="font-bold text-xl text-white">Analiza Ekspercka (Ollama)</h3>
            </div>
            <div className="p-8">
              {match.prediction?.ai_text ? (
                <div className="prose prose-invert max-w-none">
                  <p className="text-gray-300 text-lg leading-relaxed whitespace-pre-line border-l-4 border-purple-500 pl-6 py-2 bg-slate-900/50 rounded-r-lg">{match.prediction.ai_text}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <button onClick={() => onAnalyze(match.id)} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-xl shadow-emerald-900/50 flex items-center">
                    {loading ? "Generowanie..." : "Generuj Analizę"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppContent() {
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [loading, setLoading] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setSelectedMatch(null)
    axios.get('http://localhost:8000/matches')
      .then(res => setMatches(res.data))
      .catch(console.error)
  }, [location.pathname])

  const handleAnalyze = async (matchId) => {
    setLoading(true)
    try {
      const res = await axios.post(`http://localhost:8000/analyze/${matchId}`)
      const updatedMatches = matches.map(m => {
        if (m.id === matchId) {
          return { ...m, prediction: { ...(m.prediction || {}), ai_text: res.data.text } }
        }
        return m
      })
      setMatches(updatedMatches)
      if (selectedMatch && selectedMatch.id === matchId) {
        setSelectedMatch(prev => ({ ...prev, prediction: { ...(prev.prediction || {}), ai_text: res.data.text } }))
      }
    } catch (err) { alert("Błąd AI") } finally { setLoading(false) }
  }
  const NavLink = ({ to, label, icon }) => {
    const active = location.pathname === to
    return (
      <Link to={to} className={`flex items-center px-4 py-2 rounded-lg transition-colors ${active ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-slate-800'}`}>
        <span className="mr-2">{icon}</span> {label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-gray-100 font-sans pb-20">
      <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50 shadow-lg backdrop-blur-sm bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-2xl mr-2">⚽</span>
              <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mr-8">
                Football AI
              </h1>
              <div className="flex space-x-2">
                <NavLink to="/" label="Mecze" icon="📅" />
                <NavLink to="/table" label="Tabela" icon="🏆" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={
            selectedMatch ? 
            <MatchDetails match={selectedMatch} onBack={() => setSelectedMatch(null)} onAnalyze={handleAnalyze} loading={loading} /> : 
            <MatchesView matches={matches} onSelectMatch={setSelectedMatch} />
          } />
          <Route path="/table" element={<Table />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
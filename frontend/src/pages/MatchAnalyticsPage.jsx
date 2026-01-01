import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

function MatchAnalyticsPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [match, setMatch] = useState(null)
    const [loading, setLoading] = useState(true)
    const [analyzing, setAnalyzing] = useState(false)

    useEffect(() => {
        axios.get(`http://localhost:8000/matches/${id}`)
            .then(res => {
                setMatch(res.data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [id])

    const handleAnalyze = async () => {
        setAnalyzing(true)
        try {
            const res = await axios.post(`http://localhost:8000/analyze/${id}`)
            setMatch(prev => ({
                ...prev,
                prediction: { ...(prev.prediction || {}), ai_text: res.data.text }
            }))
        } catch (err) {
            alert("AI Analysis error")
        } finally {
            setAnalyzing(false)
        }
    }

    const formatAnalysisContent = (content) => {
        if (!content) return <p className="text-gray-500 italic">No historical data available.</p>
        return content.split('\n').map((line, index) => {
            if (line.includes('---') || line.includes('==='))
                return <h4 key={index} className="text-emerald-400 font-bold mt-4 mb-1 border-b border-gray-700 pb-1">{line.replace(/[-=]/g, '').trim()}</h4>
            if (line.startsWith('Match:') || line.startsWith('Prediction:'))
                return <p key={index} className="font-bold text-white mb-1">{line}</p>
            return <p key={index} className="text-gray-300 text-sm ml-2 mb-1">{line}</p>
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading match data...</p>
                </div>
            </div>
        )
    }

    if (!match) {
        return (
            <div className="text-center py-20">
                <div className="text-6xl mb-4">❌</div>
                <h2 className="text-2xl font-bold text-white mb-2">Match Not Found</h2>
                <p className="text-gray-500 mb-6">The requested match could not be found</p>
                <button
                    onClick={() => navigate('/matches')}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
                >
                    Back to Matches
                </button>
            </div>
        )
    }

    return (
        <div className="animate-slide-up">
            <button
                onClick={() => navigate('/matches')}
                className="mb-6 flex items-center text-gray-400 hover:text-white transition group px-4 py-2 rounded-lg hover:bg-slate-800"
            >
                <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span> Back to Matches
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sidebar - Stats */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Confidence Level */}
                    {match.prediction?.confidence > 0 && (
                        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                            <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center">
                                <span className="text-xl mr-2">🎯</span>
                                <h3 className="font-bold text-white">AI Confidence</h3>
                            </div>
                            <div className="p-5">
                                <div className="text-center mb-4">
                                    <div className="text-5xl font-black text-emerald-400">{match.prediction.confidence}%</div>
                                    <p className="text-sm text-gray-400">Confidence Level</p>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-3">
                                    <div
                                        className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-3 rounded-full transition-all duration-500"
                                        style={{ width: `${match.prediction.confidence}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Statistics */}
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center">
                            <span className="text-xl mr-2">📊</span>
                            <h3 className="font-bold text-white">Statistics (Last 5 & xG)</h3>
                        </div>
                        <div className="p-5 max-h-[500px] overflow-y-auto custom-scrollbar">
                            <div className="text-sm font-mono leading-relaxed">
                                {match.prediction?.analysis_content
                                    ? formatAnalysisContent(match.prediction.analysis_content)
                                    : "No 'analysis_content' data."}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Match Header */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>

                        <div className="text-xs text-emerald-400 font-mono uppercase tracking-wider mb-6">
                            Premier League • {new Date(match.date).toLocaleDateString()}
                        </div>

                        <div className="flex justify-center items-center gap-8 mb-6">
                            <div className="text-center">
                                {match.logo_home && <img src={match.logo_home} className="w-24 h-24 object-contain mx-auto mb-2" alt={match.home_team} />}
                                <div className="text-xl font-bold text-white">{match.home_team}</div>
                            </div>
                            <div className="px-6">
                                <span className="text-3xl font-black text-gray-600">VS</span>
                            </div>
                            <div className="text-center">
                                {match.logo_away && <img src={match.logo_away} className="w-24 h-24 object-contain mx-auto mb-2" alt={match.away_team} />}
                                <div className="text-xl font-bold text-white">{match.away_team}</div>
                            </div>
                        </div>

                        {/* Predicted Winner */}
                        {match.prediction && (
                            <div className="bg-slate-900/50 rounded-xl p-4 inline-block">
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Predicted Winner</p>
                                <p className={`text-2xl font-black ${match.prediction.winner === "Draw" ? "text-yellow-400" : "text-emerald-400"}`}>
                                    {match.prediction.winner}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* AI Analysis */}
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="font-bold text-xl text-white flex items-center">
                                <span className="text-2xl mr-2">🤖</span>
                                AI Expert Analysis
                            </h3>
                        </div>
                        <div className="p-8">
                            {match.prediction?.ai_text ? (
                                <div className="prose prose-invert max-w-none">
                                    <p className="text-gray-300 text-lg leading-relaxed whitespace-pre-line border-l-4 border-purple-500 pl-6 py-2 bg-slate-900/50 rounded-r-lg">
                                        {match.prediction.ai_text}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="text-6xl mb-4">🧠</div>
                                    <p className="text-gray-400 mb-6">AI analysis not yet generated for this match</p>
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={analyzing}
                                        className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-xl shadow-emerald-900/50 flex items-center disabled:opacity-50"
                                    >
                                        {analyzing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                                Generating...
                                            </>
                                        ) : (
                                            "Generate AI Analysis"
                                        )}
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

export default MatchAnalyticsPage

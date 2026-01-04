import { useState, useEffect, useMemo } from 'react'
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

    // Extract predicted winner from AI analysis text
    const extractedWinner = useMemo(() => {
        const aiText = match?.prediction?.ai_text || ''

        // Look for "Predicted Winner: Team Name" pattern
        const winnerPattern = /Predicted Winner:\s*(.+)/i
        const winnerMatch = aiText.match(winnerPattern)

        if (winnerMatch) {
            const winner = winnerMatch[1].trim()
            // Check if it's a draw
            if (winner.toLowerCase() === 'draw' || winner.toLowerCase() === 'tie') {
                return { winner: 'Draw', found: true }
            }
            return { winner, found: true }
        }

        return { winner: null, found: false }
    }, [match?.prediction?.ai_text])

    // Extract predicted score from AI analysis text
    const extractedScore = useMemo(() => {
        const aiText = match?.prediction?.ai_text || ''

        // First try the explicit "Predicted Score: X - Y" format
        const explicitPattern = /Predicted Score:\s*(\d+)\s*[-–:]\s*(\d+)/i
        const explicitMatch = aiText.match(explicitPattern)

        if (explicitMatch) {
            const home = parseInt(explicitMatch[1], 10)
            const away = parseInt(explicitMatch[2], 10)
            if (!isNaN(home) && !isNaN(away) && home <= 10 && away <= 10) {
                return { home, away, found: true }
            }
        }

        // Fallback patterns for older analyses
        const patterns = [
            /(?:predicted?\s*score|final\s*score|(?:i\s*)?predict)[:\s]*(\d+)\s*[-–:]\s*(\d+)/i,
            /score[:\s]*(\d+)\s*[-–:]\s*(\d+)/i,
            /(\d+)\s*[-–]\s*(\d+)\s*(?:win|victory|to)/i,
            /(\d+)\s*to\s*(\d+)/i,
            /\b(\d+)\s*[-–:]\s*(\d+)\b/,
        ]

        for (const pattern of patterns) {
            const matchResult = aiText.match(pattern)
            if (matchResult) {
                const home = parseInt(matchResult[1], 10)
                const away = parseInt(matchResult[2], 10)
                if (!isNaN(home) && !isNaN(away) && home <= 10 && away <= 10) {
                    return { home, away, found: true }
                }
            }
        }

        return { home: null, away: null, found: false }
    }, [match?.prediction?.ai_text])

    // Calculate scenario probabilities based on extracted score
    const scenarioProbabilities = useMemo(() => {
        const { home, away, found } = extractedScore

        if (!found || home === null || away === null) {
            return null
        }

        const totalGoals = home + away
        const bttsYes = home > 0 && away > 0

        // Calculate Over/Under percentages based on predicted total goals
        // If predicted total is 3, then Over 2.5 is likely (higher %), Under 2.5 is less likely
        const calculateOverUnder = (threshold) => {
            if (totalGoals > threshold) {
                // Prediction is over, so higher confidence in Over
                const diff = totalGoals - threshold
                const overPct = Math.min(95, 55 + diff * 15)
                return { over: overPct, under: 100 - overPct }
            } else if (totalGoals < threshold) {
                // Prediction is under, so higher confidence in Under
                const diff = threshold - totalGoals
                const underPct = Math.min(95, 55 + diff * 15)
                return { over: 100 - underPct, under: underPct }
            } else {
                // Exactly at threshold
                return { over: 50, under: 50 }
            }
        }

        // Calculate win probabilities based on score margin
        let homeWinPct, drawPct, awayWinPct
        if (home > away) {
            const margin = home - away
            homeWinPct = Math.min(80, 45 + margin * 15)
            awayWinPct = Math.max(5, 20 - margin * 5)
            drawPct = 100 - homeWinPct - awayWinPct
        } else if (away > home) {
            const margin = away - home
            awayWinPct = Math.min(80, 45 + margin * 15)
            homeWinPct = Math.max(5, 20 - margin * 5)
            drawPct = 100 - homeWinPct - awayWinPct
        } else {
            // Draw prediction
            drawPct = 50
            homeWinPct = 25
            awayWinPct = 25
        }

        return {
            homeWin: Math.round(homeWinPct),
            draw: Math.round(drawPct),
            awayWin: Math.round(awayWinPct),
            goals: {
                '0.5': calculateOverUnder(0.5),
                '1.5': calculateOverUnder(1.5),
                '2.0': calculateOverUnder(2.0),
                '2.5': calculateOverUnder(2.5),
                '3.0': calculateOverUnder(3.0)
            },
            btts: bttsYes ? { yes: 75, no: 25 } : { yes: 25, no: 75 },
            totalGoals
        }
    }, [extractedScore])

    // Check if AI analysis has been done
    const hasAnalysis = match?.prediction?.ai_text

    // Mock form data - only shown after analysis
    const mockForm = {
        home: ['W', 'W', 'D', 'W', 'L'],
        away: ['W', 'L', 'D', 'W', 'W']
    }

    const FormBadge = ({ result }) => {
        const colors = {
            W: 'bg-emerald-500',
            D: 'bg-gray-500',
            L: 'bg-red-500'
        }
        return (
            <div className={`w-10 h-10 ${colors[result]} rounded-lg flex items-center justify-center font-bold text-white text-sm`}>
                {result}
            </div>
        )
    }

    const ProbabilityBar = ({ values, colors }) => (
        <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-2">
                {values.map((v, i) => (
                    <span key={i} className={i === 0 ? 'text-left' : i === values.length - 1 ? 'text-right' : 'text-center'}>
                        {v.label} ({v.value}%)
                    </span>
                ))}
            </div>
            <div className="h-3 rounded-full flex overflow-hidden">
                {values.map((v, i) => (
                    <div
                        key={i}
                        className={`${colors[i]} h-full transition-all`}
                        style={{ width: `${v.value}%` }}
                    />
                ))}
            </div>
        </div>
    )

    const GoalBar = ({ threshold, over, under }) => (
        <div className="flex items-center gap-4 py-2">
            <span className="text-sm text-gray-400 w-24">Over/Under {threshold}</span>
            <div className="flex-1 flex items-center gap-2">
                <span className="text-emerald-400 text-sm font-medium w-12">Over</span>
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${over}%` }} />
                </div>
                <span className="text-sm text-white w-12 text-center">{over}%</span>
                <span className="text-gray-500 text-sm w-12 text-right">{under}%</span>
            </div>
        </div>
    )

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

    const confidence = match.prediction?.confidence || 0
    const confidenceLevel = confidence >= 70 ? 'HIGH' : confidence >= 40 ? 'MEDIUM' : 'LOW'
    const confidenceColor = confidence >= 70 ? 'text-emerald-400' : confidence >= 40 ? 'text-yellow-400' : 'text-red-400'

    // Determine predicted winner - prefer explicit extraction, fall back to score-based
    const getWinnerLabel = () => {
        // First try to use explicitly extracted winner from AI text
        if (extractedWinner.found) {
            if (extractedWinner.winner === 'Draw') return 'Draw'
            return `${extractedWinner.winner} Win`
        }
        // Fall back to score-based determination
        if (!extractedScore.found) return match.prediction?.winner || 'Unknown'
        if (extractedScore.home > extractedScore.away) return `${match.home_team} Win`
        if (extractedScore.away > extractedScore.home) return `${match.away_team} Win`
        return 'Draw'
    }

    return (
        <div className="animate-fade-in">
            <button
                onClick={() => navigate('/matches')}
                className="mb-6 flex items-center text-gray-400 hover:text-white transition group px-4 py-2 rounded-lg hover:bg-slate-800"
            >
                <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span> Back to Matches
            </button>

            {/* Match Header */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-2 mx-auto overflow-hidden">
                                {match.logo_home ? (
                                    <img src={match.logo_home} className="w-12 h-12 object-contain" alt={match.home_team} />
                                ) : (
                                    <span className="text-xl font-bold text-white">{match.home_team?.substring(0, 3)}</span>
                                )}
                            </div>
                            <p className="font-bold text-white">{match.home_team}</p>
                        </div>

                        <div className="text-center px-6">
                            <div className="text-gray-500 text-sm mb-1">VS</div>
                            <div className="text-xs text-gray-400">{new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} GMT</div>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-2 mx-auto overflow-hidden">
                                {match.logo_away ? (
                                    <img src={match.logo_away} className="w-12 h-12 object-contain" alt={match.away_team} />
                                ) : (
                                    <span className="text-xl font-bold text-white">{match.away_team?.substring(0, 3)}</span>
                                )}
                            </div>
                            <p className="font-bold text-white">{match.away_team}</p>
                        </div>
                    </div>

                    <div className="text-right text-sm">
                        <p className="text-emerald-400 font-mono">PREMIER LEAGUE</p>
                        <p className="text-gray-400">{new Date(match.date).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            {/* AI Analysis Section - Must be generated first */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-6">
                <div className="p-5 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center">
                        <span className="text-xl mr-2">🤖</span> AI Expert Analysis
                    </h3>
                </div>
                <div className="p-5">
                    {hasAnalysis ? (
                        <p className="text-gray-300 leading-relaxed whitespace-pre-line border-l-4 border-purple-500 pl-4 py-2 bg-slate-900/50 rounded-r-lg">
                            {match.prediction.ai_text}
                        </p>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-6xl mb-4">🧠</div>
                            <p className="text-gray-400 mb-2">Generate AI analysis to unlock detailed predictions</p>
                            <p className="text-gray-500 text-sm mb-6">AI Verdict, Scenario Probabilities, and Form Guide will be available after analysis</p>
                            <button
                                onClick={handleAnalyze}
                                disabled={analyzing}
                                className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
                            >
                                {analyzing ? (
                                    <span className="flex items-center">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                        Generating...
                                    </span>
                                ) : (
                                    "Generate AI Analysis"
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Only show these sections after AI Analysis is done */}
            {hasAnalysis && (
                <>
                    {/* AI Verdict Section */}
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                        <span className="text-2xl mr-2">🎯</span> AI Verdict
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* Predicted Score - Extracted from AI Text */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-sm text-gray-400">Predicted Score</p>
                                <div className="bg-slate-700 rounded-lg px-2 py-1 text-xs text-emerald-400">⚽</div>
                            </div>
                            <div className="mb-3">
                                {extractedScore.found ? (
                                    <>
                                        <span className="text-4xl font-black text-white">{extractedScore.home} - {extractedScore.away}</span>
                                        <span className={`ml-3 text-sm ${extractedScore.home === extractedScore.away ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                            {getWinnerLabel()}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-2xl font-bold text-gray-500">Score not found in analysis</span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">
                                {extractedScore.found
                                    ? `Extracted from AI analysis. Total goals: ${extractedScore.home + extractedScore.away}`
                                    : 'Unable to extract score from AI text'
                                }
                            </p>
                        </div>

                        {/* Confidence Level */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-sm text-gray-400">Confidence Level</p>
                                <div className="bg-slate-700 rounded-lg px-2 py-1 text-xs text-gray-400">📈</div>
                            </div>
                            <div className="flex items-baseline gap-2 mb-3">
                                <span className={`text-4xl font-black ${confidenceColor}`}>{confidence}%</span>
                                <span className={`text-xs px-2 py-1 rounded ${confidence >= 70 ? 'bg-emerald-500/20 text-emerald-400' : confidence >= 40 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {confidenceLevel}
                                </span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${confidence >= 70 ? 'bg-emerald-500' : confidence >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${confidence}%` }} />
                            </div>
                        </div>

                        {/* Risk Assessment */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-sm text-gray-400">Risk Assessment</p>
                                <div className="bg-slate-700 rounded-lg px-2 py-1 text-xs text-gray-400">✓</div>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className={`text-4xl font-black ${confidence >= 60 ? 'text-emerald-400' : confidence >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {confidence >= 60 ? 'Low' : confidence >= 40 ? 'Medium' : 'High'}
                                </span>
                                <span className={confidence >= 60 ? 'text-emerald-400 text-xl' : confidence >= 40 ? 'text-yellow-400 text-xl' : 'text-red-400 text-xl'}>
                                    {confidence >= 60 ? '✓' : confidence >= 40 ? '⚠' : '✗'}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500">Based on model confidence and historical accuracy.</p>
                        </div>
                    </div>

                    {/* Two Column Layout - Only show if score was extracted */}
                    {scenarioProbabilities && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Scenario Probabilities - Calculated from extracted score */}
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                <h3 className="font-bold text-white mb-4 flex items-center">
                                    <span className="text-lg mr-2">⚡</span> Scenario Probabilities
                                    <span className="ml-2 text-xs text-gray-500">(based on predicted {extractedScore.home}-{extractedScore.away})</span>
                                </h3>

                                {/* Win/Draw/Lose */}
                                <ProbabilityBar
                                    values={[
                                        { label: 'Home Win', value: scenarioProbabilities.homeWin },
                                        { label: 'Draw', value: scenarioProbabilities.draw },
                                        { label: 'Away Win', value: scenarioProbabilities.awayWin }
                                    ]}
                                    colors={['bg-emerald-500', 'bg-gray-500', 'bg-cyan-500']}
                                />

                                <div className="border-t border-slate-700 my-4 pt-4">
                                    <p className="text-sm text-gray-400 mb-3">Over / Under Goals <span className="text-xs text-gray-500">(predicted total: {scenarioProbabilities.totalGoals})</span></p>
                                    {Object.entries(scenarioProbabilities.goals).map(([threshold, { over, under }]) => (
                                        <GoalBar key={threshold} threshold={threshold} over={Math.round(over)} under={Math.round(under)} />
                                    ))}
                                </div>

                                <div className="border-t border-slate-700 mt-4 pt-4">
                                    <p className="text-sm text-gray-400 mb-2">Both Teams to Score (BTTS)</p>
                                    <div className="flex items-center gap-4">
                                        <span className="text-emerald-400 font-medium">Yes</span>
                                        <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden flex">
                                            <div className="bg-emerald-500 h-full" style={{ width: `${scenarioProbabilities.btts.yes}%` }} />
                                            <div className="bg-red-500/50 h-full" style={{ width: `${scenarioProbabilities.btts.no}%` }} />
                                        </div>
                                        <span className="text-sm text-white">{scenarioProbabilities.btts.yes}%</span>
                                        <span className="text-gray-500">No</span>
                                        <span className="text-sm text-gray-400">{scenarioProbabilities.btts.no}%</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {extractedScore.home > 0 && extractedScore.away > 0
                                            ? `Predicted score ${extractedScore.home}-${extractedScore.away} suggests both teams score`
                                            : `Predicted score ${extractedScore.home}-${extractedScore.away} suggests clean sheet`
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Form Guide */}
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                <h3 className="font-bold text-white mb-4 flex items-center">
                                    <span className="text-lg mr-2">📊</span> Form Guide (Last 5)
                                </h3>

                                {/* Home Team Form */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="font-medium text-white">{match.home_team}</span>
                                        <span className="text-xs text-gray-400">Home Form</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {mockForm.home.map((result, i) => (
                                            <FormBadge key={i} result={result} />
                                        ))}
                                    </div>
                                </div>

                                {/* Away Team Form */}
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="font-medium text-white">{match.away_team}</span>
                                        <span className="text-xs text-gray-400">Away Form</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {mockForm.away.map((result, i) => (
                                            <FormBadge key={i} result={result} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Show message if score couldn't be extracted */}
                    {!scenarioProbabilities && (
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 text-center mb-6">
                            <p className="text-gray-400">⚠️ Could not extract predicted score from AI analysis to calculate scenario probabilities.</p>
                            <p className="text-gray-500 text-sm mt-2">The AI analysis should include a predicted score in format like "2-1" or "Score: 2-1"</p>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default MatchAnalyticsPage

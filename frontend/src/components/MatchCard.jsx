import { useNavigate } from 'react-router-dom'

function MatchCard({ match }) {
    const navigate = useNavigate()

    return (
        <div
            onClick={() => navigate(`/match/${match.id}`)}
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
                        {match.logo_home && <img src={match.logo_home} className="w-10 h-10 mx-auto mb-2 object-contain" alt={match.home_team} />}
                        <div className="text-lg font-bold text-white mb-1 truncate">{match.home_team}</div>
                    </div>
                    <div className="px-4 text-gray-500 font-black text-sm">VS</div>
                    <div className="text-center flex-1">
                        {match.logo_away && <img src={match.logo_away} className="w-10 h-10 mx-auto mb-2 object-contain" alt={match.away_team} />}
                        <div className="text-lg font-bold text-white mb-1 truncate">{match.away_team}</div>
                    </div>
                </div>
                <div className="bg-slate-900 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Prediction</p>
                    <p className={`font-bold ${match.prediction?.winner === "Draw" ? "text-yellow-400" : "text-emerald-400"}`}>
                        {match.prediction ? match.prediction.winner : "No data"}
                    </p>
                    {match.prediction?.confidence > 0 && (
                        <p className="text-xs text-gray-400 mt-1">{match.prediction.confidence}% confidence</p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default MatchCard

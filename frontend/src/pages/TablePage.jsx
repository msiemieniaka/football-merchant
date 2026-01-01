import { useState, useEffect } from 'react'
import axios from 'axios'

function TablePage() {
    const [teams, setTeams] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        axios.get('http://localhost:8000/table')
            .then(res => {
                setTeams(res.data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading league table...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center mb-2">
                    <span className="bg-emerald-500 w-1 h-8 mr-3 rounded-full"></span>
                    Premier League Table
                </h1>
                <p className="text-gray-400 ml-4">Current standings and team statistics</p>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-400 uppercase bg-slate-900/50">
                            <tr>
                                <th className="px-6 py-4 text-center">#</th>
                                <th className="px-6 py-4">Team</th>
                                <th className="px-6 py-4 text-center" title="Matches Played">M</th>
                                <th className="px-6 py-4 text-center text-green-400" title="Wins">W</th>
                                <th className="px-6 py-4 text-center text-gray-400" title="Draws">D</th>
                                <th className="px-6 py-4 text-center text-red-400" title="Losses">L</th>
                                <th className="px-6 py-4 text-center hidden md:table-cell">Goals</th>
                                <th className="px-6 py-4 text-center hidden md:table-cell" title="Goal Difference">GD</th>
                                <th className="px-6 py-4 text-center font-bold text-white text-base">Pts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teams.map((team, index) => {
                                const position = index + 1
                                let positionStyle = 'text-gray-500'
                                if (position <= 4) positionStyle = 'text-emerald-400 font-bold'
                                else if (position >= teams.length - 2) positionStyle = 'text-red-400 font-bold'

                                const goalDiff = team.goals_scored - team.goals_conceded

                                return (
                                    <tr
                                        key={team.id}
                                        className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors"
                                    >
                                        <td className={`px-6 py-4 text-center font-mono ${positionStyle}`}>
                                            {position}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                {team.logo_url ? (
                                                    <img src={team.logo_url} alt={team.name} className="w-8 h-8 mr-3 object-contain" />
                                                ) : (
                                                    <div className="w-8 h-8 mr-3 bg-slate-600 rounded-full flex items-center justify-center text-xs font-bold">
                                                        {team.short_name?.substring(0, 2) || team.name.substring(0, 2)}
                                                    </div>
                                                )}
                                                <span className="font-bold text-white">{team.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-300">{team.matches_played}</td>
                                        <td className="px-6 py-4 text-center text-green-400 font-medium">{team.wins}</td>
                                        <td className="px-6 py-4 text-center text-gray-400">{team.draws}</td>
                                        <td className="px-6 py-4 text-center text-red-400">{team.loses}</td>
                                        <td className="px-6 py-4 text-center hidden md:table-cell text-gray-400">
                                            {team.goals_scored}:{team.goals_conceded}
                                        </td>
                                        <td className="px-6 py-4 text-center hidden md:table-cell">
                                            <span className={goalDiff > 0 ? 'text-green-400' : goalDiff < 0 ? 'text-red-400' : 'text-gray-400'}>
                                                {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center font-black text-white text-lg">
                                            {team.points}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                    <span>Champions League</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <span>Relegation Zone</span>
                </div>
            </div>
        </div>
    )
}

export default TablePage

import { useState, useEffect } from 'react'
import axios from 'axios'

function Table() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('http://localhost:8000/table')
      .then(res => {
        setTeams(res.data)
        setLoading(false)
      })
      .catch(console.error)
  }, [])

  if (loading) return <div className="text-center p-10 text-emerald-400">Ładowanie tabeli...</div>

  return (
    <div className="animate-fade-in bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
      <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex items-center">
        <span className="text-2xl mr-2">🏆</span>
        <h2 className="text-xl font-bold text-white">Tabela Premier League</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase bg-slate-900/30">
            <tr>
              <th className="px-6 py-3 text-center">#</th>
              <th className="px-6 py-3">Klub</th>
              <th className="px-6 py-3 text-center" title="Mecze rozegrane">M</th>
              <th className="px-6 py-3 text-center text-green-400" title="Wygrane">W</th>
              <th className="px-6 py-3 text-center text-gray-400" title="Remisy">R</th>
              <th className="px-6 py-3 text-center text-red-400" title="Porażki">P</th>
              <th className="px-6 py-3 text-center hidden md:table-cell">Bramki</th>
              <th className="px-6 py-3 text-center hidden md:table-cell" title="Różnica Bramek">RB</th>
              <th className="px-6 py-3 text-center font-bold text-white text-base">Pkt</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => (
              <tr key={team.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 text-center font-mono text-gray-500">
                  {index + 1}
                </td>
                <td className="px-6 py-4 flex items-center">
                  {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} className="w-8 h-8 mr-3 object-contain" />
                  ) : (
                    <div className="w-8 h-8 mr-3 bg-slate-600 rounded-full flex items-center justify-center text-xs font-bold">
                      {team.short_name.substring(0,2)}
                    </div>
                  )}
                  <span className="font-bold text-white">{team.name}</span>
                </td>
                <td className="px-6 py-4 text-center text-gray-300">{team.matches_played}</td>
                <td className="px-6 py-4 text-center text-green-400 font-medium">{team.wins}</td>
                <td className="px-6 py-4 text-center text-gray-400">{team.draws}</td>
                <td className="px-6 py-4 text-center text-red-400">{team.loses}</td>
                <td className="px-6 py-4 text-center hidden md:table-cell text-gray-400">
                  {team.goals_scored}:{team.goals_conceded}
                </td>
                <td className="px-6 py-4 text-center hidden md:table-cell text-gray-400">
                  {team.goals_scored - team.goals_conceded > 0 ? `+${team.goals_scored - team.goals_conceded}` : team.goals_scored - team.goals_conceded}
                </td>
                <td className="px-6 py-4 text-center font-black text-white text-lg">
                  {team.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Table
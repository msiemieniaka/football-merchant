import { useState, useEffect } from 'react'
import axios from 'axios'
import MatchCard from '../components/MatchCard'

function MatchesPage() {
    const [matches, setMatches] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        axios.get('http://localhost:8000/matches')
            .then(res => {
                setMatches(res.data)
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
                    <p className="text-gray-400">Loading matches...</p>
                </div>
            </div>
        )
    }

    if (matches.length === 0) {
        return (
            <div className="text-center py-20">
                <div className="text-6xl mb-4">📅</div>
                <h2 className="text-2xl font-bold text-white mb-2">No Upcoming Matches</h2>
                <p className="text-gray-500">Check back later for new match predictions</p>
            </div>
        )
    }

    return (
        <div className="animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center mb-2">
                    <span className="bg-emerald-500 w-1 h-8 mr-3 rounded-full"></span>
                    Upcoming Matches
                </h1>
                <p className="text-gray-400 ml-4">Click on any match to view detailed AI analytics</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map(match => (
                    <MatchCard key={match.id} match={match} />
                ))}
            </div>

            <div className="mt-8 bg-slate-800 rounded-xl border border-slate-700 p-6 text-center">
                <p className="text-gray-400">
                    <span className="text-emerald-400 font-bold">{matches.length}</span> matches available for analysis
                </p>
            </div>
        </div>
    )
}

export default MatchesPage

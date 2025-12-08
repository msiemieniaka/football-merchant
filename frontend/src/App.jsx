import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [message, setMessage] = useState("Connecting to backend...")
  const [matches, setMatches] = useState([])

  useEffect(() => {

    axios.get('http://localhost:8000/')
      .then(res => setMessage(res.data.message || "Connected!"))
      .catch(err => setMessage("Error connecting to backend: " + err.message))


    axios.get('http://localhost:8000/matches')
      .then(res => setMatches(res.data.slice(0, 5)))
      .catch(console.error)
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-white p-10">
      <h1 className="text-4xl font-bold text-emerald-400 mb-6">Football AI Analyst</h1>
      
      <div className="bg-slate-800 p-4 rounded-lg shadow-lg mb-8 border border-slate-700">
        <h2 className="text-xl font-semibold mb-2">Backend Status:</h2>
        <p className={`text-lg ${message.includes("Error") ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      </div>

      <h2 className="text-2xl font-bold mb-4">Upcoming Matches Preview:</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {matches.map(m => (
          <div key={m.id} className="bg-slate-800 p-4 rounded border border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold">{m.home_team}</span>
              <span className="text-sm text-gray-400">vs</span>
              <span className="font-bold">{m.away_team}</span>
            </div>
            <div className="text-sm text-emerald-300">
              Prediction: {m.prediction ? m.prediction.winner : "No prediction"}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
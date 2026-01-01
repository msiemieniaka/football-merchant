import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import MatchesPage from './pages/MatchesPage'
import MatchAnalyticsPage from './pages/MatchAnalyticsPage'
import TablePage from './pages/TablePage'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-gray-100 font-sans pb-20">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/match/:id" element={<MatchAnalyticsPage />} />
            <Route path="/table" element={<TablePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
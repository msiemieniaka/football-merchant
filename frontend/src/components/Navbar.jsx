import { Link, useLocation } from 'react-router-dom'

function Navbar() {
  const location = useLocation()
  
  const NavLink = ({ to, label, icon }) => {
    const active = location.pathname === to
    return (
      <Link 
        to={to} 
        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
          active 
            ? 'bg-emerald-500/10 text-emerald-400' 
            : 'text-gray-400 hover:text-white hover:bg-slate-800'
        }`}
      >
        <span className="mr-2">{icon}</span> {label}
      </Link>
    )
  }

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50 shadow-lg backdrop-blur-sm bg-opacity-90">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link to="/" className="flex items-center mr-8">
              <span className="text-2xl mr-2">⚽</span>
              <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Football AI
              </h1>
            </Link>
            <div className="flex space-x-2">
              <NavLink to="/" label="Home" icon="🏠" />
              <NavLink to="/matches" label="Matches" icon="📅" />
              <NavLink to="/table" label="Table" icon="🏆" />
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

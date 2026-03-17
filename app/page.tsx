'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import PinLogin from '@/components/PinLogin'
import PickCard from '@/components/PickCard'
import Leaderboard from '@/components/Leaderboard'
import AdminPanel from '@/components/AdminPanel'
import { getGames, getPicksByPlayer, DBGame, DBPick } from '@/lib/supabase'
import { ROUND_CONFIG } from '@/lib/bracketData'

type View = 'picks' | 'leaderboard' | 'admin'

const REGIONS = ['East', 'West', 'Midwest', 'South'] as const

export default function Home() {
  const { player, isAdmin, logout, loading } = useAuth()
  const [view, setView] = useState<View>('picks')
  const [selectedRound, setSelectedRound] = useState<number>(64)
  const [selectedRegion, setSelectedRegion] = useState<string>('All')
  const [games, setGames] = useState<DBGame[]>([])
  const [picks, setPicks] = useState<DBPick[]>([])
  const [gamesLoading, setGamesLoading] = useState(true)

  useEffect(() => {
    if (player) loadData()
  }, [player, selectedRound])

  async function loadData() {
    setGamesLoading(true)
    const [g, p] = await Promise.all([
      getGames(selectedRound),
      player ? getPicksByPlayer(player.id) : Promise.resolve([]),
    ])
    setGames(g)
    setPicks(p)
    setGamesLoading(false)
  }

  if (loading) return <div className="fullpage-loading">Loading…</div>
  if (!player) return <PinLogin />

  const roundLabels: Record<number, string> = { 64: 'R64', 32: 'R32', 16: 'S16', 8: 'E8', 4: 'F4', 2: 'CG' }
  const config = ROUND_CONFIG[selectedRound]

  const filteredGames = selectedRegion === 'All'
    ? games
    : games.filter(g => g.region === selectedRegion)

  const pickedCount = picks.filter(p => games.some(g => g.id === p.game_id)).length
  const totalGames = games.length

  return (
    <div className="app">
      {/* Top nav */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-year">2026</span>
            <span className="logo-text">March Madness Pool</span>
          </div>
        </div>
        <div className="header-right">
          <span className="player-name-badge">{player.name}</span>
          <button className="logout-btn" onClick={logout}>Sign Out</button>
        </div>
      </header>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        <button className={`nav-item ${view === 'picks' ? 'active' : ''}`} onClick={() => setView('picks')}>
          <span className="nav-icon">🏀</span>
          <span>Picks</span>
        </button>
        <button className={`nav-item ${view === 'leaderboard' ? 'active' : ''}`} onClick={() => setView('leaderboard')}>
          <span className="nav-icon">🏆</span>
          <span>Standings</span>
        </button>
        {isAdmin && (
          <button className={`nav-item ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>
            <span className="nav-icon">⚙️</span>
            <span>Admin</span>
          </button>
        )}
      </nav>

      <main className="app-main">
        {/* PICKS VIEW */}
        {view === 'picks' && (
          <div className="picks-view">
            {/* Round selector */}
            <div className="round-selector">
              {[64, 32, 16, 8, 4, 2].map(r => {
                const cfg = ROUND_CONFIG[r]
                return (
                  <button
                    key={r}
                    className={`round-btn ${selectedRound === r ? 'active' : ''}`}
                    onClick={() => setSelectedRound(r)}
                  >
                    <span className="rb-label">{roundLabels[r]}</span>
                    <span className="rb-pts">{cfg.basePoints}+{cfg.bonusPoints}pt</span>
                  </button>
                )
              })}
            </div>

            {/* Round info bar */}
            <div className="round-info-bar">
              <span className="round-full-label">{config?.label}</span>
              {selectedRound === 64 && (
                <span className="deadline-badge">🔒 Locks Thursday 12:15 PM ET</span>
              )}
              <span className="pick-progress">{pickedCount}/{totalGames} picked</span>
            </div>

            {/* Region filter */}
            <div className="region-filter">
              {(['All', ...REGIONS] as const).map(r => (
                <button
                  key={r}
                  className={`region-btn ${selectedRegion === r ? 'active' : ''}`}
                  onClick={() => setSelectedRegion(r)}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Game grid */}
            {gamesLoading ? (
              <div className="loading-state">Loading games…</div>
            ) : (
              <div className="game-grid">
                {filteredGames.map(game => {
                  const existingPick = picks.find(p => p.game_id === game.id)
                  return (
                    <PickCard
                      key={game.id}
                      game={game}
                      existingPick={existingPick}
                      onPickSaved={savedPick => {
                        setPicks(prev => {
                          const without = prev.filter(p => p.game_id !== game.id)
                          return [...without, savedPick]
                        })
                      }}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* LEADERBOARD VIEW */}
        {view === 'leaderboard' && (
          <div className="leaderboard-view">
            <Leaderboard />
          </div>
        )}

        {/* ADMIN VIEW */}
        {view === 'admin' && isAdmin && (
          <div className="admin-view">
            <AdminPanel />
          </div>
        )}
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0f1e; color: white; }
      `}</style>

      <style jsx>{`
        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #0a0f1e;
          background-image:
            radial-gradient(ellipse at 15% 0%, rgba(255,140,0,0.06) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 100%, rgba(0,100,255,0.06) 0%, transparent 45%);
          font-family: 'Barlow', sans-serif;
          padding-bottom: 5rem;
        }
        .fullpage-loading {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.4);
          font-family: 'Barlow', sans-serif;
          background: #0a0f1e;
        }

        /* Header */
        .app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem 0.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          position: sticky;
          top: 0;
          background: rgba(10, 15, 30, 0.95);
          backdrop-filter: blur(12px);
          z-index: 100;
        }
        .logo {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .logo-year {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.65rem;
          font-weight: 800;
          color: #ff8c00;
          letter-spacing: 0.2em;
        }
        .logo-text {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 1.1rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: white;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .player-name-badge {
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
        }
        .logout-btn {
          background: none;
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.4);
          border-radius: 6px;
          padding: 0.25rem 0.6rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s;
          font-family: 'Barlow', sans-serif;
        }
        .logout-btn:hover { color: white; border-color: rgba(255,255,255,0.4); }

        /* Bottom nav */
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          background: rgba(10,15,30,0.97);
          border-top: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
          z-index: 100;
          padding: 0.5rem 0 calc(0.5rem + env(safe-area-inset-bottom));
        }
        .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          background: none;
          border: none;
          color: rgba(255,255,255,0.35);
          font-size: 0.65rem;
          font-weight: 600;
          font-family: 'Barlow', sans-serif;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          padding: 0.4rem 0;
          transition: color 0.15s;
        }
        .nav-item.active { color: #ff8c00; }
        .nav-icon { font-size: 1.2rem; }

        /* Main */
        .app-main {
          flex: 1;
          padding: 1rem 1rem 0;
          max-width: 700px;
          margin: 0 auto;
          width: 100%;
        }

        /* Picks view */
        .picks-view { display: flex; flex-direction: column; gap: 1rem; }
        .round-selector {
          display: flex;
          gap: 0.4rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .round-selector::-webkit-scrollbar { display: none; }
        .round-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5rem 0.9rem;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
          gap: 0.1rem;
        }
        .round-btn.active {
          border-color: #ff8c00;
          background: rgba(255,140,0,0.12);
          color: white;
        }
        .rb-label {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.9rem;
          font-weight: 800;
          letter-spacing: 0.05em;
        }
        .rb-pts {
          font-size: 0.6rem;
          color: rgba(255,255,255,0.35);
        }
        .round-btn.active .rb-pts { color: rgba(255,140,0,0.7); }

        .round-info-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .round-full-label {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 1rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: white;
        }
        .deadline-badge {
          font-size: 0.7rem;
          color: #ff8c00;
          background: rgba(255,140,0,0.12);
          border-radius: 4px;
          padding: 2px 8px;
          font-weight: 600;
        }
        .pick-progress {
          margin-left: auto;
          font-size: 0.75rem;
          color: rgba(255,255,255,0.4);
        }

        .region-filter {
          display: flex;
          gap: 0.4rem;
        }
        .region-btn {
          padding: 0.3rem 0.75rem;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.45);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          font-family: 'Barlow', sans-serif;
        }
        .region-btn.active {
          border-color: rgba(255,140,0,0.5);
          background: rgba(255,140,0,0.1);
          color: #ff8c00;
        }

        .game-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
        }
        @media (min-width: 500px) {
          .game-grid { grid-template-columns: 1fr 1fr; }
        }

        .loading-state {
          text-align: center;
          padding: 2rem;
          color: rgba(255,255,255,0.35);
          font-size: 0.9rem;
        }

        .leaderboard-view, .admin-view {
          padding-bottom: 1rem;
        }
      `}</style>
    </div>
  )
}

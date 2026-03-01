'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const WINNER_PTS = [0, 4, 5, 6, 8]
const GAMES_BONUS = [0, 1, 1, 2, 3]

function calcPoints(round, correctWinner, actualGames, pickedGames) {
  if (!correctWinner) {
    const diff = Math.abs(actualGames - pickedGames)
    const penalties = [0, 0, -1, -2, -3, -4, -4, -4]
    return penalties[Math.min(diff, 7)]
  }
  const winPts = WINNER_PTS[round]
  const diff = Math.abs(actualGames - pickedGames)
  const gamePts = diff === 0 ? GAMES_BONUS[round] : diff === 1 ? 0 : [-1, -2, -3, -4, -4][Math.min(diff - 2, 4)]
  return winPts + gamePts
}

const TEAM_EMOJI = {
  "Boston Bruins": "🐻", "Toronto Maple Leafs": "🍁",
  "Florida Panthers": "🐆", "Tampa Bay Lightning": "⚡",
  "Colorado Avalanche": "🏔️", "Dallas Stars": "⭐",
  "Vegas Golden Knights": "⚔️", "LA Kings": "👑",
  "Boston Celtics": "🍀", "Miami Heat": "🔥",
  "Milwaukee Bucks": "🦌", "Indiana Pacers": "🏎️",
  "Denver Nuggets": "⛏️", "LA Lakers": "💜",
  "Oklahoma City Thunder": "⚡", "New Orleans Pelicans": "🦅",
  "Edmonton Oilers": "🛢️", "Vancouver Canucks": "🐳",
  "Carolina Hurricanes": "🌀", "New York Rangers": "🗽",
  "Winnipeg Jets": "✈️", "St. Louis Blues": "🎵",
  "Minnesota Wild": "🌲", "Seattle Kraken": "🐙",
  "Cleveland Cavaliers": "⚔️", "Orlando Magic": "✨",
  "New York Knicks": "🗽", "Philadelphia 76ers": "🔔",
  "Minnesota Timberwolves": "🐺", "Golden State Warriors": "🌉",
  "Houston Rockets": "🚀", "Memphis Grizzlies": "🐻",
}

export default function PlayoffPool() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('picks')
  const [toast, setToast] = useState(null)
  const [series, setSeries] = useState({ NHL: [], NBA: [] })
  const [userPicks, setUserPicks] = useState({})
  const [pendingPicks, setPendingPicks] = useState({})
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(false)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (user) {
      loadSeries()
      loadPicks()
      loadParticipants()
    }
  }, [user])

  // Auto-lock series when game1 time passes
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date()
      const { data } = await supabase
        .from('series')
        .select('*')
        .eq('locked', false)
      if (data) {
        data.forEach(async (s) => {
          if (s.game1_time && new Date(s.game1_time) <= now) {
            await supabase.from('series').update({ locked: true }).eq('id', s.id)
          }
        })
        loadSeries()
      }
    }, 60000) // check every minute
    return () => clearInterval(interval)
  }, [])

  async function loadSeries() {
    const { data } = await supabase.from('series').select('*').order('round').order('game1_time')
    if (data) {
      setSeries({
        NHL: data.filter(s => s.league === 'NHL'),
        NBA: data.filter(s => s.league === 'NBA'),
      })
    }
  }

  async function loadPicks() {
    const { data } = await supabase.from('picks').select('*').eq('user_id', user.id)
    if (data) {
      const mapped = {}
      data.forEach(p => { mapped[p.series_id] = { winner: p.picked_winner, games: p.picked_games } })
      setUserPicks(mapped)
    }
  }

  async function loadParticipants() {
    const { data: users } = await supabase.from('users').select('*')
    const { data: allPicks } = await supabase.from('picks').select('*')
    const { data: allSeries } = await supabase.from('series').select('*')
    if (users && allPicks && allSeries) {
      const scored = users.map(u => {
        let nhlTotal = 0, nbaTotal = 0
        allSeries.forEach(s => {
          if (!s.result_winner) return
          const pick = allPicks.find(p => p.user_id === u.id && p.series_id === s.id)
          if (!pick) return
          const pts = calcPoints(s.round, pick.picked_winner === s.result_winner, s.result_games, pick.picked_games)
          if (s.league === 'NHL') nhlTotal += pts
          else nbaTotal += pts
        })
        return { ...u, nhlTotal, nbaTotal, combined: nhlTotal + nbaTotal }
      })
      setParticipants(scored)
    }
  }

  async function handleLogin(fullName, pin) {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('full_name', fullName)
      .single()
    if (error || !data) {
      setLoading(false)
      return 'User not found'
    }
    if (data.pin_hash !== pin) {
      setLoading(false)
      return 'Incorrect PIN'
    }
    setUser(data)
    setLoading(false)
    return null
  }

  async function handleRegister(fullName, phone, pin) {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .insert({ full_name: fullName, phone, pin_hash: pin })
      .select()
      .single()
    if (error) {
      setLoading(false)
      return error.message.includes('unique') ? 'Phone number already registered' : 'Registration failed'
    }
    setUser(data)
    setLoading(false)
    return null
  }

  async function submitPick(seriesId) {
    const p = pendingPicks[seriesId]
    if (!p?.winner || !p?.games) return
    const { error } = await supabase.from('picks').upsert({
      user_id: user.id,
      series_id: seriesId,
      picked_winner: p.winner,
      picked_games: p.games,
    }, { onConflict: 'user_id,series_id' })
    if (!error) {
      setUserPicks(prev => ({ ...prev, [seriesId]: p }))
      setPendingPicks(prev => { const n = { ...prev }; delete n[seriesId]; return n })
      showToast('Pick submitted! ✓')
    }
  }

  async function toggleLock(league, id) {
    const s = series[league].find(s => s.id === id)
    await supabase.from('series').update({ locked: !s.locked }).eq('id', id)
    loadSeries()
    showToast(s.locked ? 'Series unlocked' : 'Series locked 🔒')
  }

  async function enterResult(seriesId, winner, games) {
    await supabase.from('series').update({ result_winner: winner, result_games: games }).eq('id', seriesId)
    loadSeries()
    loadParticipants()
    showToast('Result saved ✓')
  }

  if (!user) return (
    <>
      <style>{css}</style>
      <LoginScreen onLogin={handleLogin} onRegister={handleRegister} loading={loading} />
    </>
  )

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="content">
          <nav className="nav">
            <div className="nav-logo">
              <span style={{color:"#f59e0b"}}>2026 </span>
              <span style={{color:"#e8eaf0"}}>PLAYOFF </span>
              <span style={{color:"#3b82f6"}}>POOL</span>
            </div>
            <div className="nav-tabs">
              <button className={`nav-tab ${page === 'picks' ? 'active' : ''}`} onClick={() => setPage('picks')}>My Picks</button>
              <button className={`nav-tab ${page === 'standings' ? 'active' : ''}`} onClick={() => setPage('standings')}>Standings</button>
              {user.is_admin && <button className={`nav-tab ${page === 'admin' ? 'active' : ''}`} onClick={() => setPage('admin')}>Admin</button>}
            </div>
            <div className="nav-user">
              <strong>{user.full_name}</strong>
              <button className="logout-btn" onClick={() => setUser(null)}>Sign Out</button>
            </div>
          </nav>
          <main>
            {page === 'picks' && <PicksPage series={series} userPicks={userPicks} pendingPicks={pendingPicks} setPendingPicks={setPendingPicks} submitPick={submitPick} />}
            {page === 'standings' && <StandingsPage participants={participants} />}
            {page === 'admin' && user.is_admin && <AdminPage series={series} toggleLock={toggleLock} enterResult={enterResult} participants={participants} showToast={showToast} />}
          </main>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

function LoginScreen({ onLogin, onRegister, loading }) {
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')

  function handlePin(i, val) {
    if (!/^\d?$/.test(val)) return
    const next = [...pin]; next[i] = val; setPin(next)
    if (val && i < 3) document.getElementById(`pin-${i+1}`)?.focus()
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Please enter your name'); return }
    if (pin.join('').length < 4) { setError('Please enter your 4-digit PIN'); return }
    setError('')
    const err = isRegister
      ? await onRegister(name.trim(), phone.trim(), pin.join(''))
      : await onLogin(name.trim(), pin.join(''))
    if (err) setError(err)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-title">
          <span style={{color:"#f59e0b"}}>2026 </span>
          <span style={{color:"#e8eaf0"}}>PLAYOFF </span>
          <span style={{color:"#3b82f6"}}>POOL</span>
        </div>
        <div className="login-sub">{new Date().getFullYear()} NHL & NBA Playoffs</div>
        {error && <div className="error-msg">{error}</div>}
        <div className="field-label">Full Name</div>
        <input className="field-input" placeholder="e.g. Alex Thompson" value={name} onChange={e => setName(e.target.value)} />
        {isRegister && <>
          <div className="field-label">Phone Number</div>
          <input className="field-input" placeholder="(555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
        </>}
        <div className="field-label">4-Digit PIN</div>
        <div className="pin-row">
          {pin.map((d, i) => (
            <input key={i} id={`pin-${i}`} className="pin-input" type="password" inputMode="numeric" maxLength={1} value={d} onChange={e => handlePin(i, e.target.value)} />
          ))}
        </div>
        <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
        </button>
        <div className="register-link">
          {isRegister ? 'Already have an account? ' : 'New to the pool? '}
          <button onClick={() => { setIsRegister(!isRegister); setError('') }}>
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PicksPage({ series, userPicks, pendingPicks, setPendingPicks, submitPick }) {
  const [league, setLeague] = useState('NHL')
  const currentSeries = series[league]
  const rounds = [...new Set(currentSeries.map(s => s.round))].sort((a,b) => b - a)
  const maxRound = rounds[0] || 1

  const [collapsed, setCollapsed] = useState({})
  useEffect(() => {
    const init = {}
    rounds.forEach(r => { init[r] = r < maxRound })
    setCollapsed(init)
  }, [league, series])

  function setPick(seriesId, field, val) {
    setPendingPicks(prev => ({ ...prev, [seriesId]: { ...(prev[seriesId] || {}), [field]: val } }))
  }

  const ROUND_NAMES = { 1: 'First Round', 2: 'Second Round', 3: 'Conference Finals', 4: 'Stanley Cup / NBA Finals' }

  if (currentSeries.length === 0) return (
    <div className="page">
      <div className="page-title">My Picks</div>
      <div style={{color: 'rgba(255,255,255,0.4)', marginTop: 40, textAlign: 'center'}}>
        No series have been added yet. Check back soon!
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-title">My Picks</div>
      <div className="page-sub">Submit your picks before Game 1 — picks lock automatically at puck/tip-off.</div>
      <div className="league-tabs">
        <button className={`league-tab ${league === 'NHL' ? 'active-nhl' : ''}`} onClick={() => setLeague('NHL')}>🏒 NHL Playoffs</button>
        <button className={`league-tab ${league === 'NBA' ? 'active-nba' : ''}`} onClick={() => setLeague('NBA')}>🏀 NBA Playoffs</button>
      </div>
      {rounds.map(r => {
        const isCurrentRound = r === maxRound
        const isCollapsed = collapsed[r]
        const roundSeries = currentSeries.filter(s => s.round === r)
        const roundPts = roundSeries.reduce((sum, s) => {
          const pick = userPicks[s.id]
          if (!pick || !s.result_winner) return sum
          return sum + calcPoints(s.round, pick.winner === s.result_winner, s.result_games, pick.games)
        }, 0)
        const pickedCount = roundSeries.filter(s => userPicks[s.id]).length

        return (
          <div key={r} style={{marginBottom: 16}}>
            <div
              onClick={() => !isCurrentRound && setCollapsed(prev => ({ ...prev, [r]: !prev[r] }))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderRadius: isCollapsed ? 12 : '12px 12px 0 0',
                background: isCurrentRound ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isCurrentRound ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderBottom: !isCollapsed ? 'none' : undefined,
                cursor: isCurrentRound ? 'default' : 'pointer',
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <div style={{fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: isCurrentRound ? '#60a5fa' : 'rgba(255,255,255,0.5)'}}>
                  Round {r} <span style={{fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: 400, letterSpacing: 0, color: 'rgba(255,255,255,0.3)'}}> · {ROUND_NAMES[r]}</span>
                </div>
                {isCurrentRound && <span style={{fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: '3px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.2)', color: '#60a5fa'}}>ACTIVE</span>}
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                {!isCurrentRound && (
                  <div style={{fontSize: 13, color: 'rgba(255,255,255,0.4)'}}>
                    {pickedCount}/{roundSeries.length} picks · <span style={{color: roundPts >= 0 ? '#86efac' : '#fca5a5', fontWeight: 700}}>{roundPts >= 0 ? '+' : ''}{roundPts} pts</span>
                  </div>
                )}
                {!isCurrentRound && <div style={{color: 'rgba(255,255,255,0.3)', fontSize: 18, transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'}}>▾</div>}
              </div>
            </div>
            {!isCollapsed && (
              <div style={{border: `1px solid ${isCurrentRound ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`, borderTop: 'none', borderRadius: '0 0 12px 12px', padding: 16, background: 'rgba(255,255,255,0.01)'}}>
                <div className="series-grid">
                  {roundSeries.map(s => {
                    const submitted = userPicks[s.id]
                    const pending = pendingPicks[s.id] || {}
                    const displayPick = s.locked ? submitted : (pending.winner ? pending : submitted)
                    const isSubmitted = !!submitted && !pendingPicks[s.id]
                    let pts = null
                    if (submitted && s.result_winner) {
                      pts = calcPoints(s.round, submitted.winner === s.result_winner, s.result_games, submitted.games)
                    }
                    return (
                      <div key={s.id} className={`series-card ${s.locked ? 'locked' : isSubmitted ? 'submitted' : ''}`}>
                        <div style={{fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12, letterSpacing: 1}}>
                          GAME 1 · {s.game1_time ? new Date(s.game1_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD'}
                        </div>
                        <div className="matchup">
                          {[s.home_team, s.away_team].map(team => (
                            <button key={team} className={`team-opt ${displayPick?.winner === team ? 'selected' : ''}`} disabled={s.locked} onClick={() => setPick(s.id, 'winner', team)}>
                              <div style={{fontSize: 28, marginBottom: 6}}>{TEAM_EMOJI[team] || '🏒'}</div>
                              <div>{team}</div>
                            </button>
                          ))}
                        </div>
                        <div className="games-row">
                          <div className="games-label">Series Length</div>
                          <div className="games-opts">
                            {[4,5,6,7].map(g => (
                              <button key={g} className={`game-num ${displayPick?.games === g ? 'selected' : ''}`} disabled={s.locked} onClick={() => setPick(s.id, 'games', g)}>{g}</button>
                            ))}
                          </div>
                        </div>
                        {s.result_winner ? (
                          <div className="result-badge">
                            <span>Result: <strong>{s.result_winner}</strong> in {s.result_games}</span>
                            {pts !== null && <span className={`pts-badge ${pts >= 0 ? 'pts-pos' : 'pts-neg'}`}>{pts >= 0 ? '+' : ''}{pts} pts</span>}
                          </div>
                        ) : !s.locked && (
                          <button className="submit-pick-btn" disabled={!pending.winner || !pending.games} onClick={() => submitPick(s.id)}>
                            {submitted ? 'Update Pick' : 'Submit Pick'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StandingsPage({ participants }) {
  const [view, setView] = useState('combined')
  const sorted = [...participants].sort((a, b) =>
    view === 'nhl' ? b.nhlTotal - a.nhlTotal :
    view === 'nba' ? b.nbaTotal - a.nbaTotal :
    b.combined - a.combined
  )
  const payoutCount = view === 'combined' ? 3 : 2

  return (
    <div className="page">
      <div className="page-title">Standings</div>
      <div className="page-sub">Updated after each series result. Top {view === 'combined' ? '3 combined' : '2'} win a payout.</div>
      <div className="standings-tabs">
        <button className={`std-tab ${view === 'combined' ? 'active' : ''}`} onClick={() => setView('combined')}>🏆 Combined</button>
        <button className={`std-tab ${view === 'nhl' ? 'active' : ''}`} onClick={() => setView('nhl')}>🏒 NHL</button>
        <button className={`std-tab ${view === 'nba' ? 'active' : ''}`} onClick={() => setView('nba')}>🏀 NBA</button>
      </div>
      <div style={{background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden'}}>
        <table className="standings-table">
          <thead>
            <tr>
              <th style={{width: 60}}>#</th>
              <th>Participant</th>
              <th style={{textAlign:'right'}}>NHL</th>
              <th style={{textAlign:'right'}}>NBA</th>
              <th style={{textAlign:'right'}}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const rank = i + 1
              const isPayout = rank <= payoutCount
              return (
                <tr key={p.id} className={isPayout ? 'payout-row' : ''}>
                  <td><span className={`rank-num ${rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : ''}`}>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</span></td>
                  <td>{p.full_name}{isPayout && <span className={`payout-badge ${rank === 1 ? 'payout-gold' : 'payout-silver'}`}>PAYOUT</span>}</td>
                  <td style={{textAlign:'right', color: p.nhlTotal >= 0 ? '#86efac' : '#fca5a5', fontWeight: 600}}>{p.nhlTotal >= 0 ? '+' : ''}{p.nhlTotal}</td>
                  <td style={{textAlign:'right', color: p.nbaTotal >= 0 ? '#86efac' : '#fca5a5', fontWeight: 600}}>{p.nbaTotal >= 0 ? '+' : ''}{p.nbaTotal}</td>
                  <td style={{textAlign:'right'}}><span className={`score-val ${p.combined >= 0 ? 'score-pos' : ''}`}>{p.combined >= 0 ? '+' : ''}{p.combined}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminPage({ series, toggleLock, enterResult, participants, showToast }) {
  const allSeries = [...series.NHL, ...series.NBA]
  const [resultInputs, setResultInputs] = useState({})

  return (
    <div className="page">
      <div className="page-title">Admin Panel</div>
      <div className="page-sub">Manage series, enter results, and send notifications.</div>
      <div className="admin-grid">
        <div className="admin-card" style={{gridColumn: '1 / -1'}}>
          <h3>Series Management</h3>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px'}}>
            {['NHL','NBA'].map(lg => (
              <div key={lg}>
                <div style={{fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.3)', marginBottom: 10, textTransform:'uppe

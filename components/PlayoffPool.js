'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const WINNER_PTS = [0, 4, 5, 6, 8]
const GAMES_BONUS = [0, 1, 1, 2, 3]

function calcPoints(round, pickedWinner, actualWinner, actualGames, pickedGames) {
  const scale = [
    { winner: actualWinner, games: 4 },
    { winner: actualWinner, games: 5 },
    { winner: actualWinner, games: 6 },
    { winner: actualWinner, games: 7 },
    { winner: 'loser', games: 7 },
    { winner: 'loser', games: 6 },
    { winner: 'loser', games: 5 },
    { winner: 'loser', games: 4 },
  ]
  const actualPos = scale.findIndex(s => s.winner === actualWinner && s.games === actualGames)
  const pickedIsWinner = pickedWinner === actualWinner
  const pickedPos = scale.findIndex(s =>
    pickedIsWinner
      ? (s.winner === actualWinner && s.games === pickedGames)
      : (s.winner === 'loser' && s.games === pickedGames)
  )
  const diff = Math.abs(actualPos - pickedPos)
  const correctWinner = pickedWinner === actualWinner
  const winPts = correctWinner ? WINNER_PTS[round] : 0
  const gameAdj = diff === 0 ? GAMES_BONUS[round] : diff === 1 ? 0 : [-1, -2, -3, -4, -4][Math.min(diff - 2, 4)]
  return winPts + gameAdj
}

const TEAM_COLORS = {
  "Boston Bruins":           { bg: "#FFB81C", text: "#000000" },
  "Toronto Maple Leafs":     { bg: "#003E7E", text: "#ffffff" },
  "Florida Panthers":        { bg: "#C8102E", text: "#ffffff" },
  "Tampa Bay Lightning":     { bg: "#002868", text: "#ffffff" },
  "Colorado Avalanche":      { bg: "#6F263D", text: "#ffffff" },
  "Dallas Stars":            { bg: "#006847", text: "#ffffff" },
  "Vegas Golden Knights":    { bg: "#B4975A", text: "#000000" },
  "LA Kings":                { bg: "#A2AAAD", text: "#000000" },
  "Edmonton Oilers":         { bg: "#FF4C00", text: "#ffffff" },
  "Vancouver Canucks":       { bg: "#00843D", text: "#ffffff" },
  "Carolina Hurricanes":     { bg: "#CC0000", text: "#ffffff" },
  "New York Rangers":        { bg: "#0038A8", text: "#ffffff" },
  "Winnipeg Jets":           { bg: "#004C97", text: "#ffffff" },
  "St. Louis Blues":         { bg: "#002F87", text: "#ffffff" },
  "Minnesota Wild":          { bg: "#154734", text: "#ffffff" },
  "Seattle Kraken":          { bg: "#001628", text: "#99D9D9" },
  "Boston Celtics":          { bg: "#007A33", text: "#ffffff" },
  "Miami Heat":              { bg: "#98002E", text: "#ffffff" },
  "Milwaukee Bucks":         { bg: "#00471B", text: "#ffffff" },
  "Indiana Pacers":          { bg: "#002D62", text: "#ffffff" },
  "Denver Nuggets":          { bg: "#0E2240", text: "#FEC524" },
  "LA Lakers":               { bg: "#552583", text: "#FDB927" },
  "Oklahoma City Thunder":   { bg: "#007AC1", text: "#ffffff" },
  "New Orleans Pelicans":    { bg: "#0C2340", text: "#C8102E" },
  "Cleveland Cavaliers":     { bg: "#860038", text: "#ffffff" },
  "Orlando Magic":           { bg: "#0077C0", text: "#ffffff" },
  "New York Knicks":         { bg: "#006BB6", text: "#ffffff" },
  "Philadelphia 76ers":      { bg: "#006BB6", text: "#ffffff" },
  "Minnesota Timberwolves":  { bg: "#0C2340", text: "#236192" },
  "Golden State Warriors":   { bg: "#1D428A", text: "#FFC72C" },
  "Houston Rockets":         { bg: "#CE1141", text: "#ffffff" },
  "Memphis Grizzlies":       { bg: "#5D76A9", text: "#12173F" },
}

function MobileNav({ page, setPage, isAdmin }) {
  const [open, setOpen] = useState(false)
  const pages = [
    { key: 'picks', label: 'My Picks' },
    { key: 'standings', label: 'Standings' },
    { key: 'distributions', label: 'Pick Distributions' },
    { key: 'scoring', label: 'Scoring Rules' },
  ]
  if (isAdmin) pages.push({ key: 'admin', label: 'Commissioner' })
  return (
    <>
      <button className="mobile-menu" onClick={() => setOpen(!open)}>☰</button>
      {open && (
        <div className="mobile-dropdown">
          {pages.map(p => (
            <button key={p.key} className={page === p.key ? 'active' : ''} onClick={() => { setPage(p.key); setOpen(false) }}>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export default function PlayoffPool() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('picks')
  const [toast, setToast] = useState(null)
  const [series, setSeries] = useState({ NHL: [], NBA: [] })
  const [userPicks, setUserPicks] = useState({})
  const [pendingPicks, setPendingPicks] = useState({})
  const [participants, setParticipants] = useState([])
  const [allPicks, setAllPicks] = useState([])
  const [loading, setLoading] = useState(false)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (user) {
      loadSeries()
      loadPicks()
      loadParticipants()
    }
  }, [user])

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date()
      const { data } = await supabase.from('series').select('*').eq('locked', false)
      if (data) {
        data.forEach(async (s) => {
          if (s.game1_time && new Date(s.game1_time) <= now) {
            await supabase.from('series').update({ locked: true }).eq('id', s.id)
          }
        })
        loadSeries()
      }
    }, 60000)
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
    const { data: picks } = await supabase.from('picks').select('*')
    const { data: allSeries } = await supabase.from('series').select('*')
    if (users && picks && allSeries) {
      setAllPicks(picks)
      const scored = users.map(u => {
        let nhlTotal = 0, nbaTotal = 0
        allSeries.forEach(s => {
          if (!s.result_winner) return
          const pick = picks.find(p => p.user_id === u.id && p.series_id === s.id)
          if (!pick) {
            if (s.league === 'NHL') nhlTotal -= 4
            else nbaTotal -= 4
            return
          }
          const pts = calcPoints(s.round, pick.picked_winner, s.result_winner, s.result_games, pick.picked_games)
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
    const { data, error } = await supabase.from('users').select('*').eq('full_name', fullName).single()
    if (error || !data) { setLoading(false); return 'User not found' }
    if (data.pin_hash !== pin) { setLoading(false); return 'Incorrect PIN' }
    setUser(data)
    setLoading(false)
    return null
  }

  async function handleRegister(fullName, phone, pin) {
    setLoading(true)
    const { data, error } = await supabase.from('users').insert({ full_name: fullName, phone, pin_hash: pin }).select().single()
    if (error) { setLoading(false); return error.message.includes('unique') ? 'Phone number already registered' : 'Registration failed' }
    setUser(data)
    setLoading(false)
    return null
  }

  async function submitPick(seriesId) {
    const p = pendingPicks[seriesId]
    if (!p?.winner || !p?.games) return
    const { error } = await supabase.from('picks').upsert({
      user_id: user.id, series_id: seriesId,
      picked_winner: p.winner, picked_games: p.games,
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
              <span className="nav-year">2026</span>
              <span className="nav-title">Playoff Pool</span>
            </div>
            <div className="nav-tabs">
              <button className={`nav-tab ${page === 'picks' ? 'active' : ''}`} onClick={() => setPage('picks')}>My Picks</button>
              <button className={`nav-tab ${page === 'standings' ? 'active' : ''}`} onClick={() => setPage('standings')}>Standings</button>
              <button className={`nav-tab ${page === 'distributions' ? 'active' : ''}`} onClick={() => setPage('distributions')}>Pick Distributions</button>
              <button className={`nav-tab ${page === 'scoring' ? 'active' : ''}`} onClick={() => setPage('scoring')}>Scoring Rules</button>
              {user.is_admin && <button className={`nav-tab ${page === 'admin' ? 'active' : ''}`} onClick={() => setPage('admin')}>Commissioner</button>}
            </div>
            <MobileNav page={page} setPage={setPage} isAdmin={user.is_admin} />
            <div className="nav-user">
              <strong>{user.full_name}</strong>
              <button className="logout-btn" onClick={() => setUser(null)}>Sign Out</button>
            </div>
          </nav>
          <main>
            {page === 'picks' && <PicksPage series={series} userPicks={userPicks} pendingPicks={pendingPicks} setPendingPicks={setPendingPicks} submitPick={submitPick} />}
            {page === 'standings' && <StandingsPage participants={participants} />}
            {page === 'distributions' && <DistributionsPage series={series} allPicks={allPicks} participants={participants} />}
            {page === 'scoring' && <ScoringRulesPage />}
            {page === 'admin' && user.is_admin && <AdminPage series={series} toggleLock={toggleLock} enterResult={enterResult} participants={participants} allPicks={allPicks} showToast={showToast} />}
          </main>
        </div>
      </div>
      {toast && <div className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`}>{toast.msg}</div>}
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
        <div className="login-logo">
          <span className="login-year">2026</span>
          <span className="login-title">Playoff Pool</span>
        </div>
        <div className="login-sub">NHL & NBA Playoffs</div>
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
      <div style={{color: 'rgba(255,255,255,0.4)', marginTop: 40, textAlign: 'center'}}>No series have been added yet. Check back soon!</div>
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
          return sum + calcPoints(s.round, pick.winner, s.result_winner, s.result_games, pick.games)
        }, 0)
        const pickedCount = roundSeries.filter(s => userPicks[s.id]).length
        return (
          <div key={r} style={{marginBottom: 16}}>
            <div
              onClick={() => !isCurrentRound && setCollapsed(prev => ({ ...prev, [r]: !prev[r] }))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderRadius: isCollapsed ? 8 : '8px 8px 0 0',
                background: isCurrentRound ? 'rgba(201,149,42,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isCurrentRound ? 'rgba(201,149,42,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderBottom: !isCollapsed ? 'none' : undefined,
                cursor: isCurrentRound ? 'default' : 'pointer',
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <div style={{fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 2, color: isCurrentRound ? '#c9952a' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase'}}>
                  Round {r} <span style={{fontSize: 13, fontFamily: "'Barlow', sans-serif", fontWeight: 400, letterSpacing: 0, color: 'rgba(255,255,255,0.3)'}}> · {ROUND_NAMES[r]}</span>
                </div>
                {isCurrentRound && <span style={{fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '3px 8px', borderRadius: 4, background: 'rgba(201,149,42,0.15)', color: '#c9952a', textTransform: 'uppercase'}}>Active</span>}
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                {!isCurrentRound && (
                  <div style={{fontSize: 13, color: 'rgba(255,255,255,0.4)'}}>
                    {pickedCount}/{roundSeries.length} picks · <span style={{color: roundPts >= 0 ? '#6ee87a' : '#f87171', fontWeight: 700}}>{roundPts >= 0 ? '+' : ''}{roundPts} pts</span>
                  </div>
                )}
                {!isCurrentRound && <div style={{color: 'rgba(255,255,255,0.3)', fontSize: 18, transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'}}>▾</div>}
              </div>
            </div>
            {!isCollapsed && (
              <div style={{border: `1px solid ${isCurrentRound ? 'rgba(201,149,42,0.3)' : 'rgba(255,255,255,0.07)'}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 16, background: 'rgba(255,255,255,0.01)'}}>
                <div className="series-grid">
                  {roundSeries.map(s => {
                    const submitted = userPicks[s.id]
                    const pending = pendingPicks[s.id] || {}
                    const displayPick = s.locked ? submitted : (pending.winner ? pending : submitted)
                    const isSubmitted = !!submitted && !pendingPicks[s.id]
                    let pts = null
                    if (submitted && s.result_winner) {
                      pts = calcPoints(s.round, submitted.winner, s.result_winner, s.result_games, submitted.games)
                    }
                    return (
                      <div key={s.id} className={`series-card ${s.locked ? 'locked' : isSubmitted ? 'submitted' : ''}`}>
                        <div style={{fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase'}}>
                          Game 1 · {s.game1_time ? new Date(s.game1_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD'}
                        </div>
                        <div className="matchup">
                          {[s.home_team, s.away_team].map(team => {
                            const isSelected = displayPick?.winner === team
                            const tc = TEAM_COLORS[team] || { bg: '#2a2f3e', text: '#ffffff' }
                            const isWinner = s.result_winner === team
                            return (
                              <button
                                key={team}
                                className="team-opt"
                                disabled={s.locked}
                                onClick={() => setPick(s.id, 'winner', team)}
                                style={{
                                  background: isSelected ? tc.bg : 'transparent',
                                  color: isSelected ? tc.text : 'rgba(255,255,255,0.6)',
                                  borderColor: isWinner && s.result_winner ? '#6ee87a' : isSelected ? tc.bg : 'rgba(255,255,255,0.1)',
                                  borderWidth: isWinner && s.result_winner ? 2 : 1.5,
                                }}
                              >
                                <div style={{fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 0.5}}>{team}</div>
                                {isSelected && !s.result_winner && <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1, marginTop: 4, opacity: 0.8, textTransform: 'uppercase'}}>Picked</div>}
                                {isWinner && s.result_winner && <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1, marginTop: 4, color: '#6ee87a', textTransform: 'uppercase'}}>Winner ✓</div>}
                              </button>
                            )
                          })}
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

function DistributionsPage({ series, allPicks, participants }) {
  const [league, setLeague] = useState('NHL')
  const currentSeries = series[league]
  const total = participants.length

  return (
    <div className="page">
      <div className="page-title">Pick Distributions</div>
      <div className="page-sub">See how the pool is split on every series — picks only visible after series locks.</div>
      <div className="league-tabs">
        <button className={`league-tab ${league === 'NHL' ? 'active-nhl' : ''}`} onClick={() => setLeague('NHL')}>🏒 NHL Playoffs</button>
        <button className={`league-tab ${league === 'NBA' ? 'active-nba' : ''}`} onClick={() => setLeague('NBA')}>🏀 NBA Playoffs</button>
      </div>
      {currentSeries.length === 0 && <div style={{color: 'rgba(255,255,255,0.4)', marginTop: 40, textAlign: 'center'}}>No series added yet.</div>}
      <div className="series-grid">
        {currentSeries.map(s => {
          const seriesPicks = allPicks.filter(p => p.series_id === s.id)
          const homePicks = seriesPicks.filter(p => p.picked_winner === s.home_team).length
          const awayPicks = seriesPicks.filter(p => p.picked_winner === s.away_team).length
          const totalPicks = seriesPicks.length
          const homePct = totalPicks > 0 ? Math.round((homePicks / totalPicks) * 100) : 50
          const awayPct = totalPicks > 0 ? Math.round((awayPicks / totalPicks) * 100) : 50
          const homeColor = TEAM_COLORS[s.home_team]?.bg || '#c9952a'
          const awayColor = TEAM_COLORS[s.away_team]?.bg || '#60a5fa'
          return (
            <div key={s.id} className="series-card">
              <div style={{fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase'}}>
                Round {s.round} · {totalPicks}/{total} picks submitted
              </div>
              {!s.locked ? (
                <div style={{textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13, padding: '20px 0'}}>
                  🔒 Distributions visible after series locks
                </div>
              ) : (
                <>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
                    <div style={{textAlign: 'center', flex: 1}}>
                      <div style={{width: 32, height: 4, borderRadius: 2, background: homeColor, margin: '0 auto 8px'}} />
                      <div style={{fontSize: 12, color: '#e8eaf0', marginBottom: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700}}>{s.home_team}</div>
                      <div style={{fontSize: 22, fontWeight: 700, color: homeColor}}>{homePct}%</div>
                      <div style={{fontSize: 11, color: 'rgba(255,255,255,0.3)'}}>{homePicks} picks</div>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', padding: '0 12px', color: 'rgba(255,255,255,0.2)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700}}>VS</div>
                    <div style={{textAlign: 'center', flex: 1}}>
                      <div style={{width: 32, height: 4, borderRadius: 2, background: awayColor, margin: '0 auto 8px'}} />
                      <div style={{fontSize: 12, color: '#e8eaf0', marginBottom: 2, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700}}>{s.away_team}</div>
                      <div style={{fontSize: 22, fontWeight: 700, color: awayColor}}>{awayPct}%</div>
                      <div style={{fontSize: 11, color: 'rgba(255,255,255,0.3)'}}>{awayPicks} picks</div>
                    </div>
                  </div>
                  <div style={{height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 8, display: 'flex'}}>
                    <div style={{width: `${homePct}%`, background: homeColor, transition: 'width 0.5s ease'}} />
                    <div style={{flex: 1, background: awayColor}} />
                  </div>
                  {s.result_winner && (
                    <div style={{marginTop: 10, fontSize: 11, color: '#6ee87a', textAlign: 'center'}}>
                      ✓ Result: <strong>{s.result_winner}</strong> in {s.result_games}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScoringRulesPage() {
  const rounds = [
    { round: 1, name: 'First Round',          winPts: 4, gameBonus: 1 },
    { round: 2, name: 'Second Round',         winPts: 5, gameBonus: 1 },
    { round: 3, name: 'Conference Finals',    winPts: 6, gameBonus: 2 },
    { round: 4, name: 'Stanley Cup / Finals', winPts: 8, gameBonus: 3 },
  ]
  return (
    <div className="page">
      <div className="page-title">Scoring Rules</div>
      <div className="page-sub">How points are calculated for each pick.</div>
      <div className="scoring-intro-card">
        <div className="scoring-intro-title">How It Works</div>
        <p style={{fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7}}>Every series outcome sits on an 8-position scale from Winner in 4 to Loser in 4. Your points adjustment is based on how far your pick sits from the actual result — the further away, the worse the penalty.</p>
      </div>
      <div className="section-label">Points by Round</div>
      <div className="round-grid">
        {rounds.map(r => (
          <div key={r.round} className="round-card">
            <div className="round-code">R{r.round}</div>
            <div className="round-name-label">{r.name}</div>
            <div className="round-pts">{r.winPts} <span>pts</span></div>
            <div className="round-bonus">+{r.gameBonus} exact games bonus</div>
          </div>
        ))}
        <div className="round-card" style={{borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.05)'}}>
          <div className="round-code" style={{color: '#f87171'}}>—</div>
          <div className="round-name-label">No Pick</div>
          <div className="round-pts" style={{color: '#f87171'}}>−4 <span>pts</span></div>
          <div className="round-bonus" style={{color: '#f87171'}}>Maximum penalty</div>
        </div>
      </div>
      <div className="section-label">The 8-Position Scale</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320, marginBottom: 32}}>
        {[
          { label: 'Winner in 4', pos: 1 }, { label: 'Winner in 5', pos: 2 },
          { label: 'Winner in 6', pos: 3 }, { label: 'Winner in 7', pos: 4 },
          { label: 'Loser in 7',  pos: 5 }, { label: 'Loser in 6',  pos: 6 },
          { label: 'Loser in 5',  pos: 7 }, { label: 'Loser in 4',  pos: 8 },
        ].map((item, i) => (
          <div key={i} style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div style={{width: 24, height: 24, borderRadius: '50%', background: i < 4 ? 'rgba(201,149,42,0.15)' : 'rgba(248,113,113,0.1)', border: `1px solid ${i < 4 ? 'rgba(201,149,42,0.4)' : 'rgba(248,113,113,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i < 4 ? '#c9952a' : '#f87171', flexShrink: 0}}>{item.pos}</div>
            <div style={{fontSize: 14, color: i < 4 ? '#e8eaf0' : 'rgba(255,255,255,0.4)'}}>{item.label}</div>
          </div>
        ))}
      </div>
      <div className="section-label">Examples — Round 1</div>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32}}>
        {[
          { scenario: 'Bruins win in 6 · Pick: Bruins in 6',    pts: '+5', color: '#6ee87a', note: 'Correct + exact → +4 +1' },
          { scenario: 'Bruins win in 6 · Pick: Bruins in 5',    pts: '+4', color: '#6ee87a', note: 'Correct + off by 1 → +4 +0' },
          { scenario: 'Bruins win in 6 · Pick: Bruins in 4',    pts: '+3', color: '#6ee87a', note: 'Correct + off by 2 → +4 −1' },
          { scenario: 'Bruins win in 6 · Pick: Lightning in 7', pts: '−2', color: '#f87171', note: 'Wrong + off by 2 → 0 −1' },
          { scenario: 'Bruins win in 6 · Pick: Lightning in 6', pts: '−2', color: '#f87171', note: 'Wrong + off by 3 → 0 −2' },
          { scenario: 'No pick submitted',                       pts: '−4', color: '#f87171', note: 'Maximum penalty applied' },
        ].map((ex, i) => (
          <div key={i} style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '14px 16px'}}>
            <div style={{fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8}}>{ex.scenario}</div>
            <div style={{fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: 1, color: ex.color, marginBottom: 4}}>{ex.pts} pts</div>
            <div style={{fontSize: 11, color: 'rgba(255,255,255,0.3)'}}>{ex.note}</div>
          </div>
        ))}
      </div>
      <div style={{background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px'}}>
        <div className="section-label" style={{marginBottom: 14}}>Payouts</div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10}}>
          {[
            { label: '🥇 Combined 1st', desc: 'Highest total NHL + NBA score' },
            { label: '🥈 Combined 2nd', desc: 'Second highest combined score' },
            { label: '🥉 Combined 3rd', desc: 'Third highest combined score' },
            { label: '🏒 NHL 1st',      desc: 'Highest NHL-only score' },
            { label: '🏒 NHL 2nd',      desc: 'Second highest NHL-only score' },
            { label: '🏀 NBA 1st',      desc: 'Highest NBA-only score' },
            { label: '🏀 NBA 2nd',      desc: 'Second highest NBA-only score' },
          ].map((p, i) => (
            <div key={i} style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '14px 16px', textAlign: 'center'}}>
              <div style={{fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 6}}>{p.label}</div>
              <div style={{fontSize: 12, color: 'rgba(255,255,255,0.3)'}}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
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
      <div className="page-sub">Updated after each series result. Top 3 combined and top 2 NHL/NBA win a payout.</div>
      <div className="standings-tabs">
        <button className={`std-tab ${view === 'combined' ? 'active' : ''}`} onClick={() => setView('combined')}>🏆 Combined</button>
        <button className={`std-tab ${view === 'nhl' ? 'active' : ''}`} onClick={() => setView('nhl')}>🏒 NHL</button>
        <button className={`std-tab ${view === 'nba' ? 'active' : ''}`} onClick={() => setView('nba')}>🏀 NBA</button>
      </div>
      <div style={{background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden'}}>
        <table className="standings-table">
          <thead>
            <tr>
              <th style={{width: 50}}>#</th>
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
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : (rank === 3 && view === 'combined') ? '🥉' : rank
              return (
                <tr key={p.id} className={isPayout ? 'payout-row' : ''}>
                  <td><span className={`rank-num ${rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':''}`}>{medal}</span></td>
                  <td>
                    {p.full_name}
                    {isPayout && <span className={`payout-badge ${rank===1?'payout-gold':rank===2?'payout-silver':'payout-bronze'}`}>PAYOUT</span>}
                  </td>
                  <td style={{textAlign:'right', color: p.nhlTotal >= 0 ? '#6ee87a' : '#f87171', fontWeight: 600}}>{p.nhlTotal >= 0 ? '+' : ''}{p.nhlTotal}</td>
                  <td style={{textAlign:'right', color: p.nbaTotal >= 0 ? '#6ee87a' : '#f87171', fontWeight: 600}}>{p.nbaTotal >= 0 ? '+' : ''}{p.nbaTotal}</td>
                  <td style={{textAlign:'right'}}><span className={`score-val ${p.combined >= 0 ? 'score-pos' : 'score-neg'}`}>{p.combined >= 0 ? '+' : ''}{p.combined}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminPage({ series, toggleLock, enterResult, participants, allPicks, showToast }) {
  const allSeries = [...series.NHL, ...series.NBA]
  const [resultInputs, setResultInputs] = useState({})
  const [adminTab, setAdminTab] = useState('series')

  // Build pick status data
  const allRounds = [...new Set(allSeries.map(s => s.round))].sort()
  const leagues = ['NHL', 'NBA']

  function getSeriesShortName(s) {
    const home = s.home_team.split(' ').pop()
    const away = s.away_team.split(' ').pop()
    return `${home} vs ${away}`
  }

  function generateMissingSummary() {
    const lines = ['🏒🏀 2026 PLAYOFF POOL — MISSING PICKS\n']
    let anyMissing = false
    leagues.forEach(lg => {
      allRounds.forEach(r => {
        const roundSeries = (series[lg] || []).filter(s => s.round === r && s.locked)
        if (roundSeries.length === 0) return
        const missingByPerson = {}
        participants.forEach(u => {
          const missing = roundSeries.filter(s => !allPicks.find(p => p.user_id === u.id && p.series_id === s.id))
          if (missing.length > 0) {
            missingByPerson[u.full_name] = missing.map(s => getSeriesShortName(s))
          }
        })
        if (Object.keys(missingByPerson).length > 0) {
          anyMissing = true
          lines.push(`${lg} Round ${r}:`)
          Object.entries(missingByPerson).forEach(([name, series]) => {
            lines.push(`  ${name} — ${series.join(', ')}`)
          })
          lines.push('')
        }
      })
    })
    if (!anyMissing) lines.push('Everyone has submitted all their picks! 🎉\n')
    lines.push('Submit picks at: chrisnbanhlplayoffpool.vercel.app')
    return lines.join('\n')
  }

  function copyMissingSummary() {
    const text = generateMissingSummary()
    navigator.clipboard.writeText(text).then(() => {
      showToast('Summary copied to clipboard! ✓')
    }).catch(() => {
      showToast('Could not copy — try again', 'error')
    })
  }

  return (
    <div className="page">
      <div className="page-title">Commissioner</div>
      <div className="page-sub">Manage series, enter results, and track participant picks.</div>

      <div className="standings-tabs" style={{marginBottom: 24}}>
        <button className={`std-tab ${adminTab === 'series' ? 'active' : ''}`} onClick={() => setAdminTab('series')}>Series Management</button>
        <button className={`std-tab ${adminTab === 'picks' ? 'active' : ''}`} onClick={() => setAdminTab('picks')}>Pick Status</button>
      </div>

      {adminTab === 'series' && (
        <div className="admin-grid">
          <div className="admin-card" style={{gridColumn: '1 / -1'}}>
            <h3>Series Management</h3>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px'}}>
              {['NHL','NBA'].map(lg => (
                <div key={lg}>
                  <div style={{fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.3)', marginBottom: 10, textTransform:'uppercase'}}>{lg}</div>
                  {series[lg].map(s => (
                    <div key={s.id} style={{padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: s.result_winner ? 0 : 8}}>
                        <span style={{fontSize: 12}}>{s.home_team} vs {s.away_team}</span>
                        <button className={`lock-toggle ${s.locked ? 'locked-btn' : 'unlocked'}`} onClick={() => toggleLock(lg, s.id)}>
                          {s.locked ? 'Unlock' : 'Lock'}
                        </button>
                      </div>
                      {!s.result_winner && s.locked && (
                        <div style={{display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap'}}>
                          <select
                            style={{flex: 1, padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontFamily: "'Barlow', sans-serif"}}
                            onChange={e => setResultInputs(prev => ({ ...prev, [s.id]: { ...prev[s.id], winner: e.target.value } }))}
                          >
                            <option value="">Winner...</option>
                            <option>{s.home_team}</option>
                            <option>{s.away_team}</option>
                          </select>
                          <select
                            style={{width: 70, padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontFamily: "'Barlow', sans-serif"}}
                            onChange={e => setResultInputs(prev => ({ ...prev, [s.id]: { ...prev[s.id], games: parseInt(e.target.value) } }))}
                          >
                            <option value="">Gms</option>
                            {[4,5,6,7].map(g => <option key={g}>{g}</option>)}
                          </select>
                          <button
                            onClick={() => { const r = resultInputs[s.id]; if (r?.winner && r?.games) enterResult(s.id, r.winner, r.games) }}
                            style={{padding: '5px 12px', borderRadius: 6, background: 'rgba(110,232,122,0.15)', border: '1px solid rgba(110,232,122,0.3)', color: '#6ee87a', fontSize: 12, cursor: 'pointer', fontFamily: "'Barlow', sans-serif"}}
                          >Save</button>
                        </div>
                      )}
                      {s.result_winner && (
                        <div style={{fontSize: 11, color: '#6ee87a', marginTop: 4}}>✓ {s.result_winner} in {s.result_games}</div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="admin-card">
            <h3>Pool Stats</h3>
            <div className="stat-row"><span>Total Participants</span><span className="stat-val">{participants.length}</span></div>
            <div className="stat-row"><span>Series Locked</span><span className="stat-val">{allSeries.filter(s => s.locked).length} / {allSeries.length}</span></div>
            <div className="stat-row"><span>Series Completed</span><span className="stat-val">{allSeries.filter(s => s.result_winner).length} / {allSeries.length}</span></div>
          </div>
        </div>
      )}

      {adminTab === 'picks' && (
        <div>
          {leagues.map(lg => (
            <div key={lg} style={{marginBottom: 32}}>
              {allRounds.map(r => {
                const roundSeries = (series[lg] || []).filter(s => s.round === r)
                if (roundSeries.length === 0) return null
                return (
                  <div key={r} style={{marginBottom: 24}}>
                    <div className="section-label" style={{marginBottom: 12}}>
                      {lg === 'NHL' ? '🏒' : '🏀'} {lg} · Round {r}
                    </div>
                    <div style={{background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden'}}>
                      <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                          <tr>
                            <th style={{textAlign:'left', padding:'10px 16px', fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'rgba(255,255,255,0.25)', borderBottom:'1px solid rgba(255,255,255,0.06)', fontFamily:"'Barlow Condensed', sans-serif"}}>Participant</th>
                            {roundSeries.map(s => (
                              <th key={s.id} style={{textAlign:'center', padding:'10px 8px', fontSize:11, fontWeight:700, letterSpacing:0.5, textTransform:'uppercase', color:'rgba(255,255,255,0.25)', borderBottom:'1px solid rgba(255,255,255,0.06)', fontFamily:"'Barlow Condensed', sans-serif"}}>
                                {s.home_team.split(' ').pop()} vs {s.away_team.split(' ').pop()}
                              </th>
                            ))}
                            <th style={{textAlign:'right', padding:'10px 16px', fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'rgba(255,255,255,0.25)', borderBottom:'1px solid rgba(255,255,255,0.06)', fontFamily:"'Barlow Condensed', sans-serif"}}>Progress</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participants.map(u => {
                            const picked = roundSeries.filter(s => allPicks.find(p => p.user_id === u.id && p.series_id === s.id)).length
                            const total = roundSeries.length
                            const pct = total > 0 ? (picked / total) * 100 : 0
                            return (
                              <tr key={u.id} style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
                                <td style={{padding: '11px 16px', fontSize: 13, fontWeight: 500}}>{u.full_name}</td>
                                {roundSeries.map(s => {
                                  const hasPick = allPicks.find(p => p.user_id === u.id && p.series_id === s.id)
                                  return (
                                    <td key={s.id} style={{textAlign: 'center', padding: '11px 8px'}}>
                                      <span style={{
                                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                                        fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                                        background: hasPick ? 'rgba(110,232,122,0.12)' : 'rgba(248,113,113,0.1)',
                                        color: hasPick ? '#6ee87a' : '#f87171',
                                        fontFamily: "'Barlow Condensed', sans-serif",
                                      }}>
                                        {hasPick ? '✓' : '—'}
                                      </span>
                                    </td>
                                  )
                                })}
                                <td style={{padding: '11px 16px'}}>
                                  <div style={{display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end'}}>
                                    <div style={{width: 56, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden'}}>
                                      <div style={{
                                        height: '100%', borderRadius: 3,
                                        width: `${pct}%`,
                                        background: pct === 100 ? '#6ee87a' : pct > 0 ? '#c9952a' : '#f87171',
                                        transition: 'width 0.3s ease'
                                      }} />
                                    </div>
                                    <span style={{
                                      fontSize: 12, fontWeight: 700, minWidth: 28, textAlign: 'right',
                                      color: pct === 100 ? '#6ee87a' : pct > 0 ? '#c9952a' : '#f87171',
                                      fontFamily: "'Barlow Condensed', sans-serif",
                                    }}>{picked}/{total}</span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          <div className="admin-card">
            <h3>Missing Picks Summary</h3>
            <div style={{fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6}}>
              Generate a summary of all missing picks across all rounds and leagues. Copy and paste into your group chat.
            </div>
            <button className="blast-btn" onClick={copyMissingSummary}>
              📋 Copy Missing Picks Summary
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Barlow', sans-serif; }
  .app { min-height: 100vh; background: #12151f; color: #e8eaf0; }
  .app::before { content: ''; position: fixed; inset: 0; background: radial-gradient(ellipse at 20% 50%, rgba(201,149,42,0.04) 0%, transparent 60%); pointer-events: none; z-index: 0; }
  .content { position: relative; z-index: 1; }
  .nav { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; background: #0d1017; border-bottom: 1px solid rgba(255,255,255,0.07); position: sticky; top: 0; z-index: 100; }
  .nav-logo { line-height: 1.1; }
  .nav-year { display: block; font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; color: #c9952a; letter-spacing: 2px; text-transform: uppercase; }
  .nav-title { display: block; font-family: 'Barlow Condensed', sans-serif; font-size: 24px; font-weight: 800; color: #fff; letter-spacing: 2px; text-transform: uppercase; }
  .nav-tabs { display: flex; gap: 2px; }
  .nav-tab { padding: 8px 16px; border-radius: 6px; font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; background: transparent; border: none; color: rgba(255,255,255,0.35); cursor: pointer; transition: all 0.2s; }
  .nav-tab:hover { color: #fff; background: rgba(255,255,255,0.05); }
  .nav-tab.active { color: #c9952a; background: rgba(201,149,42,0.1); }
  .nav-user { font-size: 13px; color: rgba(255,255,255,0.5); display: flex; align-items: center; gap: 8px; font-family: 'Barlow', sans-serif; }
  .nav-user strong { color: #fff; }
  .logout-btn { padding: 5px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: transparent; color: rgba(255,255,255,0.5); font-size: 12px; cursor: pointer; transition: all 0.2s; font-family: 'Barlow', sans-serif; }
  .logout-btn:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
  .mobile-menu { display: none; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 18px; padding: 4px 10px; cursor: pointer; }
  .mobile-dropdown { display: none; position: absolute; top: 61px; left: 0; right: 0; background: rgba(13,16,23,0.98); border-bottom: 1px solid rgba(255,255,255,0.07); flex-direction: column; z-index: 99; padding: 8px 16px 16px; }
  .mobile-dropdown button { padding: 12px 16px; background: transparent; border: none; color: rgba(255,255,255,0.6); font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; text-align: left; border-radius: 6px; width: 100%; }
  .mobile-dropdown button:hover { background: rgba(255,255,255,0.05); color: #fff; }
  .mobile-dropdown button.active { color: #c9952a; background: rgba(201,149,42,0.1); }
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #12151f; background-image: radial-gradient(ellipse at 30% 40%, rgba(201,149,42,0.08) 0%, transparent 60%); }
  .login-card { width: 380px; padding: 48px 40px; background: #1a1f2e; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; }
  .login-logo { margin-bottom: 4px; }
  .login-year { display: block; font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; color: #c9952a; letter-spacing: 2px; text-transform: uppercase; }
  .login-title { display: block; font-family: 'Barlow Condensed', sans-serif; font-size: 36px; font-weight: 800; color: #fff; letter-spacing: 2px; text-transform: uppercase; }
  .login-sub { color: rgba(255,255,255,0.35); font-size: 13px; margin-bottom: 32px; font-family: 'Barlow', sans-serif; }
  .field-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: rgba(255,255,255,0.4); text-transform: uppercase; margin-bottom: 6px; }
  .field-input { width: 100%; padding: 11px 14px; border-radius: 7px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; margin-bottom: 16px; }
  .field-input:focus { border-color: rgba(201,149,42,0.5); }
  .pin-row { display: flex; gap: 10px; margin-bottom: 16px; }
  .pin-input { width: 52px; height: 52px; text-align: center; font-size: 20px; font-weight: 600; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; outline: none; transition: border-color 0.2s; font-family: 'Barlow', sans-serif; }
  .pin-input:focus { border-color: rgba(201,149,42,0.5); }
  .btn-primary { width: 100%; padding: 13px; border-radius: 8px; background: #c9952a; border: none; color: #000; font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; margin-top: 8px; }
  .btn-primary:hover { background: #e8b84b; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .register-link { text-align: center; margin-top: 20px; font-size: 13px; color: rgba(255,255,255,0.4); font-family: 'Barlow', sans-serif; }
  .register-link button { background: none; border: none; color: #c9952a; cursor: pointer; font-size: 13px; font-family: 'Barlow', sans-serif; }
  .error-msg { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); color: #f87171; border-radius: 7px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; font-family: 'Barlow', sans-serif; }
  .page { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
  .page-title { font-family: 'Barlow Condensed', sans-serif; font-size: 38px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  .page-sub { color: rgba(255,255,255,0.4); font-size: 14px; margin-bottom: 28px; font-family: 'Barlow', sans-serif; }
  .section-label { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 16px; }
  .league-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
  .league-tab { padding: 9px 22px; border-radius: 6px; font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
  .league-tab.active-nhl { background: rgba(201,149,42,0.12); border-color: rgba(201,149,42,0.4); color: #c9952a; }
  .league-tab.active-nba { background: rgba(201,149,42,0.12); border-color: rgba(201,149,42,0.4); color: #c9952a; }
  .series-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .series-card { background: #1a1f2e; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 18px; transition: border-color 0.2s; position: relative; overflow: hidden; }
  .series-card:hover { border-color: rgba(255,255,255,0.14); }
  .series-card.locked { opacity: 0.75; }
  .series-card.locked::after { content: 'LOCKED'; position: absolute; top: 12px; right: 12px; font-size: 9px; font-weight: 700; letter-spacing: 1px; background: rgba(248,113,113,0.15); color: #f87171; padding: 3px 7px; border-radius: 4px; font-family: 'Barlow Condensed', sans-serif; }
  .series-card.submitted::after { content: '✓ SUBMITTED'; position: absolute; top: 12px; right: 12px; font-size: 9px; font-weight: 700; letter-spacing: 1px; background: rgba(201,149,42,0.15); color: #c9952a; padding: 3px 7px; border-radius: 4px; font-family: 'Barlow Condensed', sans-serif; }
  .matchup { display: flex; gap: 10px; margin-bottom: 14px; }
  .team-opt { flex: 1; padding: 12px 10px; border-radius: 8px; border: 1.5px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.6); cursor: pointer; transition: all 0.2s; font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 500; text-align: center; line-height: 1.3; }
  .team-opt:hover:not(:disabled) { border-color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.04); }
  .team-opt:disabled { cursor: default; }
  .games-row { margin-top: 12px; }
  .games-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: rgba(255,255,255,0.25); text-transform: uppercase; margin-bottom: 8px; }
  .games-opts { display: flex; gap: 6px; }
  .game-num { flex: 1; padding: 7px 4px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); cursor: pointer; font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 700; transition: all 0.2s; text-align: center; }
  .game-num:hover:not(:disabled) { border-color: rgba(201,149,42,0.4); color: #c9952a; }
  .game-num.selected { border-color: #c9952a; background: rgba(201,149,42,0.15); color: #c9952a; }
  .game-num:disabled { cursor: default; }
  .submit-pick-btn { width: 100%; margin-top: 12px; padding: 10px; border-radius: 7px; background: rgba(201,149,42,0.15); border: 1px solid rgba(201,149,42,0.4); color: #c9952a; font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
  .submit-pick-btn:hover:not(:disabled) { background: rgba(201,149,42,0.25); }
  .submit-pick-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .result-badge { margin-top: 12px; padding: 8px 12px; border-radius: 7px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); font-size: 12px; color: rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: space-between; font-family: 'Barlow', sans-serif; }
  .result-badge strong { color: #fff; }
  .pts-badge { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; }
  .pts-pos { color: #6ee87a; }
  .pts-neg { color: #f87171; }
  .standings-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
  .std-tab { padding: 9px 20px; border-radius: 6px; font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
  .std-tab.active { background: rgba(201,149,42,0.12); border-color: rgba(201,149,42,0.4); color: #c9952a; }
  .standings-table { width: 100%; border-collapse: collapse; }
  .standings-table th { text-align: left; padding: 10px 16px; font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.25); border-bottom: 1px solid rgba(255,255,255,0.06); }
  .standings-table td { padding: 13px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 14px; font-family: 'Barlow', sans-serif; }
  .standings-table tr:last-child td { border-bottom: none; }
  .standings-table tr:hover td { background: rgba(255,255,255,0.02); }
  .rank-num { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; color: rgba(255,255,255,0.2); }
  .rank-1 { color: #c9952a; } .rank-2 { color: #94a3b8; } .rank-3 { color: #b87333; }
  .payout-row td { background: rgba(201,149,42,0.04); }
  .payout-badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; margin-left: 8px; }
  .payout-gold   { background: rgba(201,149,42,0.2);  color: #c9952a; }
  .payout-silver { background: rgba(148,163,184,0.2); color: #94a3b8; }
  .payout-bronze { background: rgba(184,115,51,0.2);  color: #b87333; }
  .score-val { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 17px; }
  .score-pos { color: #6ee87a; }
  .score-neg { color: #f87171; }
  .scoring-intro-card { background: #1a1f2e; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 24px; margin-bottom: 28px; }
  .scoring-intro-title { font-family: 'Barlow Condensed', sans-serif; font-size: 24px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #c9952a; margin-bottom: 10px; }
  .round-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .round-card { background: #1a1f2e; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 20px; }
  .round-code { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 800; color: #c9952a; letter-spacing: 1px; margin-bottom: 2px; }
  .round-name-label { font-size: 12px; color: rgba(255,255,255,0.3); margin-bottom: 12px; font-family: 'Barlow', sans-serif; }
  .round-pts { font-family: 'Barlow Condensed', sans-serif; font-size: 40px; font-weight: 800; color: #fff; line-height: 1; }
  .round-pts span { font-size: 16px; font-weight: 400; color: rgba(255,255,255,0.3); }
  .round-bonus { font-family: 'Barlow', sans-serif; font-size: 12px; color: #c9952a; margin-top: 6px; font-weight: 600; }
  .admin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .admin-card { background: #1a1f2e; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 24px; }
  .admin-card h3 { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 16px; color: rgba(255,255,255,0.7); }
  .lock-toggle { padding: 5px 12px; border-radius: 5px; font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; border: none; cursor: pointer; transition: all 0.2s; }
  .lock-toggle.unlocked { background: rgba(248,113,113,0.15); color: #f87171; }
  .lock-toggle.unlocked:hover { background: rgba(248,113,113,0.25); }
  .lock-toggle.locked-btn { background: rgba(110,232,122,0.15); color: #6ee87a; }
  .lock-toggle.locked-btn:hover { background: rgba(110,232,122,0.25); }
  .stat-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05); font-family: 'Barlow', sans-serif; color: rgba(255,255,255,0.5); }
  .stat-row:last-child { border-bottom: none; }
  .stat-val { font-weight: 700; color: #fff; }
  .blast-btn { width: 100%; padding: 12px; border-radius: 8px; background: rgba(201,149,42,0.15); border: 1px solid rgba(201,149,42,0.4); color: #c9952a; font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
  .blast-btn:hover { background: rgba(201,149,42,0.25); }
  .toast { position: fixed; bottom: 24px; right: 24px; z-index: 9999; background: rgba(110,232,122,0.9); color: #000; padding: 12px 20px; border-radius: 8px; font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
  .toast-error { background: rgba(248,113,113,0.9); color: #fff; }
  @media (max-width: 600px) {
    .admin-grid { grid-template-columns: 1fr; }
    .round-grid { grid-template-columns: 1fr 1fr; }
    .nav-tabs { display: none; }
    .mobile-menu { display: block !important; }
    .mobile-dropdown { display: flex; }
    .nav-user strong { display: none; }
    .page { padding: 20px 16px; }
    .series-grid { grid-template-columns: 1fr; }
    .league-tabs { flex-wrap: wrap; }
  }
`

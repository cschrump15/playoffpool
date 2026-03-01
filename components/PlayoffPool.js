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
  const [allPicks, setAllPicks] = useState([])
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
              <span style={{color:"#f59e0b"}}>2026 </span>
              <span style={{color:"#e8eaf0"}}>PLAYOFF </span>
              <span style={{color:"#3b82f6"}}>POOL</span>
            </div>
            <div className="nav-tabs">
              <button className={`nav-tab ${page === 'picks' ? 'active' : ''}`} onClick={() => setPage('picks')}>My Picks</button>
              <button className={`nav-tab ${page === 'standings' ? 'active' : ''}`} onClick={() => setPage('standings')}>Standings</button>
              <button className={`nav-tab ${page === 'distributions' ? 'active' : ''}`} onClick={() => setPage('distributions')}>Pick Distributions</button>
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
            {page === 'distributions' && <DistributionsPage series={series} allPicks={allPicks} participants={participants} />}
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
      {currentSeries.length === 0 && (
        <div style={{color: 'rgba(255,255,255,0.4)', marginTop: 40, textAlign: 'center'}}>No series added yet.</div>
      )}
      <div className="series-grid">
        {currentSeries.map(s => {
          const seriesPicks = allPicks.filter(p => p.series_id === s.id)
          const homePicks = seriesPicks.filter(p => p.picked_winner === s.home_team).length
          const awayPicks = seriesPicks.filter(p => p.picked_winner === s.away_team).length
          const totalPicks = seriesPicks.length
          const homePct = totalPicks > 0 ? Math.round((homePicks / totalPicks) * 100) : 50
          const awayPct = totalPicks > 0 ? Math.round((awayPicks / totalPicks) * 100) : 50

          return (
            <div key={s.id} className="series-card">
              <div style={{fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12, letterSpacing: 1}}>
                ROUND {s.round} · {totalPicks}/{total} picks submitted
              </div>
              {!s.locked ? (
                <div style={{textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13, padding: '20px 0'}}>
                  🔒 Distributions visible after series locks
                </div>
              ) : (
                <>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
                    <div style={{textAlign: 'center', flex: 1}}>
                      <div style={{fontSize: 24, marginBottom: 4}}>{TEAM_EMOJI[s.home_team] || '🏒'}</div>
                      <div style={{fontSize: 12, color: '#e8eaf0', marginBottom: 2}}>{s.home_team}</div>
                      <div style={{fontSize: 22, fontWeight: 700, color: '#60a5fa'}}>{homePct}%</div>
                      <div style={{fontSize: 11, color: 'rgba(255,255,255,0.3)'}}>{homePicks} picks</div>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', padding: '0 12px', color: 'rgba(255,255,255,0.2)', fontFamily: "'Bebas Neue',sans-serif", fontSize: 16}}>VS</div>
                    <div style={{textAlign: 'center', flex: 1}}>
                      <div style={{fontSize: 24, marginBottom: 4}}>{TEAM_EMOJI[s.away_team] || '🏒'}</div>
                      <div style={{fontSize: 12, color: '#e8eaf0', marginBottom: 2}}>{s.away_team}</div>
                      <div style={{fontSize: 22, fontWeight: 700, color: '#60a5fa'}}>{awayPct}%</div>
                      <div style={{fontSize: 11, color: 'rgba(255,255,255,0.3)'}}>{awayPicks} picks</div>
                    </div>
                  </div>
                  <div style={{height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 8}}>
                    <div style={{height: '100%', width: `${homePct}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: 3, transition: 'width 0.5s ease'}} />
                  </div>
                  {s.result_winner && (
                    <div style={{marginTop: 10, fontSize: 11, color: '#86efac', textAlign: 'center'}}>
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
                <div style={{fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.3)', marginBottom: 10, textTransform:'uppercase'}}>{lg}</div>
                {series[lg].map(s => (
                  <div key={s.id} style={{padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: s.result_winner ? 0 : 8}}>
                      <span style={{fontSize: 12}}>{s.home_team} vs {s.away_team}</span>
                      <button className={`lock-toggle ${s.locked ? 'locked-btn' : 'unlocked'}`} onClick={() => toggleLock(lg, s.id)}>
                        {s.locked ? 'UNLOCK' : 'LOCK'}
                      </button>
                    </div>
                    {!s.result_winner && s.locked && (
                      <div style={{display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap'}}>
                        <select
                          style={{flex: 1, padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12}}
                          onChange={e => setResultInputs(prev => ({ ...prev, [s.id]: { ...prev[s.id], winner: e.target.value } }))}
                        >
                          <option value="">Winner...</option>
                          <option>{s.home_team}</option>
                          <option>{s.away_team}</option>
                        </select>
                        <select
                          style={{width: 70, padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12}}
                          onChange={e => setResultInputs(prev => ({ ...prev, [s.id]: { ...prev[s.id], games: parseInt(e.target.value) } }))}
                        >
                          <option value="">Gms</option>
                          {[4,5,6,7].map(g => <option key={g}>{g}</option>)}
                        </select>
                        <button
                          onClick={() => { const r = resultInputs[s.id]; if (r?.winner && r?.games) enterResult(s.id, r.winner, r.games) }}
                          style={{padding: '5px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac', fontSize: 12, cursor: 'pointer'}}
                        >Save</button>
                      </div>
                    )}
                    {s.result_winner && (
                      <div style={{fontSize: 11, color: '#86efac', marginTop: 4}}>✓ {s.result_winner} in {s.result_games}</div>
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
        <div className="admin-card">
          <h3>Text Notifications</h3>
          <div style={{fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6}}>SMS blasts via Twilio — coming in a future update.</div>
          <button className="blast-btn" onClick={() => showToast('📱 Coming soon!')}>📱 Send Picks Reminder</button>
          <button className="blast-btn" style={{marginTop: 8}} onClick={() => showToast('🏆 Coming soon!')}>🏆 Send Standings Update</button>
        </div>
      </div>
    </div>
  )
}

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; }
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
  .app { min-height: 100vh; background: #0a0e1a; color: #e8eaf0; }
  .app::before { content: ''; position: fixed; inset: 0; background: radial-gradient(ellipse at 20% 50%, rgba(0,80,160,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(0,160,80,0.08) 0%, transparent 50%); pointer-events: none; z-index: 0; }
  .content { position: relative; z-index: 1; }
  .nav { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: rgba(10,14,26,0.9); border-bottom: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 100; }
  .nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; }
  .nav-tabs { display: flex; gap: 4px; }
  .nav-tab { padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; background: transparent; border: none; color: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.2s; }
  .nav-tab:hover { color: #fff; background: rgba(255,255,255,0.06); }
  .nav-tab.active { background: rgba(59,130,246,0.2); color: #60a5fa; }
  .nav-user { font-size: 13px; color: rgba(255,255,255,0.5); display: flex; align-items: center; gap: 8px; }
  .nav-user strong { color: #fff; }
  .logout-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: transparent; color: rgba(255,255,255,0.5); font-size: 12px; cursor: pointer; transition: all 0.2s; }
  .logout-btn:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a0e1a; background-image: radial-gradient(ellipse at 30% 40%, rgba(0,80,160,0.2) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(0,120,60,0.1) 0%, transparent 50%); }
  .login-card { width: 380px; padding: 48px 40px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; backdrop-filter: blur(20px); }
  .login-title { font-family: 'Bebas Neue', sans-serif; font-size: 42px; letter-spacing: 3px; text-align: center; margin-bottom: 4px; }
  .login-sub { text-align: center; color: rgba(255,255,255,0.4); font-size: 13px; margin-bottom: 36px; }
  .field-label { font-size: 11px; font-weight: 600; letter-spacing: 1px; color: rgba(255,255,255,0.4); text-transform: uppercase; margin-bottom: 6px; }
  .field-input { width: 100%; padding: 12px 16px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-family: 'DM Sans', sans-serif; font-size: 15px; outline: none; transition: border-color 0.2s; margin-bottom: 16px; }
  .field-input:focus { border-color: rgba(59,130,246,0.5); }
  .pin-row { display: flex; gap: 10px; margin-bottom: 16px; }
  .pin-input { flex: 1; aspect-ratio: 1; text-align: center; font-size: 22px; font-weight: 600; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; outline: none; transition: border-color 0.2s; }
  .pin-input:focus { border-color: rgba(59,130,246,0.5); }
  .btn-primary { width: 100%; padding: 14px; border-radius: 10px; background: #3b82f6; border: none; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 8px; }
  .btn-primary:hover { background: #2563eb; transform: translateY(-1px); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .register-link { text-align: center; margin-top: 20px; font-size: 13px; color: rgba(255,255,255,0.4); }
  .register-link button { background: none; border: none; color: #60a5fa; cursor: pointer; font-size: 13px; }
  .error-msg { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
  .page { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
  .page-title { font-family: 'Bebas Neue', sans-serif; font-size: 36px; letter-spacing: 2px; margin-bottom: 8px; }
  .page-sub { color: rgba(255,255,255,0.4); font-size: 14px; margin-bottom: 32px; }
  .league-tabs { display: flex; gap: 8px; margin-bottom: 28px; }
  .league-tab { padding: 10px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
  .league-tab.active-nhl { background: rgba(0,100,200,0.2); border-color: rgba(0,100,200,0.4); color: #60a5fa; }
  .league-tab.active-nba { background: rgba(200,50,0,0.2); border-color: rgba(200,50,0,0.4); color: #f87171; }
  .series-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  .series-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; transition: border-color 0.2s; position: relative; overflow: hidden; }
  .series-card:hover { border-color: rgba(255,255,255,0.15); }
  .series-card.locked { opacity: 0.75; }
  .series-card.locked::after { content: '🔒 LOCKED'; position: absolute; top: 12px; right: 12px; font-size: 10px; font-weight: 700; letter-spacing: 1px; background: rgba(239,68,68,0.2); color: #fca5a5; padding: 3px 8px; border-radius: 4px; }
  .series-card.submitted::after { content: '✓ SUBMITTED'; position: absolute; top: 12px; right: 12px; font-size: 10px; font-weight: 700; letter-spacing: 1px; background: rgba(34,197,94,0.2); color: #86efac; padding: 3px 8px; border-radius: 4px; }
  .matchup { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .team-opt { flex: 1; padding: 10px 12px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.1); background: transparent; color: #fff; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; text-align: center; line-height: 1.3; }
  .team-opt:hover:not(:disabled) { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.05); }
  .team-opt.selected { border-color: #3b82f6; background: rgba(59,130,246,0.15); color: #93c5fd; }
  .team-opt:disabled { cursor: default; }
  .games-row { margin-top: 12px; }
  .games-label { font-size: 11px; font-weight: 600; letter-spacing: 1px; color: rgba(255,255,255,0.35); text-transform: uppercase; margin-bottom: 8px; }
  .games-opts { display: flex; gap: 6px; }
  .game-num { flex: 1; padding: 7px 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; text-align: center; }
  .game-num:hover:not(:disabled) { border-color: rgba(255,255,255,0.3); color: #fff; }
  .game-num.selected { border-color: #3b82f6; background: rgba(59,130,246,0.15); color: #93c5fd; }
  .game-num:disabled { cursor: default; }
  .submit-pick-btn { width: 100%; margin-top: 14px; padding: 10px; border-radius: 10px; background: rgba(59,130,246,0.2); border: 1px solid rgba(59,130,246,0.4); color: #93c5fd; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .submit-pick-btn:hover:not(:disabled) { background: rgba(59,130,246,0.35); }
  .submit-pick-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .result-badge { margin-top: 12px; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: space-between; }
  .result-badge strong { color: #fff; }
  .pts-badge { font-weight: 700; font-size: 14px; }
  .pts-pos { color: #86efac; }
  .pts-neg { color: #fca5a5; }
  .standings-tabs { display: flex; gap: 8px; margin-bottom: 28px; }
  .std-tab { padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
  .std-tab.active { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); color: #fff; }
  .standings-table { width: 100%; border-collapse: collapse; }
  .standings-table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.3); border-bottom: 1px solid rgba(255,255,255,0.06); }
  .standings-table td { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 14px; }
  .standings-table tr:hover td { background: rgba(255,255,255,0.02); }
  .rank-num { font-family: 'Bebas Neue', sans-serif; font-size: 22px; color: rgba(255,255,255,0.2); }
  .rank-1 { color: #fbbf24; } .rank-2 { color: #94a3b8; } .rank-3 { color: #b87333; }
  .payout-row td { background: rgba(255,255,255,0.02); }
  .payout-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; margin-left: 8px; }
  .payout-gold { background: rgba(251,191,36,0.2); color: #fbbf24; }
  .payout-silver { background: rgba(148,163,184,0.2); color: #94a3b8; }
  .score-val { font-weight: 700; font-size: 16px; }
  .score-pos { color: #86efac; }
  .admin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .admin-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; }
  .admin-card h3 { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; margin-bottom: 16px; color: rgba(255,255,255,0.7); }
  .lock-toggle { padding: 5px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; border: none; cursor: pointer; transition: all 0.2s; }
  .lock-toggle.unlocked { background: rgba(239,68,68,0.2); color: #fca5a5; }
  .lock-toggle.unlocked:hover { background: rgba(239,68,68,0.35); }
  .lock-toggle.locked-btn { background: rgba(34,197,94,0.2); color: #86efac; }
  .lock-toggle.locked-btn:hover { background: rgba(34,197,94,0.35); }
  .stat-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .stat-row:last-child { border-bottom: none; }
  .stat-val { font-weight: 700; color: #fff; }
  .blast-btn { width: 100%; margin-top: 8px; padding: 12px; border-radius: 10px; background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.4); color: #c4b5fd; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .blast-btn:hover { background: rgba(139,92,246,0.35); }
  .toast { position: fixed; bottom: 24px; right: 24px; z-index: 9999; background: rgba(34,197,94,0.9); color: #fff; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; }
  @media (max-width: 600px) { .admin-grid { grid-template-columns: 1fr; } .nav-tabs { display: none; } }
`

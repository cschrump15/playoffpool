'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const WINNER_PTS = [0, 4, 5, 6, 8]
const GAMES_BONUS = [0, 1, 1, 2, 3]
const TOTAL_POSSIBLE_PTS = 208
const BUY_IN = 40
const PAYOUT_PCTS = [
  { label: '🥇 Combined 1st', pct: 0.27 },
  { label: '🥈 Combined 2nd', pct: 0.19 },
  { label: '🥉 Combined 3rd', pct: 0.12 },
  { label: '🏒 NHL 1st',      pct: 0.13 },
  { label: '🏒 NHL 2nd',      pct: 0.08 },
  { label: '🏀 NBA 1st',      pct: 0.13 },
  { label: '🏀 NBA 2nd',      pct: 0.08 },
]

const GAME_LENGTH_DIST = {
  NHL: { 4: 0.17, 5: 0.24, 6: 0.30, 7: 0.29 },
  NBA: { 4: 0.15, 5: 0.22, 6: 0.31, 7: 0.32 },
}

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

function calcSeriesEV(pick, series, oddsData) {
  if (!pick) return -4
  const league = series.league
  const dist = GAME_LENGTH_DIST[league]
  const odds = oddsData[series.id]
  if (!odds) return 0

  const { homeWinProb, seriesScore } = odds
  const awayWinProb = 1 - homeWinProb

  const homeWins = seriesScore?.homeWins || 0
  const awayWins = seriesScore?.awayWins || 0
  const winsNeeded = 4

  let ev = 0
  let totalProb = 0

  ;[4, 5, 6, 7].forEach(totalGames => {
    const homeGamesNeeded = winsNeeded - homeWins
    const awayGamesNeeded = winsNeeded - awayWins
    const gamesLeft = totalGames - homeWins - awayWins

    if (homeGamesNeeded > 0 && homeGamesNeeded <= gamesLeft) {
      const prob = homeWinProb * dist[totalGames]
      totalProb += prob
      const pts = calcPoints(series.round, pick.picked_winner, series.home_team, totalGames, pick.picked_games)
      ev += prob * pts
    }
    if (awayGamesNeeded > 0 && awayGamesNeeded <= gamesLeft) {
      const prob = awayWinProb * dist[totalGames]
      totalProb += prob
      const pts = calcPoints(series.round, pick.picked_winner, series.away_team, totalGames, pick.picked_games)
      ev += prob * pts
    }
  })

  return totalProb > 0 ? ev / totalProb : 0
}

function calcRemainingPts(allSeries) {
  return allSeries
    .filter(s => !s.result_winner)
    .reduce((sum, s) => sum + WINNER_PTS[s.round] + GAMES_BONUS[s.round], 0)
}

function softmaxChance(participants, key, remainingPts) {
  const minTemp = 2
  const maxTemp = 20
  const temp = minTemp + (maxTemp - minTemp) * (remainingPts / TOTAL_POSSIBLE_PTS)
  const vals = participants.map(p => (p[key] || 0) / temp)
  const maxV = Math.max(...vals)
  const exps = vals.map(v => Math.exp(v - maxV))
  const total = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => Math.round((e / total) * 100))
}

const TEAM_COLORS = {
  "Boston Bruins":           { bg: "#FFB81C", text: "#000000", alt: "#000000" },
  "Toronto Maple Leafs":     { bg: "#003E7E", text: "#ffffff", alt: "#FFFFFF" },
  "Florida Panthers":        { bg: "#C8102E", text: "#ffffff", alt: "#041E42" },
  "Tampa Bay Lightning":     { bg: "#002868", text: "#ffffff", alt: "#FFFFFF" },
  "Colorado Avalanche":      { bg: "#6F263D", text: "#ffffff", alt: "#236192" },
  "Dallas Stars":            { bg: "#006847", text: "#ffffff", alt: "#8F8F8C" },
  "Vegas Golden Knights":    { bg: "#B4975A", text: "#000000", alt: "#333F42" },
  "LA Kings":                { bg: "#111111", text: "#ffffff", alt: "#A2AAAD" },
  "Edmonton Oilers":         { bg: "#FF4C00", text: "#ffffff", alt: "#041E42" },
  "Vancouver Canucks":       { bg: "#00843D", text: "#ffffff", alt: "#041E42" },
  "Carolina Hurricanes":     { bg: "#CC0000", text: "#ffffff", alt: "#000000" },
  "New York Rangers":        { bg: "#0038A8", text: "#ffffff", alt: "#CE1126" },
  "Winnipeg Jets":           { bg: "#004C97", text: "#ffffff", alt: "#AC162C" },
  "St. Louis Blues":         { bg: "#002F87", text: "#ffffff", alt: "#FCB514" },
  "Minnesota Wild":          { bg: "#154734", text: "#ffffff", alt: "#A6192E" },
  "Seattle Kraken":          { bg: "#001628", text: "#99D9D9", alt: "#99D9D9" },
  "Buffalo Sabres":          { bg: "#003087", text: "#ffffff", alt: "#FCB514" },
  "Montreal Canadiens":      { bg: "#AF1E2D", text: "#ffffff", alt: "#192168" },
  "Ottawa Senators":         { bg: "#C52032", text: "#ffffff", alt: "#C69214" },
  "Philadelphia Flyers":     { bg: "#F74902", text: "#ffffff", alt: "#000000" },
  "Pittsburgh Penguins":     { bg: "#FCB514", text: "#000000", alt: "#000000" },
  "Los Angeles Kings":       { bg: "#111111", text: "#ffffff", alt: "#A2AAAD" },
  "Utah Mammoth":            { bg: "#6CACE4", text: "#000000", alt: "#1B3668" },
  "Anaheim Ducks":           { bg: "#F47A38", text: "#000000", alt: "#B5985A" },
  "Boston Celtics":          { bg: "#007A33", text: "#ffffff", alt: "#BA9653" },
  "Miami Heat":              { bg: "#98002E", text: "#ffffff", alt: "#F9A01B" },
  "Milwaukee Bucks":         { bg: "#00471B", text: "#ffffff", alt: "#EEE1C6" },
  "Indiana Pacers":          { bg: "#002D62", text: "#ffffff", alt: "#FDBB30" },
  "Denver Nuggets":          { bg: "#0E2240", text: "#FEC524", alt: "#FEC524" },
  "LA Lakers":               { bg: "#552583", text: "#FDB927", alt: "#FDB927" },
  "Los Angeles Lakers":      { bg: "#552583", text: "#FDB927", alt: "#FDB927" },
  "Oklahoma City Thunder":   { bg: "#007AC1", text: "#ffffff", alt: "#EF3B24" },
  "New Orleans Pelicans":    { bg: "#0C2340", text: "#ffffff", alt: "#C8102E" },
  "Cleveland Cavaliers":     { bg: "#860038", text: "#ffffff", alt: "#FDBB30" },
  "Orlando Magic":           { bg: "#0077C0", text: "#ffffff", alt: "#000000" },
  "New York Knicks":         { bg: "#006BB6", text: "#ffffff", alt: "#F58426" },
  "Philadelphia 76ers":      { bg: "#006BB6", text: "#ffffff", alt: "#ED174C" },
  "Minnesota Timberwolves":  { bg: "#0C2340", text: "#ffffff", alt: "#236192" },
  "Golden State Warriors":   { bg: "#1D428A", text: "#FFC72C", alt: "#FFC72C" },
  "Houston Rockets":         { bg: "#CE1141", text: "#ffffff", alt: "#000000" },
  "Memphis Grizzlies":       { bg: "#5D76A9", text: "#12173F", alt: "#12173F" },
  "Detroit Pistons":         { bg: "#C8102E", text: "#ffffff", alt: "#1D42BA" },
  "Toronto Raptors":         { bg: "#CE1141", text: "#ffffff", alt: "#000000" },
  "Atlanta Hawks":           { bg: "#E03A3E", text: "#ffffff", alt: "#C1D32F" },
  "San Antonio Spurs":       { bg: "#C4CED4", text: "#000000", alt: "#000000" },
  "TBD":                     { bg: "#2a2f3e", text: "#ffffff", alt: "#4a5568" },
}

function DonutChart({ slices, size = 160 }) {
  const svgRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const r = size / 2 - 16
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const total = slices.reduce((s, sl) => s + sl.count, 0)
  const GAP = 4

  useEffect(() => {
    if (!svgRef.current || total === 0) return
    const circles = svgRef.current.querySelectorAll('.donut-slice')
    circles.forEach((c, i) => {
      const pct = slices[i].count / total
      const fullDash = Math.max(0, circumference * pct - GAP)
      c.style.transition = 'none'
      c.setAttribute('stroke-dasharray', `0 ${circumference}`)
      setTimeout(() => {
        c.style.transition = `stroke-dasharray 0.5s ease ${i * 0.1}s`
        c.setAttribute('stroke-dasharray', `${fullDash} ${circumference - fullDash}`)
      }, 30)
    })
  }, [slices.map(s => s.count).join(',')])

  let offset = circumference * 0.25
  const paths = slices.map((sl) => {
    const pct = sl.count / total
    const dashLen = Math.max(0, circumference * pct - GAP)
    const o = offset
    offset -= circumference * pct
    return { ...sl, dashLen, offset: o, pct }
  })

  function handleSliceClick(sl, e) {
    const rect = e.currentTarget.closest('svg').getBoundingClientRect()
    const pct = Math.round((sl.count / total) * 100)
    setTooltip({ label: sl.label, count: sl.count, pct, x: e.clientX - rect.left, y: e.clientY - rect.top })
    setTimeout(() => setTooltip(null), 2500)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg ref={svgRef} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="20" />
        {paths.map((p, i) => (
          <g key={i}>
            <circle
              className="donut-slice"
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={p.bg}
              strokeWidth="20"
              strokeDasharray={`${p.dashLen} ${circumference - p.dashLen}`}
              strokeDashoffset={p.offset}
              style={{ cursor: 'pointer', transition: `stroke-dasharray 0.5s ease ${i * 0.1}s` }}
              onClick={(e) => handleSliceClick(p, e)}
            />
            <circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={p.border}
              strokeWidth="2"
              strokeDasharray={`${p.dashLen} ${circumference - p.dashLen}`}
              strokeDashoffset={p.offset}
              style={{ pointerEvents: 'none' }}
            />
          </g>
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff" fontFamily="Barlow Condensed, sans-serif">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.4)" fontFamily="Barlow, sans-serif">picks</text>
      </svg>
      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x + 10, top: tooltip.y - 10,
          background: '#0a0d14', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8, padding: '8px 12px', pointerEvents: 'none',
          zIndex: 999, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{tooltip.label}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{tooltip.count} picks · {tooltip.pct}%</div>
        </div>
      )}
    </div>
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
  const [oddsData, setOddsData] = useState({})
  const [loading, setLoading] = useState(false)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (user) { loadSeries(); loadPicks(); loadParticipants() }
  }, [user])

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date()
      const { data } = await supabase.from('series').select('*').eq('locked', false)
      if (data) {
        data.forEach(async (s) => {
          if (s.game1_time && new Date(s.game1_time) <= now)
            await supabase.from('series').update({ locked: true }).eq('id', s.id)
        })
        loadSeries()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  async function loadSeries() {
    const { data } = await supabase.from('series').select('*').order('round').order('game1_time')
    if (data) {
      setSeries({ NHL: data.filter(s => s.league === 'NHL'), NBA: data.filter(s => s.league === 'NBA') })
      fetchOdds(data.filter(s => s.locked && !s.result_winner))
    }
  }

  async function fetchOdds(activeSeries) {
    if (!activeSeries.length) return
    try {
      const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY
      if (!apiKey) return
      const newOdds = {}
      await Promise.all(activeSeries.map(async (s) => {
        const sport = s.league === 'NHL' ? 'icehockey_nhl' : 'basketball_nba'
        const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american`)
        if (!res.ok) return
        const events = await res.json()
        const match = events.find(e =>
          (e.home_team.includes(s.home_team.split(' ').pop()) || s.home_team.includes(e.home_team.split(' ').pop())) &&
          (e.away_team.includes(s.away_team.split(' ').pop()) || s.away_team.includes(e.away_team.split(' ').pop()))
        )
        if (!match) return
        const dk = match.bookmakers.find(b => b.key === 'draftkings') || match.bookmakers[0]
        if (!dk) return
        const h2h = dk.markets.find(m => m.key === 'h2h')
        if (!h2h) return
        const homeOdds = h2h.outcomes.find(o => o.name.includes(s.home_team.split(' ').pop()))
        const awayOdds = h2h.outcomes.find(o => o.name.includes(s.away_team.split(' ').pop()))
        if (!homeOdds || !awayOdds) return
        function americanToProb(odds) {
          return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100)
        }
        const rawHome = americanToProb(homeOdds.price)
        const rawAway = americanToProb(awayOdds.price)
        const total = rawHome + rawAway
        newOdds[s.id] = {
          homeWinProb: rawHome / total,
          seriesScore: s.series_score || { homeWins: 0, awayWins: 0 }
        }
      }))
      setOddsData(prev => ({ ...prev, ...newOdds }))
    } catch (e) {
      console.error('Odds fetch failed:', e)
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
          if (!pick) { if (s.league === 'NHL') nhlTotal -= 4; else nbaTotal -= 4; return }
          const pts = calcPoints(s.round, pick.picked_winner, s.result_winner, s.result_games, pick.picked_games)
          if (s.league === 'NHL') nhlTotal += pts; else nbaTotal += pts
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
    setUser(data); setLoading(false); return null
  }

  async function handleRegister(fullName, phone, pin) {
    setLoading(true)
    const { data, error } = await supabase.from('users').insert({ full_name: fullName, phone, pin_hash: pin }).select().single()
    if (error) { setLoading(false); return error.message.includes('unique') ? 'Phone number already registered' : 'Registration failed' }
    setUser(data); setLoading(false); return null
  }

  async function submitPick(seriesId) {
    const p = pendingPicks[seriesId]
    if (!p?.winner || !p?.games) return
    const { error } = await supabase.from('picks').upsert({ user_id: user.id, series_id: seriesId, picked_winner: p.winner, picked_games: p.games }, { onConflict: 'user_id,series_id' })
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
    loadSeries(); loadParticipants(); showToast('Result saved ✓')
  }

  const NAV_ITEMS = [
    { key: 'picks',         label: 'Picks',     icon: '🏒' },
    { key: 'standings',     label: 'Standings', icon: '🏆' },
    { key: 'distributions', label: 'Distrib.',  icon: '📊' },
    { key: 'scoring',       label: 'Scoring',   icon: '📋' },
    ...(user?.is_admin ? [{ key: 'admin', label: 'Admin', icon: '⚙️' }] : []),
  ]

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
        <div className="content-wrap">
          <header className="topbar">
            <div className="topbar-logo">
              <span className="topbar-year">2026</span>
              <span className="topbar-title">Playoff Pool</span>
            </div>
            <div className="topbar-right">
              <span className="topbar-user"><strong>{user.full_name}</strong></span>
              <button className="signout-btn" onClick={() => setUser(null)}>Sign Out</button>
            </div>
          </header>
          <main className="main-content">
            {page === 'picks'         && <PicksPage series={series} userPicks={userPicks} pendingPicks={pendingPicks} setPendingPicks={setPendingPicks} submitPick={submitPick} />}
            {page === 'standings'     && <StandingsPage participants={participants} allPicks={allPicks} series={series} oddsData={oddsData} currentUser={user} />}
            {page === 'distributions' && <DistributionsPage series={series} allPicks={allPicks} participants={participants} />}
            {page === 'scoring'       && <ScoringRulesPage participants={participants} />}
            {page === 'admin' && user.is_admin && <AdminPage series={series} toggleLock={toggleLock} enterResult={enterResult} participants={participants} allPicks={allPicks} showToast={showToast} />}
          </main>
        </div>
        <nav className="bottom-nav">
          {NAV_ITEMS.map(item => (
            <button key={item.key} className={`bnav-item ${page === item.key ? 'bnav-active' : ''}`} onClick={() => setPage(item.key)}>
              <span className="bnav-icon">{item.icon}</span>
              <span className="bnav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        {toast && <div className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`}>{toast.msg}</div>}
      </div>
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
    const err = isRegister ? await onRegister(name.trim(), phone.trim(), pin.join('')) : await onLogin(name.trim(), pin.join(''))
    if (err) setError(err)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-year-badge">2026</div>
          <div className="login-title">Playoff Pool</div>
        </div>
        <div className="login-sub">NHL & NBA Playoffs</div>
        <div className="login-toggle">
          <button className={`toggle-btn ${!isRegister ? 'active' : ''}`} onClick={() => { setIsRegister(false); setError('') }}>Sign In</button>
          <button className={`toggle-btn ${isRegister ? 'active' : ''}`} onClick={() => { setIsRegister(true); setError('') }}>Register</button>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div className="field-label">Full Name</div>
        <input className="field-input" placeholder="e.g. Alex Thompson" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
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
      </div>
    </div>
  )
}

function PicksPage({ series, userPicks, pendingPicks, setPendingPicks, submitPick }) {
  const [league, setLeague] = useState('NHL')
  const allSeries = series[league]
  const rounds = [...new Set(allSeries.map(s => s.round))].sort((a,b) => a-b)
  const maxRound = Math.max(...rounds, 1)
  const [openRounds, setOpenRounds] = useState({ [`${league}${maxRound}`]: true })

  useEffect(() => {
    setOpenRounds({ [`${league}${maxRound}`]: true })
  }, [league])

  function toggleRound(key) {
    setOpenRounds(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function setPick(seriesId, field, val) {
    setPendingPicks(prev => ({ ...prev, [seriesId]: { ...(prev[seriesId] || {}), [field]: val } }))
  }

  const ROUND_NAMES = { 1: 'First Round', 2: 'Second Round', 3: 'Conf. Finals', 4: 'Finals' }

  if (allSeries.length === 0) return (
    <div className="page">
      <div className="page-title">My Picks</div>
      <div className="page-sub">No series added yet. Check back soon!</div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-title">My Picks</div>
      <div className="page-sub">Picks lock automatically at Game 1.</div>
      <div className="league-tabs">
        <button className={`league-tab ${league === 'NHL' ? 'lt-active' : ''}`} onClick={() => setLeague('NHL')}>🏒 NHL</button>
        <button className={`league-tab ${league === 'NBA' ? 'lt-active' : ''}`} onClick={() => setLeague('NBA')}>🏀 NBA</button>
      </div>
      {rounds.map(r => {
        const key = `${league}${r}`
        const isOpen = !!openRounds[key]
        const roundSeries = allSeries.filter(s => s.round === r)
        const isActive = r === maxRound
        const pickedCount = roundSeries.filter(s => userPicks[s.id]).length
        const roundPts = roundSeries.reduce((sum, s) => {
          const pick = userPicks[s.id]
          if (!pick || !s.result_winner) return sum
          return sum + calcPoints(s.round, pick.winner, s.result_winner, s.result_games, pick.games)
        }, 0)
        return (
          <div key={r} style={{ marginBottom: 8 }}>
            <div className={`round-header ${isOpen ? 'rh-open' : ''}`} onClick={() => toggleRound(key)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="rh-label">{league} · Round {r}</span>
                <span className="rh-sub">{ROUND_NAMES[r]}</span>
                {isActive && <span className="rh-badge">ACTIVE</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {!isActive && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{pickedCount}/{roundSeries.length} · <span style={{ color: roundPts >= 0 ? '#6ee87a' : '#f87171', fontWeight: 700 }}>{roundPts >= 0 ? '+' : ''}{roundPts}</span></span>}
                <span className="rh-arrow" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
              </div>
            </div>
            {isOpen && (
              <div className="round-body">
                {roundSeries.map(s => {
                  const submitted = userPicks[s.id]
                  const pending = pendingPicks[s.id] || {}
                  const displayPick = s.locked ? submitted : (pending.winner ? pending : submitted)
                  const isSubmitted = !!submitted && !pendingPicks[s.id]
                  let pts = null
                  if (submitted && s.result_winner) pts = calcPoints(s.round, submitted.winner, s.result_winner, s.result_games, submitted.games)
                  return (
                    <div key={s.id} className={`series-card ${s.locked ? 'sc-locked' : isSubmitted ? 'sc-submitted' : ''}`}>
                      <div className="sc-date">Game 1 · {s.game1_time ? new Date(s.game1_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD'}</div>
                      <div className="matchup">
                        {[s.home_team, s.away_team].map(team => {
                          const isSelected = displayPick?.winner === team
                          const tc = TEAM_COLORS[team] || { bg: '#2a2f3e', text: '#ffffff' }
                          const isWinner = s.result_winner === team
                          return (
                            <button key={team} className="team-opt" disabled={s.locked} onClick={() => setPick(s.id, 'winner', team)}
                              style={{ background: isSelected ? tc.bg : 'transparent', color: isSelected ? tc.text : 'rgba(255,255,255,0.6)', borderColor: isWinner ? '#6ee87a' : isSelected ? tc.bg : 'rgba(255,255,255,0.1)', borderWidth: isWinner ? 2 : 1.5 }}>
                              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700 }}>{team}</div>
                              {isSelected && !s.result_winner && <div style={{ fontSize: 9, marginTop: 2, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>Picked</div>}
                              {isWinner && <div style={{ fontSize: 9, marginTop: 2, color: '#6ee87a', textTransform: 'uppercase', letterSpacing: 1 }}>Winner ✓</div>}
                            </button>
                          )
                        })}
                      </div>
                      <div className="games-label">Series Length</div>
                      <div className="games-opts">
                        {[4,5,6,7].map(g => (
                          <button key={g} className={`game-num ${displayPick?.games === g ? 'gn-sel' : ''}`} disabled={s.locked} onClick={() => setPick(s.id, 'games', g)}>{g}</button>
                        ))}
                      </div>
                      {s.result_winner ? (
                        <div className="result-badge">
                          <span>Result: <strong>{s.result_winner}</strong> in {s.result_games}</span>
                          {pts !== null && <span className={pts >= 0 ? 'pts-pos' : 'pts-neg'} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700 }}>{pts >= 0 ? '+' : ''}{pts} pts</span>}
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
            )}
          </div>
        )
      })}
    </div>
  )
}

function SeriesDistCard({ s, allPicks, participants }) {
  const [open, setOpen] = useState(false)
  const picks = allPicks.filter(p => p.series_id === s.id)
  const totalParticipants = participants.length
  const noPicks = totalParticipants - picks.length

  const groups = {}
  picks.forEach(p => {
    const key = `${p.picked_winner}|${p.picked_games}`
    groups[key] = (groups[key] || 0) + 1
  })

  const slices = []
  const legend = []
  ;[s.home_team, s.away_team].forEach(team => {
    const tc = TEAM_COLORS[team] || { bg: '#444', alt: '#888' }
    const teamPicks = Object.entries(groups)
      .filter(([k]) => k.startsWith(team + '|'))
      .map(([k, cnt]) => ({ games: parseInt(k.split('|')[1]), cnt }))
      .sort((a, b) => a.games - b.games)
    teamPicks.forEach(tp => {
      slices.push({ label: `${team.split(' ').pop()} in ${tp.games}`, count: tp.cnt, bg: tc.bg, border: tc.alt })
      legend.push({ label: `${team.split(' ').pop()} in ${tp.games}`, count: tp.cnt, bg: tc.bg, border: tc.alt })
    })
  })
  if (noPicks > 0) {
    slices.push({ label: 'No Pick', count: noPicks, bg: '#374151', border: '#6b7280' })
    legend.push({ label: 'No Pick', count: noPicks, bg: '#374151', border: '#6b7280' })
  }

  const homeCount = picks.filter(p => p.picked_winner === s.home_team).length
  const awayCount = picks.filter(p => p.picked_winner === s.away_team).length
  const homeTc = TEAM_COLORS[s.home_team] || { bg: '#888', text: '#fff' }
  const awayTc = TEAM_COLORS[s.away_team] || { bg: '#888', text: '#fff' }

  return (
    <div className="dist-card">
      <button className="dist-header" onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: '#e8eaf0', marginBottom: 2 }}>
            {s.home_team} vs {s.away_team}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            {picks.length}/{totalParticipants} picks
            {s.result_winner && <span style={{ color: '#6ee87a', marginLeft: 6 }}>· Final: {s.result_winner} in {s.result_games}</span>}
            {!s.result_winner && <span style={{ color: '#f97316', marginLeft: 6 }}>· In progress</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: homeTc.bg, color: homeTc.text, padding: '2px 8px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700 }}>{homeCount}</span>
          <span style={{ background: awayTc.bg, color: awayTc.text, padding: '2px 8px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700 }}>{awayCount}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
            <DonutChart slices={slices} size={160} />
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Distribution</div>
              {legend.map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 3, background: l.bg, border: `2px solid ${l.border}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', flex: 1 }}>{l.label}</span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff' }}>{l.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Player Picks</div>
          {participants.map(u => {
            const pick = picks.find(p => p.user_id === u.id)
            const tc = pick ? (TEAM_COLORS[pick.picked_winner] || { bg: '#444', text: '#fff' }) : null
            let pts = null
            if (pick && s.result_winner) pts = calcPoints(s.round, pick.picked_winner, s.result_winner, s.result_games, pick.picked_games)
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 7, gap: 8, marginBottom: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{u.full_name}</span>
                {pick ? (
                  <>
                    <span style={{ background: tc.bg, color: tc.text, padding: '2px 8px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700 }}>{pick.picked_winner.split(' ').pop()}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 28 }}>in {pick.picked_games}</span>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, minWidth: 32, textAlign: 'right', color: pts === null ? 'rgba(255,255,255,0.3)' : pts > 0 ? '#6ee87a' : pts < 0 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
                      {pts === null ? '—' : pts > 0 ? `+${pts}` : pts}
                    </span>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#f87171', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, padding: '2px 8px', background: 'rgba(248,113,113,0.1)', borderRadius: 4 }}>NO PICK</span>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: '#f87171', minWidth: 32, textAlign: 'right' }}>{s.result_winner ? '-4' : '—'}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DistributionsPage({ series, allPicks, participants }) {
  const [league, setLeague] = useState('NHL')
  const allSeries = series[league]
  const rounds = [...new Set(allSeries.map(s => s.round))].sort((a,b) => a-b)
  const [openRounds, setOpenRounds] = useState({ [`${league}1`]: true })

  useEffect(() => {
    setOpenRounds({ [`${league}1`]: true })
  }, [league])

  function toggleRound(key) {
    setOpenRounds(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="page">
      <div className="page-title">Distributions</div>
      <div className="page-sub">Click any series to expand picks and chart.</div>
      <div className="league-tabs">
        <button className={`league-tab ${league === 'NHL' ? 'lt-active' : ''}`} onClick={() => setLeague('NHL')}>🏒 NHL</button>
        <button className={`league-tab ${league === 'NBA' ? 'lt-active' : ''}`} onClick={() => setLeague('NBA')}>🏀 NBA</button>
      </div>
      {rounds.map(r => {
        const key = `${league}${r}`
        const isOpen = !!openRounds[key]
        const roundSeries = allSeries.filter(s => s.round === r && s.locked)
        return (
          <div key={r} style={{ marginBottom: 8 }}>
            <div className={`round-header ${isOpen ? 'rh-open' : ''}`} onClick={() => toggleRound(key)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="rh-label">{league} · Round {r}</span>
              </div>
              <span className="rh-arrow" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
            </div>
            {isOpen && (
              <div className="round-body">
                {roundSeries.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No locked series yet.</div>
                ) : roundSeries.map(s => (
                  <SeriesDistCard key={s.id} s={s} allPicks={allPicks} participants={participants} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ScoringRulesPage({ participants }) {
  const pot = participants.length * BUY_IN
  const rounds = [
    { round: 1, name: 'First Round',  winPts: 4, gameBonus: 1 },
    { round: 2, name: 'Second Round', winPts: 5, gameBonus: 1 },
    { round: 3, name: 'Conf. Finals', winPts: 6, gameBonus: 2 },
    { round: 4, name: 'Finals',       winPts: 8, gameBonus: 3 },
  ]
  return (
    <div className="page">
      <div className="page-title">Scoring</div>
      <div className="page-sub">How points are calculated.</div>
      <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 10, padding: '16px', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Maximum Possible Score</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 48, fontWeight: 800, color: '#f97316', lineHeight: 1 }}>{TOTAL_POSSIBLE_PTS} <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>pts</span></div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>every pick correct with exact series length</div>
      </div>
      <div style={{ background: 'rgba(110,232,122,0.08)', border: '1px solid rgba(110,232,122,0.2)', borderRadius: 10, padding: '16px', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Total Pot</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 48, fontWeight: 800, color: '#6ee87a', lineHeight: 1 }}>${pot.toLocaleString()}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{participants.length} participants × ${BUY_IN}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {rounds.map(r => (
          <div key={r.round} className="round-card">
            <div className="round-code">R{r.round}</div>
            <div className="round-name-label">{r.name}</div>
            <div className="round-pts">{r.winPts} <span>pts</span></div>
            <div className="round-bonus">+{r.gameBonus} exact bonus</div>
          </div>
        ))}
        <div className="round-card" style={{ borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.05)' }}>
          <div className="round-code" style={{ color: '#f87171' }}>—</div>
          <div className="round-name-label">No Pick</div>
          <div className="round-pts" style={{ color: '#f87171' }}>−4 <span>pts</span></div>
          <div className="round-bonus" style={{ color: '#f87171' }}>Max penalty</div>
        </div>
      </div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>Payouts</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {PAYOUT_PCTS.map((p, i) => {
          const amount = Math.round((pot * p.pct) / 10) * 10
          return (
            <div key={i} style={{ background: '#1c2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: '12px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 4 }}>{p.label}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 800, color: '#6ee87a', lineHeight: 1 }}>${amount.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{Math.round(p.pct * 100)}% of pot</div>
            </div>
          )
        })}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', padding: '14px' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>The 8-Position Scale</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {['Winner in 4','Winner in 5','Winner in 6','Winner in 7','Loser in 7','Loser in 6','Loser in 5','Loser in 4'].map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: i < 4 ? 'rgba(249,115,22,0.15)' : 'rgba(248,113,113,0.1)', border: `1px solid ${i < 4 ? 'rgba(249,115,22,0.4)' : 'rgba(248,113,113,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: i < 4 ? '#f97316' : '#f87171', flexShrink: 0 }}>{i+1}</div>
              <div style={{ fontSize: 13, color: i < 4 ? '#e8eaf0' : 'rgba(255,255,255,0.4)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function computeProjected(participants, allPicks, allSeriesFlat, oddsData) {
  const gradedSeries = allSeriesFlat.filter(s => s.result_winner)
  const inProgressSeries = allSeriesFlat.filter(s => s.locked && !s.result_winner)
  const futureSeries = allSeriesFlat.filter(s => !s.locked)

  // League average points per pick (from graded series only)
  let totalLeaguePts = 0, totalLeaguePicks = 0
  gradedSeries.forEach(s => {
    allPicks.forEach(pk => {
      if (pk.series_id !== s.id) return
      const pts = calcPoints(s.round, pk.picked_winner, s.result_winner, s.result_games, pk.picked_games)
      totalLeaguePts += pts
      totalLeaguePicks++
    })
    // count no-picks as -4
    const pickedUsers = new Set(allPicks.filter(p => p.series_id === s.id).map(p => p.user_id))
    participants.forEach(u => {
      if (!pickedUsers.has(u.id)) { totalLeaguePts -= 4; totalLeaguePicks++ }
    })
  })
  const leagueAvgPtsPerPick = totalLeaguePicks > 0 ? totalLeaguePts / totalLeaguePicks : 0

  // Mean EV per round for future series
  const futureEVByRound = {}
  futureSeries.forEach(s => {
    const league = s.league
    const dist = GAME_LENGTH_DIST[league]
    const homeProb = 0.5, awayProb = 0.5
    let ev = 0
    ;[4,5,6,7].forEach(g => {
      ev += homeProb * dist[g] * (WINNER_PTS[s.round] * 0.5)
      ev += awayProb * dist[g] * (WINNER_PTS[s.round] * 0.5)
    })
    if (!futureEVByRound[s.round]) futureEVByRound[s.round] = []
    futureEVByRound[s.round].push(ev)
  })
  const meanFutureEVByRound = {}
  Object.entries(futureEVByRound).forEach(([r, evs]) => {
    meanFutureEVByRound[r] = evs.reduce((a,b) => a+b, 0) / evs.length
  })

  return participants.map(u => {
    // Personal skill: pts per pick on graded series
    let personalPts = 0, personalPicks = 0
    gradedSeries.forEach(s => {
      const pick = allPicks.find(p => p.user_id === u.id && p.series_id === s.id)
      if (pick) {
        personalPts += calcPoints(s.round, pick.picked_winner, s.result_winner, s.result_games, pick.picked_games)
      } else {
        personalPts -= 4
      }
      personalPicks++
    })
    const personalAvg = personalPicks > 0 ? personalPts / personalPicks : 0
    const skillFactor = 0.25 * personalAvg + 0.75 * leagueAvgPtsPerPick

    let nhlProjected = u.nhlTotal || 0
    let nbaProjected = u.nbaTotal || 0

    // In-progress EV
    inProgressSeries.forEach(s => {
      const pick = allPicks.find(p => p.user_id === u.id && p.series_id === s.id)
      const ev = calcSeriesEV(pick || null, s, oddsData)
      if (s.league === 'NHL') nhlProjected += ev
      else nbaProjected += ev
    })

    // Future series projected
    futureSeries.forEach(s => {
      const meanEV = meanFutureEVByRound[s.round] || 0
      const proj = skillFactor * meanEV > 0 ? skillFactor * meanEV : meanEV
      if (s.league === 'NHL') nhlProjected += proj
      else nbaProjected += proj
    })

    return {
      ...u,
      nhlProjected,
      nbaProjected,
      combinedProjected: nhlProjected + nbaProjected,
    }
  })
}

function CumulativeChart({ participants, allPicks, allSeries, league, currentUserId }) {
  const [showAll, setShowAll] = useState(false)
  const canvasRef = useRef(null)

  const leagueSeries = allSeries
    .filter(s => (league === 'combined' || s.league === league) && s.result_winner)
    .sort((a, b) => new Date(a.result_date || a.game1_time) - new Date(b.result_date || b.game1_time))

  const labels = leagueSeries.map(s => `${s.home_team.split(' ').pop()} vs ${s.away_team.split(' ').pop()}`)

  const sorted = [...participants].sort((a, b) => {
    let aTotal = 0, bTotal = 0
    leagueSeries.forEach(s => {
      const aPick = allPicks.find(p => p.user_id === a.id && p.series_id === s.id)
      const bPick = allPicks.find(p => p.user_id === b.id && p.series_id === s.id)
      aTotal += aPick ? calcPoints(s.round, aPick.picked_winner, s.result_winner, s.result_games, aPick.picked_games) : -4
      bTotal += bPick ? calcPoints(s.round, bPick.picked_winner, s.result_winner, s.result_games, bPick.picked_games) : -4
    })
    return bTotal - aTotal
  })

  const displayed = showAll ? sorted : sorted.slice(0, 10)

  const COLORS = ['#f97316','#60a5fa','#6ee87a','#f87171','#c4b5fd','#fdba74','#67e8f9','#a3e635','#f9a8d4','#94a3b8']

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || leagueSeries.length === 0) return
    const ctx = canvas.getContext('2d')
    const W = canvas.offsetWidth
    const H = 280
    canvas.width = W
    canvas.height = H

    const PAD = { top: 20, right: 20, bottom: 60, left: 44 }
    const chartW = W - PAD.left - PAD.right
    const chartH = H - PAD.top - PAD.bottom

    // Compute cumulative data
    const allData = displayed.map((p, pi) => {
      let cum = 0
      const points = leagueSeries.map(s => {
        const pick = allPicks.find(pk => pk.user_id === p.id && pk.series_id === s.id)
        const pts = pick ? calcPoints(s.round, pick.picked_winner, s.result_winner, s.result_games, pick.picked_games) : -4
        cum += pts
        return cum
      })
      return { name: p.id === currentUserId ? 'You' : p.full_name, points, isMe: p.id === currentUserId, color: p.id === currentUserId ? '#f97316' : COLORS[pi % COLORS.length] }
    })

    const allVals = allData.flatMap(d => d.points)
    const minV = Math.min(0, ...allVals)
    const maxV = Math.max(0, ...allVals)
    const range = maxV - minV || 1

    function toX(i) { return PAD.left + (i / Math.max(leagueSeries.length - 1, 1)) * chartW }
    function toY(v) { return PAD.top + chartH - ((v - minV) / range) * chartH }

    ctx.clearRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ;[0, 0.25, 0.5, 0.75, 1].forEach(t => {
      const y = PAD.top + t * chartH
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + chartW, y); ctx.stroke()
    })

    // Zero line
    if (minV < 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1
      const y0 = toY(0)
      ctx.beginPath(); ctx.moveTo(PAD.left, y0); ctx.lineTo(PAD.left + chartW, y0); ctx.stroke()
    }

    // Y labels
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = '10px Barlow, sans-serif'
    ctx.textAlign = 'right'
    ;[0, 0.25, 0.5, 0.75, 1].forEach(t => {
      const v = Math.round(minV + (1-t) * range)
      ctx.fillText((v >= 0 ? '+' : '') + v, PAD.left - 6, PAD.top + t * chartH + 4)
    })

    // X labels
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '9px Barlow, sans-serif'
    leagueSeries.forEach((s, i) => {
      const x = toX(i)
      const label = s.home_team.split(' ').pop().slice(0,3).toUpperCase()
      ctx.save()
      ctx.translate(x, H - PAD.bottom + 14)
      ctx.rotate(-Math.PI / 4)
      ctx.textAlign = 'right'
      ctx.fillText(label, 0, 0)
      ctx.restore()
    })

    // Lines — draw non-me first
    allData.filter(d => !d.isMe).forEach(d => {
      ctx.strokeStyle = d.color
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      d.points.forEach((v, i) => {
        i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v))
      })
      ctx.stroke()
    })

    // My line on top
    const me = allData.find(d => d.isMe)
    if (me) {
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 3
      ctx.beginPath()
      me.points.forEach((v, i) => {
        i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v))
      })
      ctx.stroke()
      // Dots
      me.points.forEach((v, i) => {
        ctx.beginPath()
        ctx.arc(toX(i), toY(v), 3, 0, Math.PI * 2)
        ctx.fillStyle = '#f97316'
        ctx.fill()
      })
    }

    ctx.globalAlpha = 1
  }, [displayed, leagueSeries, allPicks])

  if (leagueSeries.length === 0) return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
      No graded series yet. Chart will appear once results are entered.
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          onClick={() => setShowAll(!showAll)}
          style={{ padding: '5px 12px', borderRadius: 6, background: showAll ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${showAll ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.1)'}`, color: showAll ? '#f97316' : 'rgba(255,255,255,0.5)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}
        >
          {showAll ? `Showing All ${sorted.length}` : 'Top 10 Only'}
        </button>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 8px 8px', marginBottom: 12 }}>
        <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        {displayed.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 3, borderRadius: 2, background: p.id === currentUserId ? '#f97316' : COLORS[i % COLORS.length] }} />
            <span style={{ fontSize: 11, color: p.id === currentUserId ? '#f97316' : 'rgba(255,255,255,0.5)', fontWeight: p.id === currentUserId ? 700 : 400 }}>
              {p.id === currentUserId ? 'You' : p.full_name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StandingsPage({ participants, allPicks, series, oddsData, currentUser }) {
  const [view, setView] = useState('combined')
  const [expandedId, setExpandedId] = useState(null)

  const allSeriesFlat = [...(series.NHL || []), ...(series.NBA || [])]
  const lockedSeries = allSeriesFlat.filter(s => s.locked)
  const remainingPts = calcRemainingPts(allSeriesFlat)

  const projected = computeProjected(participants, allPicks, allSeriesFlat, oddsData)
  const projectedWithChance = (() => {
    const combinedChances = softmaxChance(projected, 'combinedProjected', remainingPts)
    const nhlChances = softmaxChance(projected, 'nhlProjected', remainingPts)
    const nbaChances = softmaxChance(projected, 'nbaProjected', remainingPts)
    return projected.map((p, i) => ({
      ...p,
      chanceFirst: combinedChances[i],
      nhlChanceFirst: nhlChances[i],
      nbaChanceFirst: nbaChances[i],
    }))
  })()

  const isChartView = ['chart-combined', 'chart-nhl', 'chart-nba'].includes(view)
  const isProjectedView = ['proj-combined', 'proj-nhl', 'proj-nba'].includes(view)

  const getSortKey = () => {
    if (view === 'nhl') return 'nhlTotal'
    if (view === 'nba') return 'nbaTotal'
    if (view === 'proj-nhl') return 'nhlProjected'
    if (view === 'proj-nba') return 'nbaProjected'
    if (view === 'proj-combined') return 'combinedProjected'
    return 'combined'
  }

  const sorted = [...projectedWithChance].sort((a, b) => (b[getSortKey()] || 0) - (a[getSortKey()] || 0))
  const payoutCount = (view === 'nhl' || view === 'nba') ? 2 : 3

  const TABS = [
    { key: 'combined',      label: '🏆 All' },
    { key: 'nhl',           label: '🏒 NHL' },
    { key: 'nba',           label: '🏀 NBA' },
    { key: 'proj-combined', label: '📈 Proj' },
    { key: 'proj-nhl',      label: '📈 NHL' },
    { key: 'proj-nba',      label: '📈 NBA' },
    { key: 'chart-combined',label: '📊 All' },
    { key: 'chart-nhl',     label: '📊 NHL' },
    { key: 'chart-nba',     label: '📊 NBA' },
  ]

  return (
    <div className="page">
      <div className="page-title">Standings</div>
      <div className="page-sub">{isChartView ? 'Cumulative score after each graded series.' : isProjectedView ? 'Projected final score + chance of winning.' : 'Click a name to expand their picks.'}</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} className={`league-tab ${view === t.key ? 'lt-active' : ''}`} style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => setView(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {isChartView && (
        <CumulativeChart
          participants={participants}
          allPicks={allPicks}
          allSeries={allSeriesFlat}
          league={view === 'chart-nhl' ? 'NHL' : view === 'chart-nba' ? 'NBA' : 'combined'}
          currentUserId={currentUser?.id}
        />
      )}

      {isProjectedView && (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)', width: 40 }}>#</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Name</th>
                <th style={{ textAlign: 'right', padding: '8px 8px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Now</th>
                <th style={{ textAlign: 'right', padding: '8px 8px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Proj</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Win%</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const rank = i + 1
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank
                const current = view === 'proj-nhl' ? p.nhlTotal : view === 'proj-nba' ? p.nbaTotal : p.combined
                const proj = view === 'proj-nhl' ? p.nhlProjected : view === 'proj-nba' ? p.nbaProjected : p.combinedProjected
                const chance = view === 'proj-nhl' ? p.nhlChanceFirst : view === 'proj-nba' ? p.nbaChanceFirst : p.chanceFirst
                const isMe = p.id === currentUser?.id
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isMe ? 'rgba(249,115,22,0.04)' : 'transparent' }}>
                    <td style={{ padding: '11px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: rank===1?'#f97316':rank===2?'#94a3b8':rank===3?'#b87333':'rgba(255,255,255,0.2)' }}>{medal}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: isMe ? '#f97316' : '#e8eaf0' }}>{p.full_name}{isMe && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(249,115,22,0.2)', color: '#f97316', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>YOU</span>}</div>
                    </td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: current >= 0 ? '#6ee87a' : '#f87171' }}>{current >= 0 ? '+' : ''}{current}</td>
                    <td style={{ padding: '11px 8px', textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: '#fff' }}>{proj >= 0 ? '+' : ''}{proj.toFixed(1)}</div>
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${chance}%`, background: chance >= 20 ? '#f97316' : chance >= 10 ? '#60a5fa' : 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: chance >= 20 ? '#f97316' : chance >= 10 ? '#60a5fa' : 'rgba(255,255,255,0.4)', minWidth: 28, textAlign: 'right' }}>{chance}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isChartView && !isProjectedView && (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)', width: 40 }}>#</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Name</th>
                {view === 'combined' && <>
                  <th style={{ textAlign: 'right', padding: '8px 8px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>NHL</th>
                  <th style={{ textAlign: 'right', padding: '8px 8px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>NBA</th>
                </>}
                <th style={{ textAlign: 'right', padding: '8px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const rank = i + 1
                const isPayout = rank <= payoutCount
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : (rank === 3 && view === 'combined') ? '🥉' : rank
                const isExpanded = expandedId === p.id
                const isMe = p.id === currentUser?.id
                const score = view === 'nhl' ? p.nhlTotal : view === 'nba' ? p.nbaTotal : p.combined
                const playerPicks = lockedSeries.map(s => {
                  const pick = allPicks.find(pk => pk.user_id === p.id && pk.series_id === s.id)
                  let pts = null
                  if (pick && s.result_winner) pts = calcPoints(s.round, pick.picked_winner, s.result_winner, s.result_games, pick.picked_games)
                  return { s, pick, pts }
                })
                return (
                  <>
                    <tr
                      key={p.id}
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      style={{ cursor: 'pointer', background: isExpanded ? 'rgba(249,115,22,0.06)' : isPayout ? 'rgba(249,115,22,0.03)' : isMe ? 'rgba(249,115,22,0.02)' : 'transparent', borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <td style={{ padding: '11px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: rank===1?'#f97316':rank===2?'#94a3b8':rank===3?'#b87333':'rgba(255,255,255,0.2)' }}>{medal}</td>
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: isExpanded ? '#f97316' : isMe ? '#fb923c' : '#e8eaf0' }}>{p.full_name}</div>
                        <div style={{ fontSize: 10, color: isExpanded ? '#f97316' : 'rgba(255,255,255,0.25)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 0.5 }}>
                          {isExpanded ? 'HIDE ▲' : 'PICKS ▼'}
                          {isPayout && <span style={{ marginLeft: 6, padding: '1px 5px', borderRadius: 3, background: rank===1?'rgba(249,115,22,0.2)':rank===2?'rgba(148,163,184,0.2)':'rgba(184,115,51,0.2)', color: rank===1?'#f97316':rank===2?'#94a3b8':'#b87333', fontSize: 9 }}>PAYOUT</span>}
                          {isMe && <span style={{ marginLeft: 6, padding: '1px 5px', borderRadius: 3, background: 'rgba(249,115,22,0.15)', color: '#f97316', fontSize: 9 }}>YOU</span>}
                        </div>
                      </td>
                      {view === 'combined' && <>
                        <td style={{ padding: '11px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.nhlTotal >= 0 ? '#6ee87a' : '#f87171' }}>{p.nhlTotal >= 0 ? '+' : ''}{p.nhlTotal}</td>
                        <td style={{ padding: '11px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: p.nbaTotal >= 0 ? '#6ee87a' : '#f87171' }}>{p.nbaTotal >= 0 ? '+' : ''}{p.nbaTotal}</td>
                      </>}
                      <td style={{ padding: '11px 12px', textAlign: 'right', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: score >= 0 ? '#6ee87a' : '#f87171' }}>{score >= 0 ? '+' : ''}{score}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${p.id}-exp`}>
                        <td colSpan={view === 'combined' ? 5 : 3} style={{ padding: '0 10px 12px', background: 'rgba(249,115,22,0.03)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {playerPicks.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '8px 0' }}>No locked series yet.</div>}
                          {playerPicks.map(({ s, pick, pts }) => {
                            const tc = pick ? (TEAM_COLORS[pick.picked_winner] || { bg: '#444', text: '#fff' }) : null
                            return (
                              <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 7, gap: 8, marginTop: 5, border: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, color: '#e8eaf0' }}>{s.home_team.split(' ').pop()} vs {s.away_team.split(' ').pop()}</div>
                                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                                    {s.league} R{s.round}
                                    {s.result_winner && <span style={{ color: '#6ee87a', marginLeft: 5 }}>· {s.result_winner.split(' ').pop()} in {s.result_games}</span>}
                                    {!s.result_winner && <span style={{ color: '#f97316', marginLeft: 5 }}>· In progress</span>}
                                  </div>
                                </div>
                                {pick ? (
                                  <>
                                    <span style={{ background: tc.bg, color: tc.text, padding: '2px 7px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700 }}>{pick.picked_winner.split(' ').pop()}</span>
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 28 }}>in {pick.picked_games}</span>
                                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, minWidth: 34, textAlign: 'right', color: pts === null ? 'rgba(255,255,255,0.3)' : pts > 0 ? '#6ee87a' : pts < 0 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
                                      {pts === null ? '—' : pts > 0 ? `+${pts}` : pts}
                                    </span>
                                  </>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#f87171', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, padding: '2px 7px', background: 'rgba(248,113,113,0.1)', borderRadius: 4 }}>NO PICK −4</span>
                                )}
                              </div>
                            )
                          })}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AdminPage({ series, toggleLock, enterResult, participants, allPicks, showToast }) {
  const allSeries = [...series.NHL, ...series.NBA]
  const [resultInputs, setResultInputs] = useState({})
  const [adminTab, setAdminTab] = useState('series')
  const allRounds = [...new Set(allSeries.map(s => s.round))].sort()
  const leagues = ['NHL', 'NBA']

  function getShortName(s) {
    return `${s.home_team.split(' ').pop()} vs ${s.away_team.split(' ').pop()}`
  }

  function generateMissingSummary() {
    const lines = ['🏒🏀 2026 PLAYOFF POOL — MISSING PICKS\n']
    let anyMissing = false
    leagues.forEach(lg => {
      allRounds.forEach(r => {
        const roundSeries = (series[lg] || []).filter(s => s.round === r && s.locked)
        if (!roundSeries.length) return
        const missingByPerson = {}
        participants.forEach(u => {
          const missing = roundSeries.filter(s => !allPicks.find(p => p.user_id === u.id && p.series_id === s.id))
          if (missing.length) missingByPerson[u.full_name] = missing.map(s => getShortName(s))
        })
        if (Object.keys(missingByPerson).length) {
          anyMissing = true
          lines.push(`${lg} Round ${r}:`)
          Object.entries(missingByPerson).forEach(([name, series]) => lines.push(`  ${name} — ${series.join(', ')}`))
          lines.push('')
        }
      })
    })
    if (!anyMissing) lines.push('Everyone has submitted all their picks! 🎉\n')
    lines.push('Submit picks at: https://playoffpool.vercel.app/')
    return lines.join('\n')
  }

  function copyMissingSummary() {
    navigator.clipboard.writeText(generateMissingSummary())
      .then(() => showToast('Summary copied! ✓'))
      .catch(() => showToast('Could not copy', 'error'))
  }

  return (
    <div className="page">
      <div className="page-title">Commissioner</div>
      <div className="page-sub">Manage series, results, and picks.</div>
      <div className="league-tabs" style={{ marginBottom: 16 }}>
        <button className={`league-tab ${adminTab === 'series' ? 'lt-active' : ''}`} onClick={() => setAdminTab('series')}>Series</button>
        <button className={`league-tab ${adminTab === 'picks' ? 'lt-active' : ''}`} onClick={() => setAdminTab('picks')}>Pick Status</button>
      </div>

      {adminTab === 'series' && (
        <>
          {['NHL', 'NBA'].map(lg => (
            <div key={lg} style={{ background: '#1c2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px', marginBottom: 10 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>{lg}</div>
              {series[lg].map(s => (
                <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: s.result_winner ? 0 : 6 }}>
                    <span style={{ fontSize: 12, color: '#e8eaf0' }}>{s.home_team} vs {s.away_team}</span>
                    <button className={`lock-toggle ${s.locked ? 'locked-btn' : 'unlocked'}`} onClick={() => toggleLock(lg, s.id)}>
                      {s.locked ? 'Unlock' : 'Lock'}
                    </button>
                  </div>
                  {!s.result_winner && s.locked && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                      <select style={{ flex: 1, padding: '5px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontFamily: "'Barlow', sans-serif" }}
                        onChange={e => setResultInputs(prev => ({ ...prev, [s.id]: { ...prev[s.id], winner: e.target.value } }))}>
                        <option value="">Winner...</option>
                        <option>{s.home_team}</option>
                        <option>{s.away_team}</option>
                      </select>
                      <select style={{ width: 65, padding: '5px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontFamily: "'Barlow', sans-serif" }}
                        onChange={e => setResultInputs(prev => ({ ...prev, [s.id]: { ...prev[s.id], games: parseInt(e.target.value) } }))}>
                        <option value="">Gms</option>
                        {[4,5,6,7].map(g => <option key={g}>{g}</option>)}
                      </select>
                      <button onClick={() => { const r = resultInputs[s.id]; if (r?.winner && r?.games) enterResult(s.id, r.winner, r.games) }}
                        style={{ padding: '5px 10px', borderRadius: 5, background: 'rgba(110,232,122,0.15)', border: '1px solid rgba(110,232,122,0.3)', color: '#6ee87a', fontSize: 12, cursor: 'pointer', fontFamily: "'Barlow', sans-serif" }}>
                        Save
                      </button>
                    </div>
                  )}
                  {s.result_winner && <div style={{ fontSize: 11, color: '#6ee87a', marginTop: 3 }}>✓ {s.result_winner} in {s.result_games}</div>}
                </div>
              ))}
            </div>
          ))}
          <div style={{ background: '#1c2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px', marginBottom: 10 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>Pool Stats</div>
            {[['Participants', participants.length], ['Locked', `${allSeries.filter(s => s.locked).length}/${allSeries.length}`], ['Completed', `${allSeries.filter(s => s.result_winner).length}/${allSeries.length}`]].map(([l,v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                <span>{l}</span><span style={{ fontWeight: 700, color: '#fff' }}>{v}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {adminTab === 'picks' && (
        <div>
          {leagues.map(lg => (
            <div key={lg} style={{ marginBottom: 20 }}>
              {allRounds.map(r => {
                const roundSeries = (series[lg] || []).filter(s => s.round === r)
                if (!roundSeries.length) return null
                return (
                  <div key={r} style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
                      {lg === 'NHL' ? '🏒' : '🏀'} {lg} · Round {r}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: "'Barlow Condensed', sans-serif" }}>Name</th>
                              {roundSeries.map(s => (
                                <th key={s.id} style={{ textAlign: 'center', padding: '8px 6px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: "'Barlow Condensed', sans-serif", whiteSpace: 'nowrap' }}>
                                  {s.home_team.split(' ').pop()} vs {s.away_team.split(' ').pop()}
                                </th>
                              ))}
                              <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: "'Barlow Condensed', sans-serif" }}>Done</th>
                            </tr>
                          </thead>
                          <tbody>
                            {participants.map(u => {
                              const picked = roundSeries.filter(s => allPicks.find(p => p.user_id === u.id && p.series_id === s.id)).length
                              const total = roundSeries.length
                              const pct = total > 0 ? (picked / total) * 100 : 0
                              return (
                                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{u.full_name}</td>
                                  {roundSeries.map(s => {
                                    const hasPick = allPicks.find(p => p.user_id === u.id && p.series_id === s.id)
                                    return (
                                      <td key={s.id} style={{ textAlign: 'center', padding: '9px 6px' }}>
                                        <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: hasPick ? 'rgba(110,232,122,0.12)' : 'rgba(248,113,113,0.1)', color: hasPick ? '#6ee87a' : '#f87171', fontFamily: "'Barlow Condensed', sans-serif" }}>
                                          {hasPick ? '✓' : '—'}
                                        </span>
                                      </td>
                                    )
                                  })}
                                  <td style={{ padding: '9px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                      <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: pct === 100 ? '#6ee87a' : pct > 0 ? '#f97316' : '#f87171' }} />
                                      </div>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? '#6ee87a' : pct > 0 ? '#f97316' : '#f87171', fontFamily: "'Barlow Condensed', sans-serif" }}>{picked}/{total}</span>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          <div style={{ background: '#1c2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>Missing Picks Summary</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12, lineHeight: 1.5 }}>Copy and paste into your group chat.</div>
            <button className="blast-btn" onClick={copyMissingSummary}>📋 Copy Missing Picks Summary</button>
          </div>
        </div>
      )}
    </div>
  )
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Barlow', sans-serif; background: #0f1219; }
  .app { min-height: 100vh; min-height: 100dvh; background: #0f1219; color: #e8eaf0; display: flex; flex-direction: column; }
  .content-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .topbar { background: #0a0d14; border-bottom: 1px solid rgba(255,255,255,0.07); padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .topbar-logo .topbar-year { display: block; font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; color: #f97316; letter-spacing: 2px; text-transform: uppercase; }
  .topbar-logo .topbar-title { display: block; font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 800; color: #fff; letter-spacing: 2px; text-transform: uppercase; line-height: 1; }
  .topbar-right { display: flex; align-items: center; gap: 8px; }
  .topbar-user { font-size: 12px; color: rgba(255,255,255,0.5); }
  .topbar-user strong { color: #fff; }
  .signout-btn { padding: 4px 10px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.15); background: transparent; color: rgba(255,255,255,0.5); font-size: 11px; cursor: pointer; font-family: 'Barlow', sans-serif; }
  .main-content { flex: 1; overflow-y: auto; padding-bottom: 70px; }
  .main-content::-webkit-scrollbar { display: none; }
  .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #0a0d14; border-top: 1px solid rgba(255,255,255,0.08); display: flex; padding: 6px 0 max(10px, env(safe-area-inset-bottom)); z-index: 100; }
  .bnav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; padding: 4px 0; border: none; background: transparent; }
  .bnav-icon { font-size: 20px; line-height: 1; }
  .bnav-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.35); }
  .bnav-active .bnav-label { color: #f97316; }
  .login-wrap { min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: #0f1219; background-image: radial-gradient(ellipse at 50% 40%, rgba(249,115,22,0.1) 0%, transparent 60%); padding: 20px; }
  .login-card { width: 100%; max-width: 360px; padding: 36px 28px; background: #1c2030; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; text-align: center; }
  .login-logo { margin-bottom: 12px; }
  .login-year-badge { display: inline-block; background: #f97316; color: #fff; font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 800; letter-spacing: 2px; padding: 2px 10px; border-radius: 4px; margin-bottom: 8px; }
  .login-title { font-family: 'Barlow Condensed', sans-serif; font-size: 30px; font-weight: 800; color: #fff; letter-spacing: 2px; text-transform: uppercase; line-height: 1; }
  .login-sub { color: rgba(255,255,255,0.35); font-size: 12px; margin-bottom: 20px; }
  .login-toggle { display: flex; background: rgba(255,255,255,0.05); border-radius: 7px; padding: 3px; margin-bottom: 20px; }
  .toggle-btn { flex: 1; padding: 7px; border-radius: 5px; border: none; background: transparent; color: rgba(255,255,255,0.4); font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
  .toggle-btn.active { background: #f97316; color: #fff; }
  .field-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: rgba(255,255,255,0.4); text-transform: uppercase; margin-bottom: 5px; text-align: left; }
  .field-input { width: 100%; padding: 10px 12px; border-radius: 7px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; margin-bottom: 14px; }
  .field-input:focus { border-color: rgba(249,115,22,0.5); }
  .pin-row { display: flex; gap: 8px; margin-bottom: 14px; justify-content: center; }
  .pin-input { width: 48px; height: 48px; text-align: center; font-size: 18px; font-weight: 600; border-radius: 7px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; outline: none; transition: border-color 0.2s; }
  .pin-input:focus { border-color: rgba(249,115,22,0.5); }
  .btn-primary { width: 100%; padding: 12px; border-radius: 7px; background: #f97316; border: none; color: #fff; font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; margin-top: 6px; }
  .btn-primary:hover { background: #fb923c; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .error-msg { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); color: #f87171; border-radius: 6px; padding: 9px 12px; font-size: 12px; margin-bottom: 14px; text-align: left; }
  .page { max-width: 700px; margin: 0 auto; padding: 16px 14px; }
  .page-title { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .page-sub { color: rgba(255,255,255,0.4); font-size: 12px; margin-bottom: 16px; }
  .league-tabs { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
  .league-tab { padding: 7px 16px; border-radius: 6px; font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
  .league-tab.lt-active { background: rgba(249,115,22,0.12); border-color: rgba(249,115,22,0.4); color: #f97316; }
  .round-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); margin-bottom: 6px; cursor: pointer; }
  .round-header.rh-open { background: rgba(249,115,22,0.07); border-color: rgba(249,115,22,0.25); border-radius: 8px 8px 0 0; margin-bottom: 0; }
  .rh-label { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.5); }
  .rh-open .rh-label { color: #f97316; }
  .rh-sub { font-size: 11px; color: rgba(255,255,255,0.3); }
  .rh-badge { font-size: 9px; padding: 2px 6px; border-radius: 3px; background: rgba(249,115,22,0.15); color: #f97316; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: 0.5px; }
  .rh-arrow { color: rgba(255,255,255,0.3); font-size: 13px; transition: transform 0.2s; display: inline-block; }
  .round-body { border: 1px solid rgba(249,115,22,0.15); border-top: none; border-radius: 0 0 8px 8px; padding: 10px; background: rgba(255,255,255,0.01); margin-bottom: 8px; }
  .series-card { background: #1c2030; border: 1px solid rgba(255,255,255,0.07); border-radius: 9px; padding: 12px; margin-bottom: 8px; position: relative; overflow: hidden; }
  .series-card:last-child { margin-bottom: 0; }
  .sc-locked { opacity: 0.75; }
  .sc-locked::after { content: 'LOCKED'; position: absolute; top: 10px; right: 10px; font-size: 9px; font-weight: 700; letter-spacing: 1px; background: rgba(248,113,113,0.15); color: #f87171; padding: 2px 6px; border-radius: 3px; font-family: 'Barlow Condensed', sans-serif; }
  .sc-submitted::after { content: 'SUBMITTED'; position: absolute; top: 10px; right: 10px; font-size: 9px; font-weight: 700; letter-spacing: 1px; background: rgba(249,115,22,0.15); color: #f97316; padding: 2px 6px; border-radius: 3px; font-family: 'Barlow Condensed', sans-serif; }
  .sc-date { font-size: 10px; color: rgba(255,255,255,0.25); letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 10px; }
  .matchup { display: flex; gap: 8px; margin-bottom: 10px; }
  .team-opt { flex: 1; padding: 10px 8px; border-radius: 7px; background: transparent; color: rgba(255,255,255,0.6); cursor: pointer; transition: all 0.2s; font-family: 'Barlow', sans-serif; font-size: 12px; font-weight: 500; text-align: center; line-height: 1.3; }
  .team-opt:hover:not(:disabled) { border-color: rgba(255,255,255,0.25) !important; }
  .team-opt:disabled { cursor: default; }
  .games-label { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1px; color: rgba(255,255,255,0.25); text-transform: uppercase; margin-bottom: 6px; }
  .games-opts { display: flex; gap: 5px; }
  .game-num { flex: 1; padding: 6px 2px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); cursor: pointer; font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; transition: all 0.2s; text-align: center; }
  .game-num:hover:not(:disabled) { border-color: rgba(249,115,22,0.4); color: #f97316; }
  .game-num.gn-sel { border-color: #f97316; background: rgba(249,115,22,0.15); color: #f97316; }
  .game-num:disabled { cursor: default; }
  .submit-pick-btn { width: 100%; margin-top: 10px; padding: 9px; border-radius: 6px; background: rgba(249,115,22,0.15); border: 1px solid rgba(249,115,22,0.4); color: #f97316; font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
  .submit-pick-btn:hover:not(:disabled) { background: rgba(249,115,22,0.25); }
  .submit-pick-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .result-badge { margin-top: 10px; padding: 7px 10px; border-radius: 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); font-size: 11px; color: rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: space-between; }
  .result-badge strong { color: #fff; }
  .pts-pos { color: #6ee87a; }
  .pts-neg { color: #f87171; }
  .dist-card { background: #1c2030; border: 1px solid rgba(255,255,255,0.07); border-radius: 9px; overflow: hidden; margin-bottom: 8px; }
  .dist-card:last-child { margin-bottom: 0; }
  .dist-header { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: transparent; border: none; cursor: pointer; color: #e8eaf0; text-align: left; }
  .round-card { background: #1c2030; border: 1px solid rgba(255,255,255,0.07); border-radius: 9px; padding: 14px; }
  .round-code { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 800; color: #f97316; letter-spacing: 1px; margin-bottom: 2px; }
  .round-name-label { font-size: 11px; color: rgba(255,255,255,0.3); margin-bottom: 10px; }
  .round-pts { font-family: 'Barlow Condensed', sans-serif; font-size: 34px; font-weight: 800; color: #fff; line-height: 1; }
  .round-pts span { font-size: 14px; font-weight: 400; color: rgba(255,255,255,0.3); }
  .round-bonus { font-size: 11px; color: #f97316; margin-top: 4px; font-weight: 600; }
  .lock-toggle { padding: 4px 10px; border-radius: 4px; font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; border: none; cursor: pointer; transition: all 0.2s; }
  .lock-toggle.unlocked { background: rgba(248,113,113,0.15); color: #f87171; }
  .lock-toggle.locked-btn { background: rgba(110,232,122,0.15); color: #6ee87a; }
  .blast-btn { width: 100%; padding: 11px; border-radius: 7px; background: rgba(249,115,22,0.15); border: 1px solid rgba(249,115,22,0.4); color: #f97316; font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
  .blast-btn:hover { background: rgba(249,115,22,0.25); }
  .toast { position: fixed; bottom: 80px; right: 16px; z-index: 9999; background: rgba(110,232,122,0.95); color: #000; padding: 10px 16px; border-radius: 8px; font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
  .toast-error { background: rgba(248,113,113,0.95); color: #fff; }
  @media (min-width: 700px) {
    .page { padding: 24px 20px; }
    .page-title { font-size: 34px; }
    .bottom-nav { max-width: 700px; left: 50%; transform: translateX(-50%); border-radius: 16px 16px 0 0; border-left: 1px solid rgba(255,255,255,0.08); border-right: 1px solid rgba(255,255,255,0.08); }
  }
`

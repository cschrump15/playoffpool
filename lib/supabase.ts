import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Service role client for server-side grading operations (never expose to client)
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ---------------------------------------------------------------------------
// Types mirroring Supabase tables
// ---------------------------------------------------------------------------
export interface DBPlayer {
  id: string
  name: string
  pin: string
  created_at: string
}

export interface DBGame {
  id: string
  region: string
  round: number
  game_number: number
  team1_name: string
  team1_seed: number
  team2_name: string
  team2_seed: number
  is_play_in: boolean
  winner: 1 | 2 | null
  margin: number | null
  created_at: string
  updated_at: string
}

export interface DBPick {
  id: string
  player_id: string
  game_id: string
  picked_team: 1 | 2
  picked_band_index: number
  points_earned: number | null
  created_at: string
  updated_at: string
}

export interface LeaderboardRow {
  player_id: string
  name: string
  total_points: number
  correct_picks: number
  graded_picks: number
  total_picks: number
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export async function getPlayers(): Promise<DBPlayer[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function getPlayerByPin(pin: string): Promise<DBPlayer | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('pin', pin)
    .single()
  if (error) return null
  return data
}

export async function getGames(round?: number): Promise<DBGame[]> {
  let query = supabase.from('games').select('*').order('game_number')
  if (round !== undefined) query = query.eq('round', round)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getGameById(id: string): Promise<DBGame | null> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function getPicksByPlayer(playerId: string): Promise<DBPick[]> {
  const { data, error } = await supabase
    .from('picks')
    .select('*')
    .eq('player_id', playerId)
  if (error) throw error
  return data ?? []
}

export async function getPicksForGame(gameId: string): Promise<DBPick[]> {
  const { data, error } = await supabase
    .from('picks')
    .select('*, players(name)')
    .eq('game_id', gameId)
  if (error) throw error
  return data ?? []
}

export async function upsertPick(
  playerId: string,
  gameId: string,
  pickedTeam: 1 | 2,
  pickedBandIndex: number
): Promise<DBPick> {
  const { data, error } = await supabase
    .from('picks')
    .upsert(
      {
        player_id: playerId,
        game_id: gameId,
        picked_team: pickedTeam,
        picked_band_index: pickedBandIndex,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_id,game_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
  if (error) throw error
  return data ?? []
}

// ---------------------------------------------------------------------------
// Admin: grade a game (server-side only, uses service role)
// ---------------------------------------------------------------------------
export async function gradeGame(
  gameId: string,
  winner: 1 | 2,
  margin: number
): Promise<void> {
  const { calculatePoints } = await import('./bracketData')
  const client = getServiceClient()

  // Update game result
  const { error: gameError } = await client
    .from('games')
    .update({ winner, margin, updated_at: new Date().toISOString() })
    .eq('id', gameId)
  if (gameError) throw gameError

  // Get game to know the round
  const { data: game } = await client.from('games').select('round').eq('id', gameId).single()
  if (!game) throw new Error('Game not found')

  // Grade all picks for this game
  const { data: picks } = await client.from('picks').select('*').eq('game_id', gameId)
  if (!picks) return

  for (const pick of picks) {
    const points = calculatePoints(
      game.round,
      pick.picked_team as 1 | 2,
      pick.picked_band_index,
      winner,
      margin
    )
    await client
      .from('picks')
      .update({ points_earned: points, updated_at: new Date().toISOString() })
      .eq('id', pick.id)
  }
}

import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from './supabase'
import { ThemeToggle } from './ui/ThemeToggle'

interface Props {
  onBack: () => void
  onOpen: (id: string) => void
}

interface TournamentRow {
  id: string
  name: string
  city: string | null
  category: string
  format: string
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

export function TournamentsScreen({ onBack, onOpen }: Props) {
  const [rows, setRows] = useState<TournamentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('OPEN')
  const [format, setFormat] = useState('league')
  const [overs, setOvers] = useState(20)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: err } = await getSupabase()
        .from('tournaments')
        .select('id,name,city,category,format,status,start_date,end_date,created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (err) throw err
      setRows((data ?? []) as TournamentRow[])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tournaments (run schema.tournaments.sql?)')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function create(): Promise<void> {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const { data: userData } = await getSupabase().auth.getUser()
      const { data, error: err } = await getSupabase().from('tournaments').insert({
        name: name.trim(),
        city: city.trim() || null,
        category,
        format,
        overs_per_innings: overs,
        match_type: overs <= 10 ? 'T10' : overs <= 20 ? 'T20' : 'ODI',
        status: 'draft',
        organizer_user_id: userData.user?.id ?? null,
      }).select('id').single()
      if (err) throw err
      setName('')
      await load()
      if (data?.id) onOpen((data as { id: string }).id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create tournament (is schema applied?)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Tournaments</h1>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={() => void load()}>Refresh</button>
          <button className="btn ghost" onClick={onBack}>Back</button>
          <ThemeToggle />
        </div>
      </header>
      <main className="card setup-card">
        {error && <div className="banner warn">{error}</div>}
        <section className="standings-section">
          <h3>Create tournament</h3>
          <div className="field-row">
            <label>Name<input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Premier League" /></label>
            <label>City<input value={city} onChange={(e)=>setCity(e.target.value)} placeholder="Ahmedabad" /></label>
          </div>
          <div className="field-row">
            <label>Category
              <select value={category} onChange={(e)=>setCategory(e.target.value)}>
                {['OPEN','CORPORATE','COMMUNITY','SCHOOL','COLLEGE','UNIVERSITY','SERIES','OTHER'].map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Format
              <select value={format} onChange={(e)=>setFormat(e.target.value)}>
                {['league','knockout','group_knockout','round_robin'].map(f=> <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label>Overs<input type="number" min={1} max={50} value={overs} onChange={(e)=>setOvers(Number(e.target.value)||20)} /></label>
          </div>
          <button className="btn accent" type="button" onClick={() => void create()} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create'}
          </button>
        </section>

        <section className="standings-section">
          <h3>Tournaments ({rows.length})</h3>
          {loading && <p className="muted">Loading…</p>}
          {!loading && rows.length === 0 && !error && <p className="muted">No tournaments yet.</p>}
          <div className="board-list">
            {rows.map(r => (
              <button key={r.id} className="card match-card animate" type="button" onClick={()=>onOpen(r.id)}>
                <span className="match-teams">{r.name}</span>
                <span className="muted">{r.city ?? '—'} · {r.format} · {r.status}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

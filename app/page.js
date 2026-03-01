import PlayoffPool from '../components/PlayoffPool'

export default function Home() {
  return <PlayoffPool />
}
```

Commit it.

---

**File 5** — Name it: `.env.local`

For this one you need two values from Supabase:
1. Go to your **Supabase dashboard**
2. Click **Settings** (gear icon) → **API**
3. Copy the **Project URL** and the **anon public** key

Then create the file with:
```
NEXT_PUBLIC_SUPABASE_URL=paste_your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste_your_anon_key_here

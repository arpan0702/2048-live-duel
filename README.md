# 2048 Live Duel (Endless 4×4 Mode)

A cross-platform, real-time multiplayer version of 2048 built on a classic $4 \times 4$ grid with no artificial win triggers. Reaching the 2048 tile does not trigger a victory screen; players continue merging toward the maximum mathematical limits of the grid ($131,072$).

🎮 **Play Live Now**: [https://arpan0702.github.io/2048-live-duel/](https://arpan0702.github.io/2048-live-duel/)  
📦 **Repository**: [https://github.com/arpan0702/2048-live-duel](https://github.com/arpan0702/2048-live-duel)

---

## Key Features

1. **Endless $4 \times 4$ Engine with BigInt Precision**:
   - Tiles merge continuously past 2048: 4096, 8192, 16384, 32768, 65536, up to the physical limit of $131,072$.
   - Compact formatting for tiles $\ge 16384$ (`16K`, `32K`, `64K`, `128K`) with auto-scaled typography to prevent UI clipping.
   - Native JavaScript `BigInt` calculations to prevent numeric overflow.

2. **Realtime Multiplayer Duel Formats**:
   - **Sudden Death**: Continuous play. When Player A locks out, Player A's score freezes and Player B enters a **60-second grace countdown** to surpass Player A's score or lock out. Highest score wins!
   - **Blitz Mode**: 3-minute or 5-minute timed duels. Merges continue endlessly; highest score when time expires wins.
   - **Solo Practice**: Warm up on the endless 4x4 board.

3. **Zero-Setup Local Multiplayer Testing**:
   - Out of the box, the duel engine features a **Dual-Mode Network Provider**:
     - **Local Multi-Tab Mode** (default): Uses browser `BroadcastChannel` and cross-tab storage. Click **"⚡ Test Locally: Open Player 2 Window"** in the waiting room to launch a split-screen challenger tab instantly!
     - **Supabase Cloud Mode**: Connect to Supabase by adding `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`.

4. **Frictionless Identity & Hall of Fame Leaderboard**:
   - No passwords or Google Auth required. Users choose a handle stored alongside an anonymous UUID session key in `localStorage` or Capacitor `Preferences`.
   - Global Hall of Fame tracks `all_time_high_score` and `highest_tile_achieved`.

5. **Native Mobile Shell (Android Capacitor)**:
   - `touch-action: none` binds to the grid to disable default browser scroll, pinch-to-zoom, and Android pull-to-refresh.
   - Android hardware Back button integration prompts an "Abandon Match?" confirmation modal.
   - 15-second background grace window before marking disconnects.

---

## Quick Start (Local Development)

```bash
# Navigate to project directory
cd /Users/arpandutta/.gemini/antigravity/scratch/2048-live-duel

# Install dependencies (already installed)
npm install

# Run automated tests
npm test

# Launch Vite dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## How to Test Multiplayer Locally

1. Open `http://localhost:5173` in Browser Window 1.
2. Enter your username (e.g. `MatrixMaster`) and select **Sudden Death**.
3. Click **"Create Match Room"**. You will receive a 6-character room code (e.g. `#DUEL42`).
4. Click **"⚡ Test Locally: Open Player 2 Window"** (or open a new window and join with `#DUEL42`).
5. Window 2 joins as Player 2, and the duel starts immediately!
6. Make moves using Touch swipe or Arrow keys / WASD.
7. Observe live score, lead indicator (`+X Lead` / `-Y Behind`), and highest tile badge synchronized between both screens.
8. When one player locks out, observe the 60-second Sudden Death grace timer trigger on the opponent's screen!

---

## Supabase Cloud Setup (Optional)

To connect to a live Supabase project:
1. Run the SQL statements in [`supabase/schema.sql`](supabase/schema.sql) in your Supabase SQL Editor.
2. Create `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
3. Restart the dev server (`npm run dev`).

---

## Building Native Android App (Capacitor)

```bash
# Build the production bundle
npm run build

# Add Android platform (if not already added)
npx cap add android

# Sync web assets to native Android project
npx cap sync

# Open in Android Studio to build APK / AAB
npx cap open android
```

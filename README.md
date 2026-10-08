# 🂡 Rummy Royale

Indian Rummy in the browser, built with **React**, **Vite**, **Tailwind CSS** and **Motion**. Play against 1–3 bots at a casino-style table.

- 🃏 Hand-drawn SVG playing cards, felt table, and animated dealing, drawing and discarding
- 🔊 Real card sounds (shuffle, slide, place) plus chimes for your turn, the timer and wins; mute anytime
- 🧩 Group your hand into melds, with live labels (pure sequence, sequence, set) and progress chips
- ✨ Auto-arrange finds your best melds; Hint suggests what to draw or discard
- 🎓 A short illustrated tutorial on first visit (and from the ? button)

Everything runs in the browser. There is no server, so it is hosted for free on GitHub Pages.

**Play:** https://pavankumar-dss.github.io/Rummy-Royale/

---

## 🚀 Run locally

Requires **Node.js 20.19+**.

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

| Command | What it does |
|---|---|
| `npm test` | Runs the game-logic tests (rules, engine, full bot games) |
| `npm run lint` | ESLint |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the production build locally |

## 🌐 Deploying

Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes the site to GitHub Pages.

One-time setup: in the GitHub repo go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

---

## 📜 Rules

- Each player gets **13 cards**. One card is turned face up as the **wildcard**, and every card of that rank is wild. If that card is a printed joker, aces are wild.
- On your turn, **draw** one card (from the deck or the top of the discard pile), then **discard** one. You can't throw back a card you just picked from the discard pile.
- **Sets**: 3 or 4 cards of the same rank in different suits, e.g. 7♠ 7♥ 7♣.
- **Sequences**: 3 or more cards of the same suit in a row, e.g. 10♥ J♥ Q♥. An ace can be low (A-2-3) or high (Q-K-A), but sequences don't wrap (K-A-2).
- **Pure sequence**: a sequence with no joker or wild card standing in for a missing card.
- Printed jokers and wildcard-rank cards (marked **WILD**) can stand in for any card in sets and impure sequences.
- **To win**: after drawing, press **Declare**. Your 13 cards must form valid sets and sequences, with **at least 2 sequences, at least 1 of them pure**. Card order doesn't matter, and the leftover 14th card is discarded for you.
- With the turn timer on, running out of time before drawing skips your turn. Running out after drawing discards the card you drew.

## 🗂️ Code layout

```
src/
  game/             Pure game logic. No React, fully unit-tested.
    cards.js        Deck, shuffling, sorting, card helpers
    melds.js        Meld classification and the hand solver (declaration check)
    engine.js       Game state, actions (draw/discard/declare/reorder/timeout), per-player views
    bot.js          Bot strategy (sees only its own player view)
    groups.js       How the player has grouped their hand (labels, auto-arrange)
  audio/sounds.js   Web Audio: card samples plus synthesized chimes, mute setting
  components/       React UI (Lobby, GameTable, Hand, Seat, Piles, Card, GameOver, Tutorial)
  App.jsx           Wires the engine to the UI: event sounds, bot pacing, timer, hints
public/sounds/      Card sound effects
```

The engine is a pure `applyAction(state, playerId, action)` function, and players only ever receive `getPlayerView(state, playerId)`. That keeps the door open for peer-to-peer multiplayer later: the host's browser would run the engine and send each player only their own view.

## 🙏 Credits

Card sound effects from [Casino Audio](https://kenney.nl/assets/casino-audio) by Kenney (CC0, public domain).

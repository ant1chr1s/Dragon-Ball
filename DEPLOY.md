# Rangliste einrichten (Cloudflare Worker)

Die App selbst läuft sofort über GitHub Pages. Für die geteilte Rangliste
(Tages-Bestenliste + Endlos-Bestenliste) brauchst du einmalig einen kleinen
Cloudflare Worker — genau wie beim Mistral-Proxy von animemaker.

## 1. Worker anlegen

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Worker**
2. Name z.B. `scouter-guess`
3. Inhalt von `worker.js` (in diesem Repo) reinkopieren, **Deploy** klicken

## 2. Secrets & Variablen setzen

Im Worker unter **Settings → Variables and Secrets**:

| Name | Typ | Wert |
|---|---|---|
| `GITHUB_TOKEN` | Secret | Fine-grained PAT mit **Contents: Read & write** nur für das Repo `ant1chr1s/Dragon-Ball` |
| `GITHUB_OWNER` | Variable | `ant1chr1s` |
| `GITHUB_REPO` | Variable | `Dragon-Ball` |
| `ALLOWED_ORIGIN` | Variable | `https://ant1chr1s.github.io` |

**Wichtig:** Erstelle dafür einen eigenen, neuen PAT (nicht den, der schon
einmal im Chat stand — den bitte in jedem Fall widerrufen). Beschränke ihn
per Fine-Grained-Token ausschließlich auf das Repo `Dragon-Ball` mit der
Berechtigung "Contents: Read and write". Dieser Token bleibt ausschließlich
im Worker gespeichert und wird nie an den Browser ausgeliefert.

## 3. Worker-URL in die App eintragen

Nach dem Deploy zeigt Cloudflare dir eine URL wie:
`https://scouter-guess.DEIN-SUBDOMAIN.workers.dev`

Trage sie in `index.html` ein:

```js
const WORKER_URL = "https://scouter-guess.DEIN-SUBDOMAIN.workers.dev";
```

Datei committen/pushen — fertig. Die Rangliste liest/schreibt jetzt live
über den Worker in `data/leaderboard-daily.json` und
`data/leaderboard-endless.json` in diesem Repo.

## Ohne Worker

Ohne eingetragene `WORKER_URL` funktioniert das Spiel trotzdem ganz normal
(täglicher Charakter, Endlos-Modus, persönliche Bestwerte lokal im Browser)
— nur die geteilte Rangliste zeigt dann einen Hinweis, dass der Server noch
nicht eingerichtet ist.

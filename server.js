"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

// ponytail: data dir pinned to an absolute path OUTSIDE any deploy dir so
// redeploys/respawns don't wipe it. Override with PIANO_DATA_DIR in the panel env.
// No silent fallback into the app dir — that dir gets replaced on every redeploy,
// which is exactly how the library got wiped before. Fail loud if unwritable.
const DATA = process.env.PIANO_DATA_DIR || path.join(require("os").homedir(), "piano-data");
fs.mkdirSync(DATA, { recursive: true });
const FILE = path.join(DATA, "songs.json");
const load = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } };

app.get("/api/songs", (req, res) => res.json(load()));

app.post("/api/songs", (req, res) => {
  const { title, bpm, notes } = req.body || {};
  const ok = typeof title === "string" && title.trim() && title.length <= 100 &&
    Number.isFinite(bpm) && bpm >= 40 && bpm <= 180 &&
    Array.isArray(notes) && notes.length && notes.length <= 5000 &&
    notes.every(n => n && Number.isInteger(n.midi) && n.midi >= 0 && n.midi <= 127 &&
      Number.isFinite(n.start) && n.start >= 0 && Number.isFinite(n.dur) && n.dur > 0 && n.dur <= 64);
  if (!ok) return res.status(400).json({ error: "invalid song" });
  const songs = load();
  const existing = songs.find(s => s.title === title.trim());
  if (existing) return res.json(existing); // same file uploaded twice — idempotent
  if (songs.length >= 200) return res.status(507).json({ error: "library full" });
  const song = { title: title.trim(), emoji: "🎵", bpm: Math.round(bpm), notes, custom: true };
  songs.push(song);
  try { fs.writeFileSync(FILE, JSON.stringify(songs)); }
  catch { return res.status(500).json({ error: "save failed" }); }
  res.json(song);
});
// ponytail: no delete endpoint and no auth — anyone can add, nobody can remove.
// Add an admin token + DELETE route if junk uploads become a problem.

app.listen(process.env.PORT || 3000, () => console.log("midipiano server up"));

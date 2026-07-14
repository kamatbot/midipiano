"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

// ponytail: data dir sits outside the app dir so redeploys don't wipe it;
// falls back to the app dir if the parent isn't writable
let DATA = path.join(__dirname, "..", "piano-data");
try { fs.mkdirSync(DATA, { recursive: true }); }
catch { DATA = __dirname; }
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
  fs.writeFileSync(FILE, JSON.stringify(songs));
  res.json(song);
});
// ponytail: no delete endpoint and no auth — anyone can add, nobody can remove.
// Add an admin token + DELETE route if junk uploads become a problem.

app.listen(process.env.PORT || 3000, () => console.log("midipiano server up"));

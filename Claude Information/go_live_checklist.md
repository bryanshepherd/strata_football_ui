
# Go Live Checklist — Scoring App Consistency & End-to-End Validation

This checklist ensures everything works after recent patches and documentation updates.

---

## 1. Environment Sanity
- [ ] `DEPRECATE_JSON_STORAGE=0` (off except during canary)
- [ ] `SCORING_STRICTNESS` set to `assisted` (or desired mode)
- [ ] Penalty table loads (no red "table not loaded" banner)
- [ ] DB migrations applied (games can be created/listed)

---

## 2. Backend Contract Smoke Tests
Run with `curl` (adjust host/paths as needed):

```bash
# Health
curl -sS http://localhost:8000/api/health | jq .

# Create Game
curl -sS -H "Content-Type: application/json" -d '{"home":"H","visitor":"V"}' http://localhost:8000/api/create_game | jq .

# Submit Rush Play
curl -sS -H "Content-Type: application/json" -d '{"period":1,"time_remaining":900,"possession":"H","play_type":"rush","start_yard_line":"H35","end_yard_line":"H33","yards":2,"distance":10}' http://localhost:8000/api/submit_play | jq .

# Touchdown
curl -sS -H "Content-Type: application/json" -d '{"period":1,"time_remaining":750,"possession":"H","play_type":"rush","start_yard_line":"V05","end_yard_line":"V00","yards":5,"distance":2}' http://localhost:8000/api/submit_play | jq .

# Safety
curl -sS -H "Content-Type: application/json" -d '{"period":1,"time_remaining":700,"possession":"H","play_type":"rush","start_yard_line":"H02","end_yard_line":"H00","yards":-2,"distance":10}' http://localhost:8000/api/submit_play | jq .
```

Expected: 200 OK with normalized response body, DB rows updated.

---

## 3. Frontend E2E Smokes
- [ ] Rush: +2 yards from H35 updates play log (no errors)
- [ ] Touchdown → PAT → Kickoff works in sequence
- [ ] Safety recognized at 00 yardline, new drive starts
- [ ] DevTools → Network payloads contain **only allowlisted keys**
- [ ] No `tertiaryPlayerID`, `playContext`, or `newContext` in payloads

---

## 4. Multi-User Lock Tests
- [ ] Window A locks game, Window B blocked
- [ ] Lock transfers correctly within 30s
- [ ] Race submit: only lock holder succeeds

---

## 5. Logs & Telemetry
- [ ] Backend logs show no unexpected 4xx/5xx
- [ ] No `LEGACY_JSON_HIT` lines (with fence off)
- [ ] Frontend console: no red errors during scoring session

---

## 6. Consistency Fixes
- [ ] Clock normalization (`clock` ⇄ `time_remaining`)
- [ ] Possession normalization (`home|visitor` ⇄ `H|V`)
- [ ] Distance mapping (`yardsToGo` ⇄ `distance`)
- [ ] Enum/code aliases mapped/documented

---

## 7. Canary (Optional, Prod/Stage)
- [ ] Turn on `DEPRECATE_JSON_STORAGE=1` for 24–48h
- [ ] Monitor logs for `LEGACY_JSON_HIT`
- [ ] If clean, delete legacy endpoints

---

## 8. Final Go/No-Go Gate
- [ ] All manual smokes pass
- [ ] 10-minute scoring session = no console errors
- [ ] Payloads align with field matrix
- [ ] No `LEGACY_JSON_HIT` or bad logs in last 24h
- [ ] QA signs off on TD/PAT/KO and Safety sequences

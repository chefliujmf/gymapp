#!/usr/bin/env python3
"""Publish the readapted June 22-28 week to Platyplus (single source of truth).

Platyplus fans out to intervals.icu -> Wahoo itself, so the coach writes only here.
Coach API: POST /api/plan with `Authorization: Bearer <token>` (per-user token from
Platyplus Profile -> Account). Schema mirrors gymapp/server/server.js validatePlan:

  ride/run: { id, date(YYYY-MM-DD), sport, title, notes, ftp, segments:[{duration,
             powerStart, powerEnd, label}] }   # power values are %FTP
  gym:      { id, date, sport:'gym', title, notes, rounds, exercises:[{name, mode,
             sets, reps, seconds}] }

Usage:
  PLATYPLUS_TOKEN=xxxx python3 tools/publish_platyplus_plan.py --dry-run   # show payloads, POST nothing
  PLATYPLUS_TOKEN=xxxx python3 tools/publish_platyplus_plan.py             # publish for real
  PLATYPLUS_TOKEN=xxxx python3 tools/publish_platyplus_plan.py --prune     # also delete stale plans in range
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("PLATYPLUS_BASE", "https://platyplus.duckdns.org")
FTP = 260
RANGE_FROM, RANGE_TO = "2026-06-22", "2026-06-28"

PLANS = [
    {
        "id": "monday_strength_upper_trunk_2026-06-22",
        "date": "2026-06-22", "sport": "gym",
        "title": "Upper-Body & Trunk Strength",
        "rounds": 1,
        "exercises": [
            {"name": "Dumbbell bench press (or machine chest press)", "mode": "reps", "sets": 3, "reps": "6-10"},
            {"name": "Lat pulldown (or assisted pull-up)", "mode": "reps", "sets": 3, "reps": "8-10"},
            {"name": "Chest-supported row", "mode": "reps", "sets": 3, "reps": "10"},
            {"name": "Seated shoulder press", "mode": "reps", "sets": 2, "reps": "8-10"},
            {"name": "Pallof press (both sides)", "mode": "reps", "sets": 2, "reps": "10/side"},
            {"name": "Dead bug + side plank", "mode": "reps", "sets": 2, "reps": "8/side + 30s"},
        ],
        "notes": ("Re-entry week strength dose. Back-sparing: no loaded hinge, no spinal "
                  "compression after the weekend digging. Upper body RPE 6-7 (1-2 in reserve), "
                  "trunk controlled and supported. Legs untouched for Tue/Wed. ~60 min."),
    },
    {
        "id": "tuesday_endurance_rebuild_2026-06-23",
        "date": "2026-06-23", "sport": "ride", "ftp": FTP,
        "title": "Tuesday Endurance Rebuild",
        "segments": [
            {"duration": 600, "powerStart": 50, "powerEnd": 62, "label": "Warm-up ramp"},
            {"duration": 3600, "powerStart": 64, "powerEnd": 64, "label": "Steady endurance 58-70% (ride the band by feel)"},
            {"duration": 600, "powerStart": 58, "powerEnd": 48, "label": "Cool-down"},
        ],
        "notes": ("First ride back after the disrupted, manual-labor weekend. Steady aerobic, "
                  "conversational, no tempo. Check the back early. Extend to 90 min if it feels "
                  "good; cut to 60 if the back complains."),
    },
    {
        "id": "wednesday_sweet_spot_durability_2026-06-24",
        "date": "2026-06-24", "sport": "ride", "ftp": FTP,
        "title": "Wednesday Sweet Spot Durability",
        "segments": [
            {"duration": 900, "powerStart": 50, "powerEnd": 78, "label": "Progressive warm-up"},
            {"duration": 720, "powerStart": 90, "powerEnd": 90, "label": "Sweet spot block 1 (88-92%)"},
            {"duration": 240, "powerStart": 55, "powerEnd": 55, "label": "Easy spin"},
            {"duration": 720, "powerStart": 90, "powerEnd": 90, "label": "Sweet spot block 2 (88-92%)"},
            {"duration": 240, "powerStart": 55, "powerEnd": 55, "label": "Easy spin"},
            {"duration": 720, "powerStart": 90, "powerEnd": 90, "label": "Sweet spot block 3 (88-92%)"},
            {"duration": 900, "powerStart": 63, "powerEnd": 63, "label": "Endurance extension"},
            {"duration": 600, "powerStart": 50, "powerEnd": 50, "label": "Cool-down"},
        ],
        "notes": ("The week's one quality stimulus - readiness-gated. 3x12 min at 88-92% FTP "
                  "(~229-239 W), 4 min easy between, third block as clean as the first. Strict "
                  "cap, not a test. Ride straight endurance instead if back/legs/sleep are off."),
    },
    {
        "id": "friday_ride_to_skov_2026-06-26",
        "date": "2026-06-26", "sport": "ride", "ftp": FTP,
        "title": "Friday Ride to Skov",
        "segments": [
            {"duration": 900, "powerStart": 50, "powerEnd": 60, "label": "Roll out of St-Lambert"},
            {"duration": 16200, "powerStart": 63, "powerEnd": 63, "label": "Long aerobic to Skov 56-70% - cap every climb, fuel 60-90g/h"},
            {"duration": 900, "powerStart": 52, "powerEnd": 52, "label": "Spin into Austin"},
        ],
        "notes": ("120-140 km point-to-point, 66 Croissant de Navarre (St-Lambert) -> 39 rue des "
                  "Chenes (Skov, Austin). WEATHER-GATED: if conditions are bad, drive and ride local "
                  "or rest. Fully aerobic ~4.5-5.5 h, strict climb caps through the Townships, fuel "
                  "from the first 30 min. Shorten the route or drive the final leg if the back or legs "
                  "are done - this is endurance, not a sufferfest."),
    },
    {
        "id": "saturday_cottage_recovery_2026-06-27",
        "date": "2026-06-27", "sport": "ride", "ftp": FTP,
        "title": "Saturday Recovery Spin at Skov",
        "segments": [
            {"duration": 600, "powerStart": 48, "powerEnd": 55, "label": "Easy roll-out"},
            {"duration": 2400, "powerStart": 56, "powerEnd": 56, "label": "Easy recovery spin 50-62%"},
            {"duration": 600, "powerStart": 50, "powerEnd": 50, "label": "Roll home"},
        ],
        "notes": ("Recovery flush after the long ride, or full rest by feel. <=60 min very easy, "
                  "low force, no climbs pushed. Skip and rest if Friday's legs/back say so."),
    },
    {
        "id": "sunday_cottage_endurance_optional_2026-06-28",
        "date": "2026-06-28", "sport": "ride", "ftp": FTP,
        "title": "Sunday Endurance at Skov (optional)",
        "segments": [
            {"duration": 600, "powerStart": 50, "powerEnd": 60, "label": "Easy start - read the legs"},
            {"duration": 3600, "powerStart": 62, "powerEnd": 62, "label": "Optional easy endurance 56-68%"},
            {"duration": 600, "powerStart": 50, "powerEnd": 50, "label": "Spin home"},
        ],
        "notes": ("OPTIONAL, non-debt. <=90 min easy endurance at Skov, gravel or road, by feel. "
                  "Cap the climbs. Skip with zero guilt if the legs/back are not fully recovered - "
                  "it creates no debt. (Thursday Jun 25 = rest: Vooban interview + babysitting.)"),
    },
]


def req(method, path, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Authorization", "Bearer " + token)
    r.add_header("Content-Type", "application/json")
    r.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:300]}
    except urllib.error.URLError as e:
        return 0, {"error": str(e)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print payloads, POST nothing")
    ap.add_argument("--prune", action="store_true", help="delete plans in range whose id is not in this set")
    ap.add_argument("--token", default=os.environ.get("PLATYPLUS_TOKEN", ""))
    args = ap.parse_args()

    if args.dry_run:
        print(f"DRY RUN - {len(PLANS)} plans for {RANGE_FROM}..{RANGE_TO} (no requests sent)\n")
        for p in PLANS:
            secs = sum(s.get("duration", 0) for s in p.get("segments", []))
            extra = f"  (~{secs//60} min)" if secs else ""
            print(f"  {p['date']}  {p['sport']:4}  {p['title']}{extra}")
        print("\nFull payloads:\n" + json.dumps(PLANS, indent=2))
        return

    if not args.token:
        sys.exit("No token. Set PLATYPLUS_TOKEN=... or pass --token (Platyplus Profile -> Account).")

    if args.prune:
        st, existing = req("GET", f"/api/plans?from={RANGE_FROM}&to={RANGE_TO}", args.token)
        if st == 200 and isinstance(existing, list):
            keep = {p["id"] for p in PLANS}
            for e in existing:
                if e.get("id") not in keep:
                    dst, _ = req("DELETE", f"/api/plan/{e['id']}", args.token)
                    print(f"  prune {e.get('date')} {e.get('title')!r} -> {dst}")
        else:
            print(f"  (prune skipped: GET /api/plans -> {st} {existing})")

    ok = 0
    for p in PLANS:
        st, resp = req("POST", "/api/plan", args.token, p)
        icu = resp.get("icu") if isinstance(resp, dict) else None
        print(f"  {p['date']}  {p['title']:38}  HTTP {st}  icu={icu}")
        if st in (200, 201):
            ok += 1
        else:
            print(f"      -> {resp}")
    print(f"\n{ok}/{len(PLANS)} published.")


if __name__ == "__main__":
    main()

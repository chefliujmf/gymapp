#!/usr/bin/env python3
# #769 (JM "test like crazy") — INTERACTION-GUARDS battery. Exercises the real things a user asks the coach to do to
# their plan, and asserts the CODE-ENFORCED guards respond correctly (the class of bug behind #765). Runs on QA against
# a sim persona via the bearer API. Every guard here is deterministic + fast — no LLM. Run from the XPS box:
#   python3 interaction-guards-test.py            (defaults to sim-strength on :8089)
# It cleans up its own test plans/dates. Exit 0 = all pass.
import json, urllib.request, sys

BASE = "http://localhost:8089"
TOKEN = sys.argv[1] if len(sys.argv) > 1 else "simtok-strength"
# a block of clear future dates well past any real plan
D = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"]  # Mon..Sun


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=12)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 0, str(e)


def ride(date, id_, title="Endurance Ride", pinned=None, hard=False):
    segs = ([{"label": "Threshold", "duration": 2400, "powerStart": 95, "powerEnd": 95}] if hard
            else [{"label": "Endurance", "duration": 1800, "powerStart": 60, "powerEnd": 60}])
    b = {"id": id_, "date": date, "sport": "ride", "title": title, "segments": segs}
    if pinned is not None:
        b["pinned"] = pinned
    return b


def gym(date, id_, heavy=True):
    reps, w = (4, 100) if heavy else (12, 40)
    return {"id": id_, "date": date, "sport": "gym", "title": "Strength", "rounds": 1,
            "exercises": [
                {"name": "Leg Swings", "section": "warmup", "mode": "timed", "seconds": 30},
                {"name": "Barbell Back Squat", "section": "main", "mode": "reps", "reps": reps, "sets": 4, "weight": w},
                {"name": "Cat Cow", "section": "cooldown", "mode": "timed", "seconds": 30},
            ]}


PASS, FAIL = 0, 0


def check(name, got, want):
    global PASS, FAIL
    ok = got == want
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}: got {got}, want {want}")
    PASS += ok
    FAIL += not ok


def cleanup():
    for d in D:
        call("POST", "/api/rest-day", {"date": d, "rest": False})
    for i in ("g_move", "g_move2", "g_cap1", "g_cap2", "g_rest", "g_conc_ride", "g_conc_gym", "g_wk1", "g_wk2", "g_wk3", "g_wk4", "g_wk5", "g_wk6"):
        call("DELETE", "/api/plan/" + i)


cleanup()
print("=== 1) MULTIPLE WORKOUTS: a 2nd SAME-SPORT session COMBINES (no stack, #431); a different-sport one hits the cap ===")
call("POST", "/api/plan", ride(D[0], "g_cap1", "First Ride"))
s, _ = call("POST", "/api/plan", ride(D[0], "g_cap2", "Second Ride"))  # 2nd ride same day, new id -> re-plan, reuses slot
check("2nd same-sport ride -> combined (2xx)", s < 400, True)
# verify it did NOT stack two rides on the day
sc, body = call("GET", f"/api/plans?from={D[0]}&to={D[0]}")
rides = [p for p in (json.loads(body) if sc < 400 else []) if p.get("sport") == "ride"]
check("day D[0] has exactly ONE ride (no stack)", len(rides), 1)
# a DIFFERENT-sport 2nd session on the same day, past max-per-day (default 1), is rejected
s, _ = call("POST", "/api/plan", gym(D[0], "g_cap2", heavy=False))
check("different-sport 2nd on a full day -> 409", s, 409)

print("=== 2) REST-DAY onto a PINNED session is rejected (non-pinned would clear) ===")
call("POST", "/api/plan", ride(D[1], "g_rest", "Pinned Ride", pinned=True))
s, _ = call("POST", "/api/rest-day", {"date": D[1], "rest": True})
check("rest-day over pinned -> 409", s, 409)

print("=== 3) PIN: coach cannot MOVE / DELETE a pinned session ===")
call("POST", "/api/plan", ride(D[2], "g_move", "Pinned Move Test", pinned=True))
s, _ = call("POST", "/api/plan", ride(D[3], "g_move", "Pinned Move Test"))  # same id, new date = move
check("move pinned -> 409", s, 409)
s, _ = call("DELETE", "/api/plan/g_move")
check("delete pinned -> 409", s, 409)
# release the pin, THEN move succeeds
call("POST", "/api/plan", ride(D[2], "g_move", "Pinned Move Test", pinned=False))
s, _ = call("POST", "/api/plan", ride(D[3], "g_move", "Pinned Move Test"))
check("move after pin release -> 2xx", s < 400, True)

print("=== 4) CONCURRENT INTERFERENCE: heavy gym within a day of a quality ride is rejected ===")
call("POST", "/api/plan", ride(D[4], "g_conc_ride", "Threshold 4x10", hard=True))  # quality endurance
s, _ = call("POST", "/api/plan", gym(D[5], "g_conc_gym", heavy=True))  # heavy gym next day
check("heavy gym adjacent to quality ride -> 409", s, 409)

print("=== 5) WEEKLY TRAINING-DAYS CAP: filling distinct days in one week eventually 409s at the cap ===")
cleanup()  # clean the whole test week first so this is deterministic (persona trainingDays sets where it fires)
r_status = []
for i, d in enumerate([D[0], D[1], D[2], D[3], D[4], D[5]]):
    s, _ = call("POST", "/api/plan", ride(d, f"g_wk{i+1}", f"Day {i+1}"))
    r_status.append(s)
capped_at = next((i + 1 for i, s in enumerate(r_status) if s == 409), None)
if capped_at:
    check(f"training-days cap fired (at day {capped_at})", True, True)
else:
    print(f"  [INFO] no cap in 6 days -> statuses {r_status} (persona trainingDays >= 6 or unset — set it lower to assert)")

cleanup()
print(f"\n=== RESULT: {PASS} passed, {FAIL} failed ===")
sys.exit(1 if FAIL else 0)

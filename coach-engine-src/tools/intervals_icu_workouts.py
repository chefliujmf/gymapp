#!/usr/bin/env python3
"""Publish structured cycling workouts to Intervals.icu and read activity summaries back.

This tool keeps the implementation deliberately small:
- input workout specs are JSON files that mirror the repo's workout schema;
- planned workouts are published using native Intervals.icu workout text;
- activity readback uses the activities.csv export for stable summary parsing.
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any

from coach_env import load_local_env_files

API_BASE = "https://intervals.icu/api/v1"
DEFAULT_ATHLETE_ID = "0"
# Bike sports where Intervals.icu models training load from the structured
# power targets. Every other type (gym, run, etc.) must have any inherited load
# explicitly cleared so a reused calendar slot never keeps a stale ride's TSS.
POWER_LOAD_EVENT_TYPES = {"Ride", "VirtualRide"}


class IntervalsAPIError(RuntimeError):
    """Raised on Intervals.icu HTTP/network failures.

    Kept distinct from SystemExit so the request layer stays importable and
    testable; main() converts it to a clean CLI exit.
    """


class CoachInputError(RuntimeError):
    """Raised on bad user input / missing config (bad date, no API key, etc.).

    Like IntervalsAPIError, this keeps helpers and command handlers importable
    and testable: they raise it instead of calling SystemExit directly, and
    main() converts it to a clean CLI exit at the boundary.
    """


LOCAL_ENV_PATHS = (
    Path(".secrets/coach.env"),
    Path(".secrets/intervals.env"),
)
FEEDBACK_CUSTOM_FIELDS: list[dict[str, Any]] = [
    {
        "name": "Legs Before",
        "code": "LegsBefore",
        "options": ["fresh", "normal", "relaxed", "heavy", "sore", "flat", "tired"],
    },
    {
        "name": "Legs After",
        "code": "LegsAfter",
        "options": ["strong", "normal", "tired OK", "barely tired", "heavy", "sore", "cooked"],
    },
    {
        "name": "Fuel/GI",
        "code": "FuelGI",
        "options": ["not needed", "water only OK", "carbs OK", "underfueled", "GI issue", "too much fuel"],
    },
    {
        "name": "Pain/Niggles",
        "code": "PainNiggles",
        "options": ["none", "knee", "back", "neck/shoulder", "foot", "saddle", "other"],
    },
    {
        "name": "Life Constraint",
        "code": "LifeConstraint",
        "options": ["none", "time cap", "family", "work", "poor sleep", "stress", "weather", "other"],
    },
    {
        "name": "Mental State",
        "code": "MentalState",
        "options": ["calm", "focused", "impatient", "overexcited", "doubtful", "frustrated", "checked out"],
    },
]
COACH_TICK_VALUES = {
    "wtf": 1,
    "poor": 2,
    "seen": 3,
    "good": 4,
    "amazing": 5,
}


COACH_TICK_LABELS = {value: label for label, value in COACH_TICK_VALUES.items()}


def build_auth_header(api_key: str) -> str:
    token = base64.b64encode(f"API_KEY:{api_key}".encode()).decode("ascii")
    return f"Basic {token}"


def resolve_api_key(args: argparse.Namespace) -> str:
    """Resolve the API key from --api-key or the environment, or raise."""
    api_key = args.api_key or os.environ.get("INTERVALS_ICU_API_KEY")
    if not api_key:
        raise CoachInputError("Missing API key. Use --api-key or INTERVALS_ICU_API_KEY.")
    return api_key


def api_request(
    api_key: str,
    method: str,
    path: str,
    *,
    query: dict[str, Any] | None = None,
    json_body: Any | None = None,
    accept: str = "application/json",
) -> Any:
    url = f"{API_BASE}{path}"
    if query:
        clean_query = {k: v for k, v in query.items() if v is not None}
        url = f"{url}?{urllib.parse.urlencode(clean_query)}"

    data = None
    headers = {
        "Authorization": build_auth_header(api_key),
        "Accept": accept,
        "User-Agent": "curl/8.7.1",
    }
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise IntervalsAPIError(f"Intervals.icu API error {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise IntervalsAPIError(f"Intervals.icu network error: {exc}") from exc

    if accept == "text/csv":
        return raw.decode("utf-8-sig")
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def load_json(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def load_json_relative(base_path: str, spec_path: str) -> dict[str, Any]:
    base = Path(base_path).resolve().parent
    spec = Path(spec_path)
    if spec.is_absolute():
        target = spec
    else:
        candidate = (base / spec).resolve()
        if candidate.exists():
            target = candidate
        else:
            target = Path(spec_path).resolve()
    with open(target, encoding="utf-8") as handle:
        return json.load(handle)


def format_duration(seconds: int) -> str:
    if seconds < 0:
        raise CoachInputError(f"Step duration_sec must be non-negative, got {seconds}.")
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    parts: list[str] = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    if secs or not parts:
        parts.append(f"{secs}s")
    return "".join(parts)


def format_power_target(target: dict[str, Any]) -> str:
    """Render a step target. Precedence: pct > watts > hr_zone > rpe > "free"."""
    pct = target.get("power_pct_ftp")
    watts = target.get("power_w")
    hr_zone = target.get("hr_zone")
    rpe = target.get("rpe")

    if pct:
        low = round(float(pct[0]) * 100)
        high = round(float(pct[1]) * 100)
        if low == high:
            return f"{low}%"
        return f"{low}-{high}%"
    if watts:
        low = round(float(watts[0]))
        high = round(float(watts[1]))
        if low == high:
            return f"{low}w"
        return f"{low}-{high}w"
    if hr_zone not in (None, ""):
        return str(hr_zone)
    if rpe:
        low = rpe[0]
        high = rpe[1]
        if low == high:
            return f"RPE {low}"
        return f"RPE {low}-{high}"
    return "free"


def format_step_duration_minutes(seconds: int) -> str:
    """Duration for a NATIVE workout step line, in minutes (never hours).

    Intervals' description parser mishandles the hour unit in a repeat, e.g.
    `4x` + `- 1h 58-66%`: it inflates the workout so a 5h ride renders over ~10h
    with an empty front. Minute durations (`- 60m`) parse correctly — proven by the
    working June-16 event (all-minute steps) vs the doubling Friday (`- 1h`).
    Confirmed 2026-06-23.
    """
    seconds = int(seconds)
    if seconds < 0:
        raise CoachInputError(f"Step duration_sec must be non-negative, got {seconds}.")
    minutes, secs = divmod(seconds, 60)
    if secs:
        return f"{minutes}m{secs}s" if minutes else f"{secs}s"
    return f"{minutes}m"


def format_step_line(step: dict[str, Any]) -> str:
    duration = format_step_duration_minutes(int(step["duration_sec"]))
    target = format_power_target(step.get("target", {}))
    notes = step.get("notes", "").strip()
    if target == "free":
        line = f"- {duration}"
    else:
        line = f"- {duration} {target}"
    if notes:
        line = f"{line} {notes}"
    return line


def workout_duration_seconds(spec: dict[str, Any]) -> int:
    total = 0
    for section in ("warmup", "cooldown"):
        for step in spec.get(section, []):
            total += int(step.get("duration_sec", 0))
    for block in spec.get("main_set", []):
        repeat = int(block.get("repeat", 1))
        total += repeat * sum(int(step.get("duration_sec", 0)) for step in block.get("steps", []))
    return total


def workout_doc_power_target(target: dict[str, Any]) -> dict[str, Any] | None:
    """Map a step target to an Intervals.icu workout_doc power object.

    Mirrors format_power_target's pct > watts precedence, but emits the
    structured {start, end, units} that Intervals stores and forwards to Wahoo.
    Returns None when the step carries no power target (hr_zone/rpe/free); such
    steps only appear in non-bike sessions, which do not build a workout_doc.
    """
    pct = target.get("power_pct_ftp")
    watts = target.get("power_w")
    if pct:
        return {"start": round(float(pct[0]) * 100), "end": round(float(pct[1]) * 100), "units": "%ftp"}
    if watts:
        return {"start": round(float(watts[0])), "end": round(float(watts[1])), "units": "w"}
    return None


def workout_doc_step(step: dict[str, Any]) -> dict[str, Any]:
    doc_step: dict[str, Any] = {"duration": int(step["duration_sec"])}
    power = workout_doc_power_target(step.get("target", {}) or {})
    if power is not None:
        doc_step["power"] = power
    return doc_step


# Intervals.icu mis-renders a single multi-hour step: it pads the chart with a
# phantom zero-power lead-in (no watts shown, average roughly halved, timeline
# roughly doubled -- e.g. a 5h ride displayed over ~10h). Capping each leaf step
# at an hour keeps the chart and load correct. See memory intervals-icu-publish-gotchas.
MAX_DOC_STEP_SECONDS = 3600


def split_long_doc_step(doc_step: dict[str, Any]) -> list[dict[str, Any]]:
    """Split one long leaf step into <=MAX_DOC_STEP_SECONDS chunks.

    Power is interpolated across the chunks so a ramp stays a ramp; a steady
    step (start == end) yields identical chunks. Repeat wrappers (nested
    "steps") and already-short steps pass through unchanged.
    """
    dur = int(doc_step.get("duration", 0))
    if "steps" in doc_step or dur <= MAX_DOC_STEP_SECONDS:
        return [doc_step]
    n = (dur + MAX_DOC_STEP_SECONDS - 1) // MAX_DOC_STEP_SECONDS
    base, rem = divmod(dur, n)
    sizes = [base + (1 if i < rem else 0) for i in range(n)]
    power = doc_step.get("power")
    chunks: list[dict[str, Any]] = []
    elapsed = 0
    for size in sizes:
        chunk: dict[str, Any] = {"duration": size}
        if power is not None:
            s = float(power.get("start", 0))
            e = float(power.get("end", s))
            chunk["power"] = {
                "start": round(s + (e - s) * (elapsed / dur)),
                "end": round(s + (e - s) * ((elapsed + size) / dur)),
                "units": power.get("units", "%ftp"),
            }
        chunks.append(chunk)
        elapsed += size
    return chunks


def build_workout_doc(spec: dict[str, Any]) -> dict[str, Any]:
    """Build the structured workout_doc from the spec's steps.

    Sending this explicitly stops Intervals.icu from text-parsing the prose
    description into ride steps -- a fragile path that both invented spurious
    targetless intervals (which Wahoo rejects: "each interval that is not of
    type 'repeat' must have a valid 'targets' array") and mis-read targets out
    of coach notes (e.g. picking up "Z2" or "250-260 W" from a step's comment).
    Leaf steps longer than an hour are auto-split (see split_long_doc_step).
    """
    steps: list[dict[str, Any]] = []
    for step in spec.get("warmup", []):
        steps.extend(split_long_doc_step(workout_doc_step(step)))
    for block in spec.get("main_set", []):
        repeat = int(block.get("repeat", 1))
        block_steps: list[dict[str, Any]] = []
        for step in block.get("steps", []):
            block_steps.extend(split_long_doc_step(workout_doc_step(step)))
        if repeat > 1:
            steps.append({"reps": repeat, "text": f"{repeat}x", "steps": block_steps})
        else:
            steps.extend(block_steps)
    for step in spec.get("cooldown", []):
        steps.extend(split_long_doc_step(workout_doc_step(step)))

    return {"steps": steps}


def render_gym_table(rows: list[dict[str, Any]]) -> list[str]:
    lines = [
        "| Exercise Type | Exercise | Sets | Reps / Time | Rest |",
        "| --- | --- | ---: | --- | --- |",
    ]
    for row in rows:
        movement = row.get("movement", "")
        exercise = row.get("exercise", "")
        sets = row.get("sets", "")
        reps = row.get("reps", "")
        rest = row.get("rest", "")
        notes = row.get("notes", "").strip()
        exercise_text = exercise if not notes else f"{exercise}. {notes}"
        lines.append(f"| {movement} | {exercise_text} | {sets} | {reps} | {rest} |")
    return lines


def render_gym_timed_section(title: str, steps: list[dict[str, Any]]) -> list[str]:
    if not steps:
        return []
    lines = [
        "",
        f"## {title}",
        "| Part | Duration | Effort | Notes |",
        "| --- | --- | --- | --- |",
    ]
    for step in steps:
        duration = format_duration(int(step["duration_sec"]))
        target = format_power_target(step.get("target", {}))
        notes = step.get("notes", "").strip()
        lines.append(f"| {title} | {duration} | {target} | {notes} |")
    return lines


def render_centr_recommendation(spec: dict[str, Any]) -> list[str]:
    centr = spec.get("centr_recommendation")
    if not centr:
        return []

    lines = ["", "## Centr Selection"]
    primary = centr.get("primary")
    if primary:
        lines.append(f"- Primary: {primary}")
    alternatives = centr.get("alternatives", [])
    if alternatives:
        lines.append(f"- Alternatives: {', '.join(alternatives)}")
    keep = centr.get("keep", [])
    if keep:
        lines.append(f"- Keep from Centr: {', '.join(keep)}")
    skip = centr.get("skip", [])
    if skip:
        lines.append(f"- Skip from Centr: {', '.join(skip)}")
    links = centr.get("links") or centr.get("exact_links") or []
    if isinstance(links, dict):
        links = [f"{name}: {url}" for name, url in links.items()]
    if links:
        lines.append(f"- Exact links: {', '.join(str(link) for link in links)}")
    elif primary:
        lines.append("- Exact links: no verified Centr link yet; use the coach-prescribed table rather than search keywords.")
    notes = centr.get("notes")
    if notes:
        lines.append(f"- Notes: {notes}")
    return lines


def workout_duration_minutes(spec: dict[str, Any]) -> int:
    if spec.get("estimated_duration_sec"):
        return round(int(spec["estimated_duration_sec"]) / 60)
    return round(workout_duration_seconds(spec) / 60)


def render_nutrition_guidance(spec: dict[str, Any]) -> list[str]:
    custom = spec.get("nutrition")
    if custom:
        lines = ["", "## Fueling / Meals / Supplements"]
        for label, value in (
            ("Pre", custom.get("pre")),
            ("During", custom.get("during")),
            ("Post", custom.get("post")),
            ("Centr recipe", custom.get("centr_recipe") or custom.get("centr_recipes")),
            ("Centr exercise", custom.get("centr_exercise") or custom.get("centr_exercises")),
            ("Centr link", custom.get("centr_link") or custom.get("centr_links")),
            ("Supplements", custom.get("supplements")),
        ):
            if value:
                if isinstance(value, list):
                    value = ", ".join(str(item) for item in value)
                lines.append(f"- {label}: {value}")
        return lines

    sport = str(spec.get("sport", "")).lower()
    discipline = str(spec.get("discipline", "")).lower()
    title = str(spec.get("title", "")).lower()
    duration_min = workout_duration_minutes(spec)
    supplement_baseline = "Daily baseline: keep creatine monohydrate 3-5g/day if already chosen/tolerated, with 5g/day as the practical anchor; B12 and algae omega 3 as vegetarian baseline; vitamin D only if season/sun/bloodwork support it; protein powder only if food is impractical; glycine/magnesium only if it helps sleep; skip EAA, L-glutamine, taurine, and collagen unless a specific reason exists."

    if sport in {"strength", "gym"} or discipline in {"gym", "mobility"}:
        if "mobility" in title or "deload" in title or discipline == "mobility":
            pre = "Normal meal timing; no special fueling needed. If hungry, take 15-25g carbs plus 10-20g protein."
            during = "Water to thirst, roughly 400-750ml/hour if sweating."
            post = "Normal balanced meal. If dinner is delayed, take 20-30g protein plus 30-60g carbs."
            centr = "If dinner is delayed: Salted Caramel Super Smoothie, https://centr.com/recipe/show/12693/salted-caramel-super-smoothie"
            supp = f"Today's workout needs: none required. {supplement_baseline}"
        else:
            pre = "Normal meal 2-4h before. If training hungry, take 20-30g carbs plus 10-20g protein 30-60 min before."
            during = "Water to thirst, roughly 400-750ml/hour. Electrolytes only if hot or you sweat heavily."
            post = "Protein-forward meal/snack with 25-35g protein; add 30-60g carbs if the next day includes riding."
            centr = "Salted Caramel Super Smoothie, https://centr.com/recipe/show/12693/salted-caramel-super-smoothie"
            supp = f"Today's workout needs: none required. {supplement_baseline}"
    elif duration_min < 75 and not any(key in title for key in ("sweet spot", "threshold", "over-under", "vo2")):
        pre = "Normal meal is enough. If hungry, add 20-30g carbs 30-60 min before."
        during = "Water to thirst, roughly 400-750ml/hour if warm or sweating. No ride carbs needed."
        post = "Normal meal within 1-2h with 25-35g protein; add 30-60g carbs if dinner is delayed or another ride is within 24h."
        centr = "Swirled Banana & Oat Pots, https://centr.com/recipe/show/32848/swirled-banana-oat-pots"
        supp = f"Today's workout needs: none required. {supplement_baseline}"
    elif any(key in title for key in ("sweet spot", "threshold", "over-under", "vo2")):
        pre = "Carb-forward meal 2-4h before with about 1-2g carbs/kg. Optional 20-40g simple carbs 30-60 min before."
        during = "30-60g carbs/hour if over 75 min; otherwise water is acceptable if well-fed."
        post = "25-35g protein plus 60-90g carbs, especially if another ride is within 24h."
        centr = "Salted Caramel Super Smoothie, https://centr.com/recipe/show/12693/salted-caramel-super-smoothie"
        supp = f"Today's workout needs: optional caffeine only if tolerated and not late day, about 1-3 mg/kg 30-60 min before. {supplement_baseline}"
    elif duration_min >= 90:
        pre = "Carb-forward meal 2-4h before with about 1-2g carbs/kg."
        during = "Start in first 30 min. Target 40-70g carbs/hour depending on gut tolerance and duration."
        post = "25-35g protein plus 60-100g carbs; simple recovery meal if dinner is delayed."
        centr = "Salted Caramel Super Smoothie, https://centr.com/recipe/show/12693/salted-caramel-super-smoothie"
        supp = f"Today's workout needs: electrolytes/sodium if hot or heavy sweating; otherwise none required. {supplement_baseline}"
    else:
        pre = "Normal meal; if starting hungry, take 20-30g carbs 30-60 min before."
        during = "Water to thirst; optional 20-30g carbs if ride drifts over 75 min."
        post = "Normal meal with 25-35g protein."
        centr = "Swirled Banana & Oat Pots, https://centr.com/recipe/show/32848/swirled-banana-oat-pots"
        supp = f"Today's workout needs: none required. {supplement_baseline}"

    return [
        "",
        "## Fueling / Meals / Supplements",
        f"- Pre: {pre}",
        f"- During: {during}",
        f"- Post: {post}",
        f"- Centr recipe: {centr}",
        f"- Supplements: {supp}",
    ]


def render_recovery_guidance(spec: dict[str, Any]) -> list[str]:
    custom = spec.get("recovery")
    if custom:
        lines = ["", "## Recovery Actions"]
        for label, value in (
            ("Post-session", custom.get("post_session")),
            ("Evening", custom.get("evening")),
            ("Next morning check", custom.get("next_morning_check")),
        ):
            if value:
                if isinstance(value, list):
                    value = ", ".join(str(item) for item in value)
                lines.append(f"- {label}: {value}")
        return lines

    sport = str(spec.get("sport", "")).lower()
    discipline = str(spec.get("discipline", "")).lower()
    title = str(spec.get("title", "")).lower()
    duration_min = workout_duration_minutes(spec)
    hard_session = any(key in title for key in ("sweet spot", "threshold", "over-under", "vo2"))

    if sport in {"strength", "gym"} or discipline in {"gym", "mobility"}:
        if "mobility" in title or "recovery" in title or discipline == "mobility":
            post_session = "Leave fresher than you started. Stop before mobility turns into training."
            evening = "Normal meal timing, hydration to thirst, and protect bedtime."
            next_morning = "Proceed only if legs feel better or unchanged; if worse, rest."
        else:
            post_session = "Protein-forward meal/snack and easy walking if legs feel stiff."
            evening = "No extra lower-body work. Prioritize sleep."
            next_morning = "If soreness is more than mild, downgrade the next ride."
    elif hard_session or duration_min >= 90:
        post_session = "Carbs plus protein, fluids to thirst, and 5-10 min easy spin/walk if legs tighten."
        evening = "Keep dinner digestible and protect sleep; no extra hard training."
        next_morning = "Check legs, resting HR/HRV, and RPE memory before confirming the next session."
    elif duration_min < 75:
        post_session = "Normal meal with protein later; no special recovery protocol needed."
        evening = "Hydrate to thirst and keep bedtime normal."
        next_morning = "If legs are heavier or HRV/resting HR worsens, keep the next session recovery-biased."
    else:
        post_session = "Normal meal with protein and some carbs; do not underfuel the rest of the day."
        evening = "Light mobility only if it improves how you feel."
        next_morning = "Use legs plus HRV/resting HR to decide whether to progress or absorb."

    return [
        "",
        "## Recovery Actions",
        f"- Post-session: {post_session}",
        f"- Evening: {evening}",
        f"- Next morning check: {next_morning}",
    ]


def render_coach_note_template() -> list[str]:
    return [
        "",
        "## Private Feedback Fields",
        "After the workout, fill the private Intervals.icu fields, not the public activity description:",
        "Legs Before, Legs After, Fuel/GI, Pain/Niggles, Life Constraint, Mental State.",
        "Use the activity Notes/comment thread for free-text context and coach replies.",
    ]


def render_skill_focus(spec: dict[str, Any]) -> list[str]:
    skills = spec.get("skill_focus") or []
    if not skills:
        skills = default_skill_focus(spec)
    if not skills:
        return []
    lines = ["", "## Skill Focus"]
    for skill in skills:
        if isinstance(skill, dict):
            action = skill.get("action") or skill.get("drill") or skill.get("text")
            why = skill.get("why")
            if action and why:
                lines.append(f"- {action} Why: {why}")
            elif action:
                lines.append(f"- {action}")
        else:
            lines.append(f"- {skill}")
    return lines


def default_skill_focus(spec: dict[str, Any]) -> list[str]:
    sport = str(spec.get("sport", "")).lower()
    discipline = str(spec.get("discipline", "")).lower()
    title = str(spec.get("title", "")).lower()
    duration_min = workout_duration_minutes(spec)

    if sport in {"strength", "gym"} or discipline in {"gym", "mobility"}:
        if "mobility" in title or "deload" in title or discipline == "mobility":
            return [
                "Move through comfortable range only; no forced stretching. Why: this restores range without creating soreness that would reduce bike quality.",
                "Finish feeling looser or unchanged, never sore. Why: the goal is recovery, not another training stimulus.",
            ]
        return [
            "Keep reps controlled and symmetrical, especially through the left calf/ankle chain. Why: better symmetry supports durable power and reduces compensation as bike load rises.",
            "Stop each lower-body set with 2-3 reps in reserve. Why: strength should support the next key ride, not create fatigue that steals from it.",
        ]

    if any(key in title for key in ("sweet spot", "threshold", "over-under", "vo2")):
        return [
            "Rebuild power over 5-8 pedal strokes after corners or interruptions. Why: this trains outdoor race-like control without wasting energy in surges.",
            "Keep cadence steady and avoid torque spikes that could load the left calf. Why: smoother torque helps you hold higher FTP work repeatedly without compensation.",
        ]

    if "cadence" in title or "skill" in title:
        return [
            "Keep upper body quiet while cadence changes. Why: relaxed posture saves energy and improves pedaling control.",
            "Let power stay capped; the skill matters more than speed. Why: this develops coordination without turning a skill day into hidden intensity.",
        ]

    if duration_min >= 90 or "long" in title or "endurance" in title:
        return [
            "Keep climbs capped and seated when practical. Why: this builds aerobic durability without turning endurance into threshold spikes.",
            "Check shoulders, jaw, and grip every 20-30 minutes. Why: relaxed upper body reduces wasted energy over longer rides.",
        ]

    if any(key in title for key in ("recovery", "absorption", "easy", "readiness")):
        return [
            "Ride conversational and keep pressure light over rises. Why: easy frequency builds consistency while preserving the next key workout.",
            "Use relaxed hands and an easy gear to avoid unnecessary calf tension. Why: low-torque pedaling lets the left calf stay quiet while still adding aerobic time.",
        ]

    return [
        "Ride to the session purpose, not the highest average speed. Why: purposeful execution compounds better than random hard riding.",
        "Keep power changes gradual and cadence controlled. Why: repeatable power comes from controlled efforts, not spikes.",
    ]


def render_mental_focus(spec: dict[str, Any]) -> list[str]:
    focus = spec.get("mental_focus") or {}
    if not focus:
        focus = default_mental_focus(spec)
    if not focus:
        return []
    lines = ["", "## Mental Focus"]
    for label, key in (
        ("Intention", "intention"),
        ("Why", "why"),
        ("Cue", "cue"),
        ("Reset", "reset"),
    ):
        value = focus.get(key)
        if value:
            lines.append(f"- {label}: {value}")
    return lines


def default_mental_focus(spec: dict[str, Any]) -> dict[str, str]:
    sport = str(spec.get("sport", "")).lower()
    discipline = str(spec.get("discipline", "")).lower()
    title = str(spec.get("title", "")).lower()
    objective = str(spec.get("objective", "")).lower()
    duration_min = workout_duration_minutes(spec)

    if sport in {"strength", "gym"} or discipline in {"gym", "mobility"}:
        if "mobility" in title or "deload" in title or discipline == "mobility":
            return {
                "intention": "Use restraint and leave the session easier than you could have made it.",
                "why": "Recovery work only helps your FTP goal if it makes the next real session better.",
                "cue": "Better tomorrow matters more than more today.",
                "reset": "If you start adding extra work, pause, check whether it supports tomorrow, then return to mobility or stop.",
            }
        return {
            "intention": "Train quality and control without chasing soreness.",
            "why": "Strength supports your cycling goal when it builds usable force without draining bike freshness.",
            "cue": "Clean reps, reserve intact.",
            "reset": "If a set turns grindy, stop the set, reduce the next load or reps, and keep 2-3 reps in reserve.",
        }

    if any(key in title for key in ("sweet spot", "threshold", "over-under", "vo2")):
        return {
            "intention": "Practice pressure without turning control work into a test.",
            "why": "Controlled pressure raises sustainable power more reliably than proving yourself on every interval.",
            "cue": "Cap first, ego second.",
            "reset": "If power, cadence, or traffic stress spikes, exhale once, relax hands and shoulders, shift easier if needed, hold the low end of target for 60-90 seconds, then decide whether to continue or downgrade.",
        }

    if duration_min >= 90 or "long" in title or "fueling" in title or "endurance" in objective:
        return {
            "intention": "Build patient durability and protect late-ride decisions with early fueling.",
            "why": "Long aerobic consistency is what lets higher FTP become usable outside, not just on short efforts.",
            "cue": "Eat early, ride boring.",
            "reset": "If you get impatient or chase speed, drink, eat if due, relax grip, look 20-30 m ahead, and ride below the endurance cap for 2 minutes before reassessing.",
        }

    if "cadence" in title or "skill" in title:
        return {
            "intention": "Make the skill precise without adding stress.",
            "why": "Better coordination lets you produce the same watts with less noise and less fatigue.",
            "cue": "Quiet upper body, light pressure.",
            "reset": "If the drill gets ragged, stop the drill, ride easy for 2 minutes, then restart only if cadence and breathing are controlled.",
        }

    if any(key in title for key in ("recovery", "absorption", "easy", "readiness")):
        return {
            "intention": "Practice restraint and listen for freshness.",
            "why": "Easy rides add frequency and aerobic volume only if they leave you ready for the next key session.",
            "cue": "Easy should feel easy.",
            "reset": "If you start chasing power or speed, stop pedaling hard for 10-20 seconds, exhale once, relax hands and jaw, then ride Z1/Z2 for 60 seconds.",
        }

    return {
        "intention": "Keep attention on the workout purpose, not the biggest number possible.",
        "why": "Your goal is sustainable progression, so the purpose of the day matters more than one impressive file.",
        "cue": "Purpose first.",
        "reset": "If execution drifts, exhale once, relax hands and shoulders, return to the intended RPE or power cap for 60 seconds, then reassess.",
    }


def render_workout_text(spec: dict[str, Any]) -> str:
    lines: list[str] = [
        f"# {spec['title']}",
        "",
        f"Objective: {spec['objective']}",
        f"Why now: {spec['why_now']}",
    ]

    targets = spec.get("targets", {})
    ftp_reference = targets.get("ftp_reference_w")
    if ftp_reference:
        lines.append(f"FTP reference: {ftp_reference}w")
    if targets.get("notes"):
        lines.append(f"Target notes: {targets['notes']}")

    lines.extend(render_nutrition_guidance(spec))
    lines.extend(render_recovery_guidance(spec))

    execution_notes = spec.get("execution_notes", {})
    pre_cues = execution_notes.get("pre_interval_cues", [])
    if pre_cues:
        lines.append("")
        lines.append("Pre-interval cues:")
        for cue in pre_cues:
            lines.append(f"- {cue}")

    lines.extend(render_skill_focus(spec))
    lines.extend(render_mental_focus(spec))

    gym_table = spec.get("gym_table", [])
    if gym_table:
        # Avoid native workout syntax for gym sessions. Intervals otherwise parses
        # only the warmup/cooldown timed lines and displays a misleading duration.
        lines.extend(render_centr_recommendation(spec))
        lines.extend(render_gym_timed_section("Warmup", spec.get("warmup", [])))
        lines.extend(["", "## Main Set"])
        lines.extend(render_gym_table(gym_table))
        lines.extend(render_gym_timed_section("Cooldown", spec.get("cooldown", [])))
    else:
        # Bike/run: emit the workout as native syntax here. Intervals renders the planned
        # CHART/watts by PARSING this text and builds its own workout_doc from it (a client-
        # supplied workout_doc does NOT drive the chart, and sending BOTH makes Intervals
        # stack the parsed text on top of the doc -> doubled duration + empty front + a
        # targetless step that 422s Wahoo). So native text is the SINGLE source and we do
        # NOT attach a workout_doc (see build_event_payload). Every step must carry a valid
        # target so the parsed Wahoo plan is clean. Confirmed 2026-06-23.
        lines.extend(["", "## Warmup"])
        for step in spec.get("warmup", []):
            lines.append(format_step_line(step))

        lines.extend(["", "## Main Set"])
        previous_repeat = 1
        for index, block in enumerate(spec.get("main_set", [])):
            repeat = int(block.get("repeat", 1))
            if index > 0 and previous_repeat > 1 and repeat == 1:
                lines.extend(["", "## Main Set Continued"])
            if repeat > 1:
                lines.append(f"{repeat}x")
            for step in block.get("steps", []):
                lines.append(format_step_line(step))
            previous_repeat = repeat

        lines.extend(["", "## Cooldown"])
        for step in spec.get("cooldown", []):
            lines.append(format_step_line(step))

    during_cues = execution_notes.get("during_workout_cues", [])
    if during_cues:
        lines.extend(["", "During workout cues:"])
        for cue in during_cues:
            lines.append(f"Cue: {cue}")

    if execution_notes.get("if_too_easy"):
        lines.append(f"If too easy: {execution_notes['if_too_easy']}")
    if execution_notes.get("if_too_hard"):
        lines.append(f"If too hard: {execution_notes['if_too_hard']}")
    if execution_notes.get("success_criteria"):
        lines.append(f"Success criteria: {execution_notes['success_criteria']}")

    post_capture = execution_notes.get("post_workout_capture", [])
    if post_capture:
        lines.extend(["", "Record after workout:"])
        for item in post_capture:
            lines.append(f"- {item}")
    lines.extend(render_coach_note_template())

    text = "\n".join(lines).strip() + "\n"
    return _sanitize_description_prose(text)


# Intervals' description parser scoops up tokens that look like workout steps from the
# PROSE too, not just the native "## Main Set" lines, and adds phantom steps that inflate
# the workout. Two confirmed offenders (2026-06-23): an "Nh" duration anywhere in prose
# (e.g. a cue "do not force a 5h ride" -> a phantom 5h step, doubling a 5h ride), and a
# mid-sentence " - " (space-hyphen-space) that reads as a new bullet/step line. Neutralize
# both: space the hour token ("5h" -> "5 h") and use an em-dash for prose dashes. Native
# step lines start with "- " (no leading space) and use minute durations, so they're
# untouched. (A diff of the working June-16 event vs the doubling Friday pinned this.)
def _sanitize_description_prose(text: str) -> str:
    import re

    text = text.replace(" - ", " — ")
    text = re.sub(r"(?<![\w.])(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)h\b", r"\1 h", text)
    return text


def build_event_payload(spec: dict[str, Any], planned_date: str) -> dict[str, Any]:
    source_context = spec.get("source_context", {})
    publication = spec.get("publication", {}).get("intervals_icu", {})
    folder = publication.get("folder", "Codex Coach")
    description = render_workout_text(spec)
    external_id = f"{spec['workout_id']}:{planned_date}"

    event_type = spec.get("event_type")
    if not event_type:
        sport = str(spec.get("sport", "")).lower()
        if sport in {"strength", "gym"}:
            event_type = "WeightTraining"
        else:
            event_type = "Ride"

    event = {
        "category": "WORKOUT",
        "start_date_local": f"{planned_date}T00:00:00",
        "name": spec["title"],
        "description": description,
        "external_id": external_id,
        "type": event_type,
    }
    # Always emit an explicit duration so a reused calendar slot never keeps a
    # stale target, regardless of event type. Prefer the spec's estimate, else
    # derive it from the structured steps.
    estimated = spec.get("estimated_duration_sec")
    duration = int(estimated) if estimated is not None else workout_duration_seconds(spec)
    event["moving_time"] = duration
    event["time_target"] = duration

    # Power-based bike sessions let Intervals model load from the structured
    # targets; everything else (gym, run, etc.) must explicitly clear any load
    # inherited from a previously-published ride on the same slot.
    if event_type in POWER_LOAD_EVENT_TYPES:
        # Attach the structured workout_doc AND keep the native workout text in the
        # description. Intervals uses the workout_doc as the authoritative duration/structure
        # (so moving_time stays correct) and renders the chart; the native text provides the
        # readable structure. Matches the proven-correct June-16 event. NOTE: dropping the
        # workout_doc makes Intervals add the parsed-text duration on top of moving_time
        # (a 5h ride came back as 10h) -- so it must stay. Confirmed 2026-06-23.
        if any(spec.get(section) for section in ("warmup", "main_set", "cooldown")):
            event["workout_doc"] = build_workout_doc(spec)
    else:
        event["load"] = None
        event["icu_training_load"] = None
        event["load_target"] = None

    tags = [folder]
    phase = source_context.get("phase")
    if phase:
        tags.append(str(phase))
    event["description"] = description
    event["color"] = "blue"
    if tags:
        event["tags"] = tags
    return event


def resolve_spec_and_date(plan_path: str, workout_entry: dict[str, Any]) -> tuple[dict[str, Any], str]:
    if "spec_path" in workout_entry:
        spec = load_json_relative(plan_path, workout_entry["spec_path"])
    else:
        spec = workout_entry
    planned_date = workout_entry.get("planned_date") or spec.get("publication", {}).get("intervals_icu", {}).get("planned_date")
    if not planned_date:
        raise CoachInputError("Every workout in a week plan needs a planned_date, either inline or in its publication block.")
    datetime.strptime(planned_date, "%Y-%m-%d")
    return spec, planned_date


def command_render(args: argparse.Namespace) -> int:
    spec = load_json(args.spec)
    sys.stdout.write(render_workout_text(spec))
    return 0


def upsert_events(api_key: str, athlete_id: str, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Create or update calendar events, keyed on external_id.

    Intervals.icu assigns its own server uid on create and ignores a
    client-supplied one, so the bulk endpoint's upsertOnUid can never match an
    event we built -- every publish would create a fresh event and duplicate the
    slot. Instead we look up the events already on the affected dates, match them
    by external_id (workout_id:date), PUT-update any match in place, and only
    bulk-create the genuinely new ones. This makes republishing idempotent.
    """
    dates = sorted(payload["start_date_local"][:10] for payload in payloads)
    existing = api_request(
        api_key,
        "GET",
        f"/athlete/{athlete_id}/events",
        query={"oldest": dates[0], "newest": dates[-1], "category": "WORKOUT"},
    )
    event_id_by_external_id: dict[str, Any] = {}
    for event in existing if isinstance(existing, list) else []:
        external_id = event.get("external_id")
        if external_id:
            event_id_by_external_id[external_id] = event.get("id")

    results: list[dict[str, Any]] = []
    creates: list[dict[str, Any]] = []
    for payload in payloads:
        match_id = event_id_by_external_id.get(payload["external_id"])
        if match_id is not None:
            results.append(
                api_request(api_key, "PUT", f"/athlete/{athlete_id}/events/{match_id}", json_body=payload)
            )
        else:
            creates.append(payload)

    if creates:
        created = api_request(
            api_key,
            "POST",
            f"/athlete/{athlete_id}/events/bulk",
            query={"updatePlanApplied": "true"},
            json_body=creates,
        )
        results.extend(created if isinstance(created, list) else [created])
    return results


def command_publish(args: argparse.Namespace) -> int:
    spec = load_json(args.spec)
    planned_date = args.planned_date or spec.get("publication", {}).get("intervals_icu", {}).get("planned_date")
    if not planned_date:
        raise CoachInputError("Missing planned date. Use --planned-date or set publication.intervals_icu.planned_date.")
    datetime.strptime(planned_date, "%Y-%m-%d")

    payload = [build_event_payload(spec, planned_date)]
    if args.dry_run:
        json.dump(payload, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    api_key = resolve_api_key(args)
    response = upsert_events(api_key, args.athlete_id, payload)
    json.dump(response, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def command_publish_week(args: argparse.Namespace) -> int:
    plan = load_json(args.plan)
    workouts = plan.get("workouts", [])
    if not workouts:
        raise CoachInputError("Week plan has no workouts.")

    payload: list[dict[str, Any]] = []
    for workout_entry in workouts:
        spec, planned_date = resolve_spec_and_date(args.plan, workout_entry)
        if args.from_date and planned_date < args.from_date:
            continue
        if args.to_date and planned_date > args.to_date:
            continue
        payload.append(build_event_payload(spec, planned_date))
    if not payload:
        raise CoachInputError("No workouts matched the requested date filters.")

    if args.dry_run:
        json.dump(payload, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    api_key = resolve_api_key(args)
    response = upsert_events(api_key, args.athlete_id, payload)
    json.dump(response, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def activity_field_payload(field: dict[str, Any], index: int) -> dict[str, Any]:
    text_wrap = field.get("text_wrap", "no")
    field_type = "select" if field.get("options") else "text"
    return {
        "type": "ACTIVITY_FIELD",
        "visibility": "PRIVATE",
        "name": field["name"],
        "description": field.get("description", "Private athlete feedback field for coach analysis."),
        "index": index,
        "content": {
            "max": None,
            "min": None,
            "code": field["code"],
            "icon": "",
            "link": field.get("link", ""),
            "type": field_type,
            "color": "#333333",
            "gauge": True,
            "total": None,
            "units": "",
            "inline": False,
            "prefix": "",
            "script": "",
            "suffix": "",
            "average": None,
            "convert": "",
            "example": field["options"][0] if field.get("options") else "free text",
            "options": [
                {"text": option, "value": index}
                for index, option in enumerate(field.get("options", []), start=1)
            ],
            "aggregate": "SUM",
            "text_wrap": text_wrap,
            "pace_units": None,
            "text_align": "left",
            "number_format": ".1f",
            "fit_session_field": "",
            "processes_fit_messages": False,
            "name": field["name"],
        },
    }


def command_ensure_feedback_fields(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    existing = api_request(api_key, "GET", f"/athlete/{args.athlete_id}/custom-item")
    existing_by_code = {
        (item.get("content") or {}).get("code"): item
        for item in existing
        if item.get("type") == "ACTIVITY_FIELD" and (item.get("content") or {}).get("code")
    }
    max_index = max((item.get("index") or 0 for item in existing), default=0)

    results: list[dict[str, Any]] = []
    for offset, field in enumerate(FEEDBACK_CUSTOM_FIELDS, start=1):
        current = existing_by_code.get(field["code"])
        if current:
            payload = activity_field_payload(field, current.get("index") or max_index + offset)
            updated = api_request(
                api_key,
                "PUT",
                f"/athlete/{args.athlete_id}/custom-item/{current['id']}",
                json_body=payload,
            )
            results.append(
                {
                    "status": "updated",
                    "id": updated.get("id"),
                    "name": updated.get("name"),
                    "code": field["code"],
                }
            )
            continue

        payload = activity_field_payload(field, max_index + offset)
        created = api_request(
            api_key,
            "POST",
            f"/athlete/{args.athlete_id}/custom-item",
            json_body=payload,
        )
        results.append(
            {
                "status": "created",
                "id": created.get("id"),
                "name": created.get("name"),
                "code": field["code"],
            }
        )

    json.dump(results, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def list_custom_items(api_key: str, athlete_id: str) -> list[dict[str, Any]]:
    items = api_request(api_key, "GET", f"/athlete/{athlete_id}/custom-item")
    return items if isinstance(items, list) else []


def normalize_field_key(value: str) -> str:
    return "".join(char.lower() for char in value if char.isalnum())


def select_custom_item_fields(item: dict[str, Any]) -> dict[str, Any]:
    content = item.get("content") or {}
    return {
        "id": item.get("id"),
        "name": item.get("name"),
        "type": item.get("type"),
        "visibility": item.get("visibility"),
        "index": item.get("index"),
        "code": content.get("code"),
        "content_type": content.get("type"),
        "link": content.get("link"),
        "text_wrap": content.get("text_wrap"),
        "options": content.get("options"),
    }


def command_list_custom_items(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    items = list_custom_items(api_key, args.athlete_id)
    selected = [select_custom_item_fields(item) for item in items]
    if args.item_type:
        selected = [item for item in selected if item.get("type") == args.item_type]
    json.dump(selected, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def find_custom_activity_field(api_key: str, athlete_id: str, field: str) -> dict[str, Any]:
    needle = normalize_field_key(field)
    matches: list[dict[str, Any]] = []
    for item in list_custom_items(api_key, athlete_id):
        if item.get("type") != "ACTIVITY_FIELD":
            continue
        content = item.get("content") or {}
        names = [
            str(item.get("name") or ""),
            str(content.get("name") or ""),
            str(content.get("code") or ""),
        ]
        if any(normalize_field_key(name) == needle for name in names):
            matches.append(item)
    if not matches:
        raise CoachInputError(f"No activity field matched {field!r}. Run list-custom-items to inspect available fields.")
    if len(matches) > 1:
        names = ", ".join(str(item.get("name") or (item.get("content") or {}).get("code")) for item in matches)
        raise CoachInputError(f"Multiple activity fields matched {field!r}: {names}")
    return matches[0]


def command_set_activity_custom_field(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    value = args.value
    if value == "-":
        value = sys.stdin.read().strip()
    if not value:
        raise CoachInputError("Missing field value.")

    field = find_custom_activity_field(api_key, args.athlete_id, args.field)
    content = field.get("content") or {}
    code = content.get("code")
    if not code:
        raise CoachInputError(f"Matched field {field.get('name')!r} has no content.code.")

    response = api_request(api_key, "PUT", f"/activity/{args.activity_id}", json_body={code: value})
    json.dump(
        {
            "id": response.get("id"),
            "field": field.get("name"),
            "code": code,
            "value": response.get(code),
        },
        sys.stdout,
        indent=2,
    )
    sys.stdout.write("\n")
    return 0


def command_read_paired_event(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    activity = api_request(api_key, "GET", f"/activity/{args.activity_id}")
    paired_event_id = activity.get("paired_event_id")
    if not paired_event_id:
        raise CoachInputError(f"Activity {args.activity_id} has no paired_event_id.")

    event = api_request(api_key, "GET", f"/athlete/{args.athlete_id}/events/{paired_event_id}")
    selected = {
        "activity_id": args.activity_id,
        "paired_event_id": paired_event_id,
        "name": event.get("name"),
        "start_date_local": event.get("start_date_local"),
        "description": event.get("description"),
        "workout_doc": event.get("workout_doc"),
    }
    json.dump(selected, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def select_event_fields(event: dict[str, Any], include_description: bool = False) -> dict[str, Any]:
    selected = {
        "id": event.get("id"),
        "name": event.get("name"),
        "type": event.get("type"),
        "category": event.get("category"),
        "start_date_local": event.get("start_date_local"),
        "end_date_local": event.get("end_date_local"),
        "moving_time": event.get("moving_time"),
        "time_target": event.get("time_target"),
        # Prefer the modeled load, but keep a real 0 instead of falling through
        # to a possibly-stale `load` value.
        "load": event["icu_training_load"]
        if event.get("icu_training_load") is not None
        else event.get("load"),
        "load_target": event.get("load_target"),
        "for_week": event.get("for_week"),
        "paired_activity_id": event.get("paired_activity_id") or event.get("activity_id"),
        "paired_event_id": event.get("paired_event_id"),
        "tags": event.get("tags"),
        "calendar_id": event.get("calendar_id"),
    }
    if include_description:
        selected["description"] = event.get("description")
        selected["workout_doc"] = event.get("workout_doc")
    return selected


def command_read_events(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    events = api_request(
        api_key,
        "GET",
        f"/athlete/{args.athlete_id}/events",
        query={"oldest": args.oldest, "newest": args.newest, "category": args.category},
    )
    if not isinstance(events, list):
        events = []
    selected = [select_event_fields(event, args.include_description) for event in events]
    if args.limit:
        selected = selected[: args.limit]
    json.dump(selected, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def find_plan_workout(plan: dict[str, Any], workout_id: str) -> dict[str, Any]:
    for workout in plan.get("workouts", []):
        if workout.get("workout_id") == workout_id:
            return workout
    raise CoachInputError(f"No workout_id {workout_id!r} found in plan.")


def command_update_event(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    if args.plan:
        plan = load_json(args.plan)
        if not args.workout_id:
            raise CoachInputError("--workout-id is required with --plan.")
        workout_entry = find_plan_workout(plan, args.workout_id)
        spec, planned_date = resolve_spec_and_date(args.plan, workout_entry)
    elif args.spec:
        spec = load_json(args.spec)
        planned_date = spec.get("publication", {}).get("intervals_icu", {}).get("planned_date")
        if not planned_date:
            raise CoachInputError("--planned-date is required when the spec has no publication date.")
    else:
        raise CoachInputError("Use --spec or --plan with --workout-id.")

    if args.planned_date:
        planned_date = args.planned_date
    datetime.strptime(planned_date, "%Y-%m-%d")

    payload = build_event_payload(spec, planned_date)
    response = api_request(
        api_key,
        "PUT",
        f"/athlete/{args.athlete_id}/events/{args.event_id}",
        json_body=payload,
    )
    json.dump(select_event_fields(response, args.include_description), sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def command_delete_event(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    response = api_request(api_key, "DELETE", f"/athlete/{args.athlete_id}/events/{args.event_id}")
    json.dump({"deleted_event_id": args.event_id, "response": response}, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def command_publish_targets(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    plan = load_json(args.plan)
    targets = plan.get("targets", [])
    if not targets:
        raise CoachInputError("Target plan has no targets.")

    payload = []
    for target in targets:
        start_date = target["start_date"]
        datetime.strptime(start_date, "%Y-%m-%d")
        event = {
            "category": "TARGET",
            "start_date_local": f"{start_date}T00:00:00",
            "name": target["name"],
            "description": target.get("description", ""),
            "external_id": target.get("external_id") or f"{plan['plan_id']}:{start_date}",
            "type": target.get("type", "Ride"),
            "color": target.get("color", "blue"),
            "for_week": True,
        }
        if target.get("end_date"):
            datetime.strptime(target["end_date"], "%Y-%m-%d")
            event["end_date_local"] = f"{target['end_date']}T00:00:00"
        if target.get("time_target") is not None:
            event["time_target"] = int(target["time_target"])
        if target.get("icu_training_load") is not None:
            target_load = int(target["icu_training_load"])
            event["icu_training_load"] = target_load
            event["load"] = target_load
            event["load_target"] = target_load
        if target.get("distance_target") is not None:
            event["distance_target"] = float(target["distance_target"])
        tags = target.get("tags")
        if tags:
            event["tags"] = tags
        payload.append(event)

    if args.dry_run:
        json.dump(payload, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    response = api_request(
        api_key,
        "POST",
        f"/athlete/{args.athlete_id}/events/bulk",
        query={"upsertOnUid": "true", "updatePlanApplied": "true"},
        json_body=payload,
    )
    selected = [select_event_fields(event, args.include_description) for event in response]
    json.dump(selected, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def select_activity_fields(row: dict[str, str]) -> dict[str, Any]:
    legacy_feedbacks = (
        row.get("Feedbacks")
        or row.get("feedbacks")
        or row.get("feedback")
        or row.get("Feedback")
    )
    structured_feedback = {
        field["code"]: row.get(field["code"]) or row.get(field["name"])
        for field in FEEDBACK_CUSTOM_FIELDS
    }
    fields = {
        "id": row.get("id"),
        "start_date_local": row.get("start_date_local"),
        "name": row.get("name"),
        "type": row.get("type"),
        "moving_time": row.get("moving_time"),
        "distance": row.get("distance"),
        "coasting_time": row.get("coasting_time"),
        "average_heartrate": row.get("average_heartrate"),
        "average_cadence": row.get("average_cadence"),
        "avg_lr_balance": row.get("avg_lr_balance"),
        "icu_average_watts": row.get("icu_average_watts"),
        "icu_normalized_watts": row.get("icu_normalized_watts") or row.get("icu_weighted_avg_watts"),
        "icu_weighted_avg_watts": row.get("icu_weighted_avg_watts") or row.get("icu_normalized_watts"),
        "icu_training_load": row.get("icu_training_load"),
        "icu_fatigue": row.get("icu_fatigue"),
        "icu_fitness": row.get("icu_fitness"),
        "icu_eftp": row.get("icu_eftp"),
        "trimp": row.get("trimp"),
        "strain_score": row.get("strain_score"),
        "icu_rpe": row.get("icu_rpe"),
        "feel": row.get("feel"),
        "perceived_exertion": row.get("perceived_exertion"),
        "session_rpe": row.get("session_rpe"),
        "icu_intensity": row.get("icu_intensity"),
        "icu_efficiency_factor": row.get("icu_efficiency_factor"),
        "icu_power_hr": row.get("icu_power_hr"),
        "decoupling": row.get("decoupling"),
        "icu_variability_index": row.get("icu_variability_index"),
        "sweet_spot_secs": row.get("sweet_spot_secs"),
        "icu_pm_ftp": row.get("icu_pm_ftp"),
        "icu_pm_cp": row.get("icu_pm_cp"),
        "compliance": row.get("compliance"),
        "coach_tick": row.get("coach_tick"),
        "coach_tick_label": coach_tick_label(row.get("coach_tick")),
        "description": row.get("description"),
        "paired_event_id": row.get("paired_event_id"),
        "legacy_feedbacks": legacy_feedbacks,
        **structured_feedback,
    }
    return fields


def list_activity_messages(api_key: str, activity_id: str) -> list[dict[str, Any]]:
    messages = api_request(api_key, "GET", f"/activity/{activity_id}/messages")
    return messages if isinstance(messages, list) else []


def select_activity_message_fields(message: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": message.get("id"),
        "created": message.get("created"),
        "name": message.get("name"),
        "type": message.get("type"),
        "content": message.get("content"),
    }


def hydrate_activity_messages(api_key: str, row: dict[str, Any]) -> dict[str, Any]:
    activity_id = row.get("id")
    if not activity_id:
        return row
    messages = [select_activity_message_fields(message) for message in list_activity_messages(api_key, activity_id)]
    row["messages"] = messages
    row["activity_notes"] = "\n".join(
        str(message["content"])
        for message in messages
        if message.get("type") == "TEXT" and message.get("content")
    )
    if row["activity_notes"]:
        row.pop("legacy_feedbacks", None)
    return row


def coach_tick_label(value: Any) -> str | None:
    if value in (None, ""):
        return None
    try:
        return COACH_TICK_LABELS.get(int(value))
    except (TypeError, ValueError):
        return None


def has_value(value: Any) -> bool:
    """True when a field carries a real value, treating numeric 0 as present.

    Activity rows arrive as strings via CSV and as ints via the detail endpoint,
    so truthiness would classify the same RPE/Feel of 0 differently. Checking
    against None/"" keeps both paths consistent.
    """
    return value is not None and value != ""


def missing_feedback(row: dict[str, Any]) -> bool:
    rpe_present = any(
        has_value(row.get(key))
        for key in ("icu_rpe", "session_rpe", "perceived_exertion")
    )
    feel_present = has_value(row.get("feel"))
    return not (rpe_present and feel_present)


def command_read_activities(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    csv_text = api_request(
        api_key,
        "GET",
        f"/athlete/{args.athlete_id}/activities.csv",
        query={"oldest": args.oldest, "newest": args.newest},
        accept="text/csv",
    )
    reader = csv.DictReader(csv_text.splitlines())
    rows = [select_activity_fields(row) for row in reader]
    if args.limit:
        rows = rows[: args.limit]
    if args.include_details:
        rows = [hydrate_activity_details(api_key, args.athlete_id, row) for row in rows]
    if args.include_messages:
        rows = [hydrate_activity_messages(api_key, row) for row in rows]
    json.dump(rows, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def hydrate_activity_details(api_key: str, athlete_id: str, row: dict[str, Any]) -> dict[str, Any]:
    activity_id = row.get("id")
    if not activity_id:
        return row
    detail = api_request(api_key, "GET", f"/activity/{activity_id}")
    detailed = select_activity_fields(detail)
    for key, value in detailed.items():
        if value not in (None, ""):
            row[key] = value
    return row


def command_missing_feedback(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    csv_text = api_request(
        api_key,
        "GET",
        f"/athlete/{args.athlete_id}/activities.csv",
        query={"oldest": args.oldest, "newest": args.newest},
        accept="text/csv",
    )
    reader = csv.DictReader(csv_text.splitlines())
    rows = [select_activity_fields(row) for row in reader]
    rows = [row for row in rows if missing_feedback(row)]
    if args.limit:
        rows = rows[: args.limit]
    json.dump(rows, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def select_wellness_fields(row: dict[str, Any]) -> dict[str, Any]:
    sport_info = row.get("sportInfo") or []
    ride_info = next((item for item in sport_info if item.get("type") == "Ride"), {})
    ctl = row.get("ctl")
    atl = row.get("atl")
    form = None if ctl is None or atl is None else ctl - atl
    return {
        "date": row.get("id"),
        "weight": row.get("weight"),
        "resting_hr": row.get("restingHR"),
        "hrv_rmssd": row.get("hrv"),
        "hrv_sdnn": row.get("hrvSDNN"),
        "sleep_seconds": row.get("sleepSecs"),
        "sleep_hours": None if row.get("sleepSecs") is None else round(float(row["sleepSecs"]) / 3600, 2),
        "sleep_score": row.get("sleepScore"),
        "sleep_quality": row.get("sleepQuality"),
        "avg_sleeping_hr": row.get("avgSleepingHR"),
        "readiness": row.get("readiness"),
        "fatigue": row.get("fatigue"),
        "stress": row.get("stress"),
        "mood": row.get("mood"),
        "soreness": row.get("soreness"),
        "steps": row.get("steps"),
        "ctl": ctl,
        "atl": atl,
        "form": form,
        "ride_eftp": ride_info.get("eftp"),
    }


def command_read_wellness(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    rows = api_request(
        api_key,
        "GET",
        f"/athlete/{args.athlete_id}/wellness",
        query={"oldest": args.oldest, "newest": args.newest},
    )
    selected = [select_wellness_fields(row) for row in rows]
    if args.limit:
        selected = selected[: args.limit]
    json.dump(selected, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def command_read_sport_settings(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    settings = api_request(api_key, "GET", f"/athlete/{args.athlete_id}/sport-settings/{args.sport}")
    json.dump(settings, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def command_set_ride_ftp(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    current = api_request(api_key, "GET", f"/athlete/{args.athlete_id}/sport-settings/Ride")
    if not isinstance(current, dict):
        current = {}
    payload = dict(current)
    payload["ftp"] = int(args.ftp)
    if args.indoor_ftp is not None:
        payload["indoor_ftp"] = int(args.indoor_ftp)
    elif "indoor_ftp" in payload and payload["indoor_ftp"] is not None:
        payload["indoor_ftp"] = int(args.ftp)

    updated = api_request(
        api_key,
        "PUT",
        f"/athlete/{args.athlete_id}/sport-settings/Ride",
        json_body=payload,
    )
    json.dump(
        {
            "sport": "Ride",
            "previous_ftp": current.get("ftp"),
            "previous_indoor_ftp": current.get("indoor_ftp"),
            "ftp": updated.get("ftp"),
            "indoor_ftp": updated.get("indoor_ftp"),
        },
        sys.stdout,
        indent=2,
    )
    sys.stdout.write("\n")
    return 0


def command_read_activity_messages(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    messages = [select_activity_message_fields(message) for message in list_activity_messages(api_key, args.activity_id)]
    json.dump(messages, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def command_add_activity_message(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    content = args.content
    if content == "-":
        content = sys.stdin.read().strip()
    if not content:
        raise CoachInputError("Missing message content.")

    response = api_request(
        api_key,
        "POST",
        f"/activity/{args.activity_id}/messages",
        json_body={"content": content},
    )
    json.dump(response, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def activity_chat_id(api_key: str, activity_id: str) -> int:
    activity = api_request(api_key, "GET", f"/activity/{activity_id}")
    chat_id = activity.get("icu_chat_id")
    if chat_id is None:
        raise CoachInputError(f"Activity {activity_id} has no Intervals.icu chat id.")
    return int(chat_id)


def command_update_activity_message(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    content = args.content
    if content == "-":
        content = sys.stdin.read().strip()
    if not content:
        raise CoachInputError("Missing message content.")

    chat_id = activity_chat_id(api_key, args.activity_id)
    response = api_request(
        api_key,
        "PUT",
        f"/chats/{chat_id}/messages/{args.message_id}",
        json_body={"content": content},
    )
    json.dump(response, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def command_delete_activity_message(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    chat_id = activity_chat_id(api_key, args.activity_id)
    response = api_request(api_key, "DELETE", f"/chats/{chat_id}/messages/{args.message_id}")
    json.dump(response, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def command_set_coach_tick(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    tick = args.tick.lower()
    if tick not in COACH_TICK_VALUES:
        allowed = ", ".join(COACH_TICK_VALUES)
        raise CoachInputError(f"Unknown coach tick {args.tick!r}. Use one of: {allowed}.")

    payload: dict[str, Any] = {"coach_tick": COACH_TICK_VALUES[tick]}
    if args.comment:
        payload["coach_tick_comment"] = args.comment
    response = api_request(api_key, "PUT", f"/activity/{args.activity_id}", json_body=payload)
    json.dump(
        {
            "id": response.get("id"),
            "coach_tick": response.get("coach_tick"),
            "coach_tick_label": coach_tick_label(response.get("coach_tick")),
        },
        sys.stdout,
        indent=2,
    )
    sys.stdout.write("\n")
    return 0


def command_set_activity_public_text(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    description = args.description
    if description == "-":
        description = sys.stdin.read().strip()
    current = api_request(api_key, "GET", f"/activity/{args.activity_id}")
    payload = {
        "name": args.title,
        "description": description,
    }
    # Intervals activity PUT can clear omitted mutable fields. Preserve the
    # visible coach tick when updating public text after a scored coach note.
    if current.get("coach_tick") is not None:
        payload["coach_tick"] = current.get("coach_tick")
    response = api_request(api_key, "PUT", f"/activity/{args.activity_id}", json_body=payload)
    json.dump(
        {
            "id": response.get("id"),
            "name": response.get("name"),
            "description": response.get("description") or "",
            "strava_id": response.get("strava_id"),
        },
        sys.stdout,
        indent=2,
    )
    sys.stdout.write("\n")
    return 0


def build_activity_analysis(row: dict[str, Any]) -> str:
    activity_name = row.get("name") or "Unknown"
    date = row.get("start_date_local") or ""
    avg_power = row.get("icu_average_watts") or "n/a"
    np_power = row.get("icu_normalized_watts") or "n/a"
    load = row.get("icu_training_load") or "n/a"
    eftp = row.get("icu_eftp") or "n/a"
    fatigue = row.get("icu_fatigue") or "n/a"
    fitness = row.get("icu_fitness") or "n/a"
    compliance = row.get("compliance") or "n/a"
    feedbacks = row.get("activity_notes") or row.get("legacy_feedbacks") or ""
    cadence = row.get("average_cadence") or "n/a"
    balance = row.get("avg_lr_balance") or "n/a"
    vi = row.get("icu_variability_index") or "n/a"
    trimp = row.get("trimp") or "n/a"
    strain = row.get("strain_score") or "n/a"
    coasting = row.get("coasting_time") or "n/a"
    intensity = row.get("icu_intensity") or "n/a"
    efficiency = row.get("icu_efficiency_factor") or "n/a"
    power_hr = row.get("icu_power_hr") or "n/a"
    decoupling = row.get("decoupling") or "n/a"
    avg_hr = row.get("average_heartrate") or "n/a"

    lines = [
        "# Workout Analysis",
        "",
        "## Workout",
        "",
        f"- date: {date}",
        "- workout: ",
        "- planned objective: ",
        f"- actual ride title: {activity_name}",
        "",
        "## Verdict",
        "",
        "- grade: `A | B | C | D`",
        "- quick verdict: ",
        "- coach tick: `Amazing | Good | Seen | Poor | WTF?`",
        "- public title/description update: ",
        "",
        "## Execution",
        "",
        f"- target compliance: compliance={compliance}",
        f"- pacing quality: avg_power={avg_power}w, normalized_power={np_power}w",
        f"- ride metrics: load={load}, intensity={intensity}, trimp={trimp}, strain_score={strain}",
        f"- efficiency metrics: efficiency_factor={efficiency}, power_hr={power_hr}, decoupling={decoupling}, variability_index={vi}",
        f"- technique metrics: avg_cadence={cadence}rpm, coasting_time={coasting}s, power_balance={balance}, avg_hr={avg_hr}",
        "- left-calf / L-R balance check: compare power_balance with recent baseline and athlete notes before drawing conclusions",
        "- repeatability or fade: ",
        "- heart rate or drift notes: ",
        f"- athlete notes: {feedbacks}",
        "",
        "## Nutrition, Recovery, And Supplements",
        "",
        "- workout fueling read: compare Fuel/GI notes, session duration/intensity, heat, and late-ride fade",
        "- post-workout nutrition/hydration: ",
        "- supplements: `none required` unless there is a specific justified use case",
        "- recovery actions: rest-of-day, evening, and next-morning guidance",
        "",
        "## Interpretation",
        "",
        f"- what it says about fitness: eFTP={eftp}, fitness={fitness}",
        f"- what it says about fatigue: training_load={load}, fatigue={fatigue}",
        "- does FTP confidence change: ",
        "- does the weekly plan change: ",
        "",
        "## Mental Execution",
        "",
        "- mental state and decision quality: ",
        "- useful cue or reset for next ride: ",
        "",
        "## Next step",
        "",
        "- next recommended workout: ",
        "- adjustment if fatigue is elevated: ",
        "- what to monitor next: ",
        "",
        "## Coach Note Draft",
        "",
        "Use this scannable format for the Intervals.icu Notes/comment thread. Keep one idea per bullet. Split dense checklist sections into separate comments.",
        "",
        "```text",
        "Coach note - [date or ride name]",
        "",
        "Verdict",
        "- [rating and one-line meaning]",
        "- [what this changes, if anything]",
        "",
        "Execution",
        "- [what went well]",
        "- [main limiter or why it was not a 10]",
        "",
        "Body / L-R",
        "[optional separate comment if detailed]",
        "",
        "Recovery / Supplements",
        "[optional separate comment if detailed]",
        "",
        "Mind",
        "- [mental pattern observed]",
        "- Cue: [one practical reset]",
        "",
        "Next",
        "- [next prescribed workout or change]",
        "- [single downgrade/stop rule if needed]",
        "```",
        "",
        "Dense follow-up comment format:",
        "",
        "```text",
        "Recovery / Supplements",
        "",
        "Nutrition",
        "- [short carb/protein/fluid action]",
        "",
        "Today's workout needs",
        "- [workout-specific supplement decision]",
        "",
        "Daily baseline",
        "- Creatine: [keep/skip reason]",
        "- B12: [keep/skip reason]",
        "- Omega 3: [keep/skip reason]",
        "- Vitamin D: [condition]",
        "- Protein powder: [condition]",
        "- Glycine/magnesium: [condition]",
        "",
        "Skip today",
        "- [items skipped]",
        "```",
    ]
    return "\n".join(lines) + "\n"


def command_analyze_activity(args: argparse.Namespace) -> int:
    api_key = resolve_api_key(args)

    csv_text = api_request(
        api_key,
        "GET",
        f"/athlete/{args.athlete_id}/activities.csv",
        query={"oldest": args.oldest, "newest": args.newest},
        accept="text/csv",
    )
    reader = csv.DictReader(csv_text.splitlines())
    rows = [select_activity_fields(row) for row in reader]
    if args.activity_id:
        rows = [row for row in rows if row.get("id") == args.activity_id]
    if not rows:
        raise CoachInputError("No activity matched the provided filters.")
    if args.include_details:
        rows[0] = hydrate_activity_details(api_key, args.athlete_id, rows[0])
    if args.include_messages:
        rows[0] = hydrate_activity_messages(api_key, rows[0])
    sys.stdout.write(build_activity_analysis(rows[0]))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--athlete-id",
        default=os.environ.get("INTERVALS_ICU_ATHLETE_ID", DEFAULT_ATHLETE_ID),
        help="Intervals.icu athlete id. Use 0 for the authenticated athlete. Defaults to INTERVALS_ICU_ATHLETE_ID if set.",
    )
    parser.add_argument("--api-key", help="Intervals.icu API key. Defaults to INTERVALS_ICU_API_KEY.")

    subparsers = parser.add_subparsers(dest="command", required=True)

    render_parser = subparsers.add_parser("render", help="Render native Intervals.icu workout text from a JSON spec.")
    render_parser.add_argument("spec", help="Path to workout spec JSON.")
    render_parser.set_defaults(func=command_render)

    publish_parser = subparsers.add_parser("publish", help="Publish a workout spec to Intervals.icu as a planned workout.")
    publish_parser.add_argument("spec", help="Path to workout spec JSON.")
    publish_parser.add_argument("--planned-date", help="Override publication.intervals_icu.planned_date.")
    publish_parser.add_argument("--dry-run", action="store_true", help="Print the bulk event payload instead of publishing.")
    publish_parser.set_defaults(func=command_publish)

    publish_week_parser = subparsers.add_parser("publish-week", help="Publish every workout in a week plan JSON file.")
    publish_week_parser.add_argument("plan", help="Path to week plan JSON.")
    publish_week_parser.add_argument("--dry-run", action="store_true", help="Print the bulk event payload instead of publishing.")
    publish_week_parser.add_argument("--from-date", help="Only publish workouts on or after this date, YYYY-MM-DD.")
    publish_week_parser.add_argument("--to-date", help="Only publish workouts on or before this date, YYYY-MM-DD.")
    publish_week_parser.set_defaults(func=command_publish_week)

    feedback_fields_parser = subparsers.add_parser("ensure-feedback-fields", help="Create private activity feedback custom fields if missing.")
    feedback_fields_parser.set_defaults(func=command_ensure_feedback_fields)

    custom_items_parser = subparsers.add_parser("list-custom-items", help="List Intervals.icu custom items and activity fields.")
    custom_items_parser.add_argument("--item-type", help="Filter by custom item type, e.g. ACTIVITY_FIELD.")
    custom_items_parser.set_defaults(func=command_list_custom_items)

    set_custom_field_parser = subparsers.add_parser("set-activity-custom-field", help="Set an Intervals.icu activity custom field by field name or code.")
    set_custom_field_parser.add_argument("activity_id", help="Activity id, e.g. i149497603.")
    set_custom_field_parser.add_argument("field", help="Activity field name or content code.")
    set_custom_field_parser.add_argument("value", help="Field value, or '-' to read from stdin.")
    set_custom_field_parser.set_defaults(func=command_set_activity_custom_field)

    paired_event_parser = subparsers.add_parser("read-paired-event", help="Read the Intervals planned event paired to a completed activity.")
    paired_event_parser.add_argument("activity_id", help="Activity id, e.g. i149497603.")
    paired_event_parser.set_defaults(func=command_read_paired_event)

    events_parser = subparsers.add_parser("read-events", help="Read planned Intervals.icu calendar events.")
    events_parser.add_argument("--oldest", required=True, help="Oldest date, YYYY-MM-DD.")
    events_parser.add_argument("--newest", help="Newest date, YYYY-MM-DD.")
    events_parser.add_argument("--limit", type=int, help="Maximum number of planned events to emit.")
    events_parser.add_argument("--include-description", action="store_true", help="Include event descriptions and workout docs.")
    events_parser.add_argument("--category", help="Filter by event category, e.g. WORKOUT, NOTE, TARGET.")
    events_parser.set_defaults(func=command_read_events)

    update_event_parser = subparsers.add_parser("update-event", help="Update an Intervals.icu planned event from a workout spec or plan entry.")
    update_event_parser.add_argument("event_id", help="Intervals calendar event id.")
    update_event_parser.add_argument("--spec", help="Path to a workout spec JSON.")
    update_event_parser.add_argument("--plan", help="Path to a week plan JSON.")
    update_event_parser.add_argument("--workout-id", help="Workout id inside --plan.")
    update_event_parser.add_argument("--planned-date", help="Override planned date, YYYY-MM-DD.")
    update_event_parser.add_argument("--include-description", action="store_true", help="Include event description and workout doc in the response.")
    update_event_parser.set_defaults(func=command_update_event)

    delete_event_parser = subparsers.add_parser("delete-event", help="Delete an Intervals.icu planned event.")
    delete_event_parser.add_argument("event_id", help="Intervals calendar event id.")
    delete_event_parser.set_defaults(func=command_delete_event)

    targets_parser = subparsers.add_parser("publish-targets", help="Publish weekly target events from an annual target plan JSON file.")
    targets_parser.add_argument("plan", help="Path to annual target plan JSON.")
    targets_parser.add_argument("--dry-run", action="store_true", help="Print the bulk target payload instead of publishing.")
    targets_parser.add_argument("--include-description", action="store_true", help="Include event description in the response.")
    targets_parser.set_defaults(func=command_publish_targets)

    activities_parser = subparsers.add_parser("read-activities", help="Read recent activity summaries from Intervals.icu.")
    activities_parser.add_argument("--oldest", required=True, help="Oldest date, YYYY-MM-DD.")
    activities_parser.add_argument("--newest", help="Newest date, YYYY-MM-DD.")
    activities_parser.add_argument("--limit", type=int, help="Maximum number of activity summaries to emit.")
    activities_parser.add_argument("--include-details", action="store_true", help="Hydrate each row from the activity detail endpoint, including private feedback fields when available.")
    activities_parser.add_argument("--include-messages", action="store_true", help="Include the Intervals.icu activity Notes/comment thread.")
    activities_parser.set_defaults(func=command_read_activities)

    missing_feedback_parser = subparsers.add_parser("missing-feedback", help="List activities missing Intervals.icu RPE or Feel.")
    missing_feedback_parser.add_argument("--oldest", required=True, help="Oldest date, YYYY-MM-DD.")
    missing_feedback_parser.add_argument("--newest", help="Newest date, YYYY-MM-DD.")
    missing_feedback_parser.add_argument("--limit", type=int, help="Maximum number of activities to emit.")
    missing_feedback_parser.set_defaults(func=command_missing_feedback)

    wellness_parser = subparsers.add_parser("read-wellness", help="Read wellness/recovery summaries from Intervals.icu.")
    wellness_parser.add_argument("--oldest", required=True, help="Oldest date, YYYY-MM-DD.")
    wellness_parser.add_argument("--newest", help="Newest date, YYYY-MM-DD.")
    wellness_parser.add_argument("--limit", type=int, help="Maximum number of wellness rows to emit.")
    wellness_parser.set_defaults(func=command_read_wellness)

    sport_settings_parser = subparsers.add_parser("read-sport-settings", help="Read Intervals.icu sport settings.")
    sport_settings_parser.add_argument("sport", help="Sport name, e.g. Ride.")
    sport_settings_parser.set_defaults(func=command_read_sport_settings)

    set_ride_ftp_parser = subparsers.add_parser("set-ride-ftp", help="Update Intervals.icu Ride sport FTP settings.")
    set_ride_ftp_parser.add_argument("ftp", type=int, help="Outdoor Ride FTP in watts.")
    set_ride_ftp_parser.add_argument("--indoor-ftp", type=int, help="Indoor Ride FTP in watts. Defaults to ftp if already configured.")
    set_ride_ftp_parser.set_defaults(func=command_set_ride_ftp)

    read_messages_parser = subparsers.add_parser("read-activity-messages", help="Read the Notes/comment thread for an Intervals.icu activity.")
    read_messages_parser.add_argument("activity_id", help="Activity id, e.g. i149497603.")
    read_messages_parser.set_defaults(func=command_read_activity_messages)

    add_message_parser = subparsers.add_parser("add-activity-message", help="Add a note/comment to an Intervals.icu activity.")
    add_message_parser.add_argument("activity_id", help="Activity id, e.g. i149497603.")
    add_message_parser.add_argument("content", help="Message content, or '-' to read from stdin.")
    add_message_parser.set_defaults(func=command_add_activity_message)

    update_message_parser = subparsers.add_parser(
        "update-activity-message",
        help="Update a note/comment in an Intervals.icu activity thread.",
    )
    update_message_parser.add_argument("activity_id", help="Activity id, e.g. i149497603.")
    update_message_parser.add_argument("message_id", help="Message id from read-activity-messages.")
    update_message_parser.add_argument("content", help="Message content, or '-' to read from stdin.")
    update_message_parser.set_defaults(func=command_update_activity_message)

    delete_message_parser = subparsers.add_parser(
        "delete-activity-message",
        help="Delete a note/comment from an Intervals.icu activity thread.",
    )
    delete_message_parser.add_argument("activity_id", help="Activity id, e.g. i149497603.")
    delete_message_parser.add_argument("message_id", help="Message id from read-activity-messages.")
    delete_message_parser.set_defaults(func=command_delete_activity_message)

    coach_tick_parser = subparsers.add_parser("set-coach-tick", help="Set the Intervals.icu coach tick for an activity.")
    coach_tick_parser.add_argument("activity_id", help="Activity id, e.g. i149497603.")
    coach_tick_parser.add_argument("tick", choices=sorted(COACH_TICK_VALUES), help="Coach tick label.")
    coach_tick_parser.add_argument("--comment", help="Optional coach tick comment. Prefer Notes for normal coach rationale.")
    coach_tick_parser.set_defaults(func=command_set_coach_tick)

    public_text_parser = subparsers.add_parser("set-activity-public-text", help="Set the public-safe activity title and description.")
    public_text_parser.add_argument("activity_id", help="Activity id, e.g. i149497603.")
    public_text_parser.add_argument("title", help="Public activity title.")
    public_text_parser.add_argument("description", help="Public activity description, or '-' to read from stdin.")
    public_text_parser.set_defaults(func=command_set_activity_public_text)

    analysis_parser = subparsers.add_parser("analyze-activity", help="Generate a standard workout-analysis skeleton from an Intervals.icu activity summary.")
    analysis_parser.add_argument("--oldest", required=True, help="Oldest date, YYYY-MM-DD.")
    analysis_parser.add_argument("--newest", help="Newest date, YYYY-MM-DD.")
    analysis_parser.add_argument("--activity-id", help="Specific activity id to analyze.")
    analysis_parser.add_argument("--include-details", action="store_true", help="Hydrate the selected row from the activity detail endpoint, including private feedback fields when available.")
    analysis_parser.add_argument("--include-messages", action="store_true", help="Include the Intervals.icu activity Notes/comment thread as athlete notes.")
    analysis_parser.set_defaults(func=command_analyze_activity)

    return parser


def main() -> int:
    load_local_env_files(LOCAL_ENV_PATHS)
    parser = build_parser()
    args = parser.parse_args()
    try:
        return int(args.func(args))
    except (IntervalsAPIError, CoachInputError) as exc:
        print(exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

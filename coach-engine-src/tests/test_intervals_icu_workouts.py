"""Unit tests for the pure helpers in tools/intervals_icu_workouts.py.

These cover the formatting/duration/auth logic that shapes what gets written to
the live Intervals.icu calendar, so a regression here is caught before publish.
Network and CLI command_* functions are intentionally out of scope.
"""

import argparse
import base64

import intervals_icu_workouts as icu
import pytest


# --- format_duration ---------------------------------------------------------
@pytest.mark.parametrize(
    "seconds,expected",
    [
        (0, "0s"),
        (45, "45s"),
        (60, "1m"),
        (90, "1m30s"),
        (3600, "1h"),
        (3661, "1h1m1s"),
        (5400, "1h30m"),
    ],
)
def test_format_duration(seconds, expected):
    assert icu.format_duration(seconds) == expected


# --- format_power_target -----------------------------------------------------
def test_power_target_percent_range():
    assert icu.format_power_target({"power_pct_ftp": [0.88, 0.94]}) == "88-94%"


def test_power_target_percent_single():
    assert icu.format_power_target({"power_pct_ftp": [0.75, 0.75]}) == "75%"


def test_power_target_watts_range():
    assert icu.format_power_target({"power_w": [200, 240]}) == "200-240w"


def test_power_target_hr_zone():
    assert icu.format_power_target({"hr_zone": "Z2"}) == "Z2"


def test_power_target_rpe_range():
    assert icu.format_power_target({"rpe": [6, 8]}) == "RPE 6-8"


def test_power_target_rpe_single():
    assert icu.format_power_target({"rpe": [5, 5]}) == "RPE 5"


def test_power_target_empty_is_free():
    assert icu.format_power_target({}) == "free"


def test_power_target_precedence_pct_over_watts():
    # pct should win when both are present.
    target = {"power_pct_ftp": [0.9, 0.9], "power_w": [250, 260]}
    assert icu.format_power_target(target) == "90%"


# --- workout_duration_seconds / minutes --------------------------------------
def _sample_spec():
    return {
        "warmup": [{"duration_sec": 600}],
        "main_set": [
            {"repeat": 4, "steps": [{"duration_sec": 480}, {"duration_sec": 120}]},
        ],
        "cooldown": [{"duration_sec": 300}],
    }


def test_workout_duration_seconds():
    # warmup 600 + 4*(480+120)=2400 + cooldown 300 = 3300
    assert icu.workout_duration_seconds(_sample_spec()) == 3300


def test_workout_duration_minutes_rounds():
    assert icu.workout_duration_minutes(_sample_spec()) == 55


def test_workout_duration_defaults_to_repeat_one():
    spec = {"main_set": [{"steps": [{"duration_sec": 300}]}]}
    assert icu.workout_duration_seconds(spec) == 300


def test_workout_duration_empty_spec():
    assert icu.workout_duration_seconds({}) == 0


# --- build_auth_header -------------------------------------------------------
def test_build_auth_header_roundtrip():
    header = icu.build_auth_header("secret123")
    assert header.startswith("Basic ")
    decoded = base64.b64decode(header.split(" ", 1)[1]).decode()
    assert decoded == "API_KEY:secret123"


# --- coach_tick_label --------------------------------------------------------
@pytest.mark.parametrize(
    "value,expected",
    [(1, "wtf"), (3, "seen"), (5, "amazing"), ("4", "good")],
)
def test_coach_tick_label_known(value, expected):
    assert icu.coach_tick_label(value) == expected


@pytest.mark.parametrize("value", [None, "", "nope", 99])
def test_coach_tick_label_unknown_is_none(value):
    assert icu.coach_tick_label(value) is None


# --- normalize_field_key -----------------------------------------------------
def test_normalize_field_key_strips_and_lowercases():
    assert icu.normalize_field_key("Legs Before!") == "legsbefore"
    assert icu.normalize_field_key("Fuel/GI") == "fuelgi"


# --- format_step_line --------------------------------------------------------
def test_format_step_line_with_target_and_notes():
    step = {"duration_sec": 480, "target": {"power_pct_ftp": [0.9, 0.95]}, "notes": "smooth"}
    assert icu.format_step_line(step) == "- 8m 90-95% smooth"


def test_format_step_line_free_no_target():
    assert icu.format_step_line({"duration_sec": 300, "target": {}}) == "- 5m"


# --- IntervalsAPIError is importable (refactor guard) ------------------------
def test_intervals_api_error_is_exception():
    assert issubclass(icu.IntervalsAPIError, Exception)


# --- publish path: render_workout_text + build_event_payload -----------------
# A bug in either function corrupts what is written to the live Intervals
# calendar, so these guard the highest-stakes code path in the tool.
def _ride_spec():
    return {
        "workout_id": "thr_4x8",
        "title": "Threshold 4x8",
        "objective": "Raise sustainable power",
        "why_now": "Form is fresh after two easy days",
        "warmup": [{"duration_sec": 600, "target": {"power_pct_ftp": [0.5, 0.6]}}],
        "main_set": [
            {"repeat": 4, "steps": [
                {"duration_sec": 480, "target": {"power_pct_ftp": [0.95, 1.0]}},
                {"duration_sec": 240, "target": {"power_pct_ftp": [0.5, 0.55]}},
            ]},
        ],
        "cooldown": [{"duration_sec": 300, "target": {}}],
    }


def test_render_workout_text_core_blocks():
    text = icu.render_workout_text(_ride_spec())
    assert text.startswith("# Threshold 4x8")
    assert "Objective: Raise sustainable power" in text
    assert "Why now: Form is fresh after two easy days" in text
    assert text.endswith("\n")


def test_native_step_lines_use_minutes_not_hours():
    # Intervals' description parser mishandles the hour unit in a repeat (`4x` + `- 1h`),
    # doubling the workout. Native step lines must be minutes. (June-16 minutes = correct,
    # Friday `- 1h` = doubled.) format_step_line must never emit an 'h'.
    assert icu.format_step_duration_minutes(3600) == "60m"
    assert icu.format_step_duration_minutes(5400) == "90m"
    assert icu.format_step_duration_minutes(900) == "15m"
    step = {"duration_sec": 3600, "target": {"power_pct_ftp": [0.58, 0.66]}}
    assert "h" not in icu.format_step_line(step).split()[1]  # the duration token has no 'h'


def test_render_workout_text_bike_emits_native_step_syntax():
    # Bike/run descriptions DO carry native workout syntax: Intervals parses it to build the
    # planned chart/load/Wahoo plan. The payload must then NOT also send a workout_doc, or the
    # two stack and double the workout (see test_build_event_payload_ride_has_no_workout_doc).
    text = icu.render_workout_text(_ride_spec())
    assert "## Warmup" in text and "## Main Set" in text and "## Cooldown" in text
    assert "4x" in text  # repeat marker rendered


def test_render_workout_text_gym_keeps_table_sections():
    # Gym sessions have no workout_doc, so they still render their table sections.
    spec = _ride_spec()
    spec["sport"] = "strength"
    spec["gym_table"] = [{"movement": "Squat", "exercise": "Back squat", "sets": 3, "reps": "5", "rest": "2m", "notes": "RPE 7"}]
    text = icu.render_workout_text(spec)
    assert "## Main Set" in text


def test_build_event_payload_ride_defaults():
    event = icu.build_event_payload(_ride_spec(), "2026-06-20")
    assert event["category"] == "WORKOUT"
    assert event["type"] == "Ride"  # default sport
    assert event["name"] == "Threshold 4x8"
    assert event["start_date_local"] == "2026-06-20T00:00:00"
    assert event["external_id"] == "thr_4x8:2026-06-20"
    assert event["color"] == "blue"
    assert event["tags"] == ["Codex Coach"]  # default folder
    # No estimated_duration_sec -> moving_time derived from steps (600+4*720+300).
    assert event["moving_time"] == 3780
    assert event["time_target"] == 3780


def test_build_event_payload_gym_is_weight_training_and_clears_load():
    spec = _ride_spec()
    spec["sport"] = "gym"
    spec["estimated_duration_sec"] = 3600
    event = icu.build_event_payload(spec, "2026-06-21")
    assert event["type"] == "WeightTraining"
    assert event["moving_time"] == 3600
    # Stale bike load must be cleared when reusing a slot for gym work.
    assert event["load"] is None
    assert event["icu_training_load"] is None
    assert event["load_target"] is None


def test_build_event_payload_appends_phase_tag():
    spec = _ride_spec()
    spec["source_context"] = {"phase": "Build 1"}
    event = icu.build_event_payload(spec, "2026-06-22")
    assert event["tags"] == ["Codex Coach", "Build 1"]


def test_build_event_payload_explicit_event_type_wins():
    spec = _ride_spec()
    spec["event_type"] = "VirtualRide"
    event = icu.build_event_payload(spec, "2026-06-23")
    assert event["type"] == "VirtualRide"


def test_build_event_payload_gym_without_duration_clears_load_and_sets_time():
    # Regression: a gym session with no estimated_duration_sec previously emitted
    # neither moving_time nor load-clearing, so a reused ride slot kept stale
    # bike duration and TSS on the live calendar.
    spec = _ride_spec()
    spec["sport"] = "gym"
    spec.pop("estimated_duration_sec", None)
    event = icu.build_event_payload(spec, "2026-06-24")
    assert event["type"] == "WeightTraining"
    assert event["moving_time"] == icu.workout_duration_seconds(spec)
    assert event["time_target"] == event["moving_time"]
    assert event["load"] is None
    assert event["icu_training_load"] is None
    assert event["load_target"] is None


# --- workout_doc: structured steps sent to Intervals (and on to Wahoo) -------
# Sending workout_doc explicitly stops Intervals.icu from text-parsing the prose
# description into ride steps -- the path that invented targetless intervals
# Wahoo rejects and mis-read targets out of coach notes.
def test_build_workout_doc_flattens_warmup_repeats_cooldown():
    doc = icu.build_workout_doc(_ride_spec())
    steps = doc["steps"]
    # warmup (1) + one repeat block + cooldown (1)
    assert steps[0] == {"duration": 600, "power": {"start": 50, "end": 60, "units": "%ftp"}}
    assert steps[1] == {
        "reps": 4,
        "text": "4x",
        "steps": [
            {"duration": 480, "power": {"start": 95, "end": 100, "units": "%ftp"}},
            {"duration": 240, "power": {"start": 50, "end": 55, "units": "%ftp"}},
        ],
    }
    # Free cooldown (target {}) stays targetless -- no invented power number.
    assert steps[2] == {"duration": 300}


def test_build_workout_doc_emits_watts_units():
    spec = _ride_spec()
    spec["main_set"] = [{"steps": [{"duration_sec": 1680, "target": {"power_w": [250, 260]}}]}]
    doc = icu.build_workout_doc(spec)
    assert doc["steps"][1] == {"duration": 1680, "power": {"start": 250, "end": 260, "units": "w"}}


# Intervals mis-renders a single multi-hour step; leaf steps are capped at 1h.
def test_split_long_doc_step_short_passes_through():
    step = {"duration": 1800, "power": {"start": 60, "end": 60, "units": "%ftp"}}
    assert icu.split_long_doc_step(step) == [step]


def test_split_long_doc_step_caps_and_interpolates_ramp():
    step = {"duration": 16200, "power": {"start": 56, "end": 70, "units": "%ftp"}}
    chunks = icu.split_long_doc_step(step)
    assert all(c["duration"] <= icu.MAX_DOC_STEP_SECONDS for c in chunks)
    assert sum(c["duration"] for c in chunks) == 16200
    # ramp preserved end-to-end
    assert chunks[0]["power"]["start"] == 56
    assert chunks[-1]["power"]["end"] == 70
    # contiguous power: each chunk's end is the next chunk's start
    assert all(chunks[i]["power"]["end"] == chunks[i + 1]["power"]["start"] for i in range(len(chunks) - 1))


def test_split_long_doc_step_repeat_wrapper_untouched():
    wrapper = {"reps": 3, "text": "3x", "steps": [{"duration": 7200, "power": {"start": 90, "end": 90, "units": "%ftp"}}]}
    assert icu.split_long_doc_step(wrapper) == [wrapper]


def test_build_workout_doc_splits_long_main_step():
    spec = _ride_spec()
    spec["main_set"] = [{"steps": [{"duration_sec": 9000, "target": {"power_pct_ftp": [0.62, 0.62]}}]}]
    steps = icu.build_workout_doc(spec)["steps"]
    main = [s for s in steps if s.get("power", {}).get("start") == 62]
    assert len(main) >= 3 and all(s["duration"] <= icu.MAX_DOC_STEP_SECONDS for s in main)
    assert sum(s["duration"] for s in main) == 9000


def test_build_event_payload_ride_has_workout_doc_and_native_text():
    # Bike/run sends BOTH: the workout_doc (authoritative structure/duration -> keeps
    # moving_time correct and renders the chart) AND native workout text in the description
    # (readable structure). This matches the proven-correct June-16 event. Dropping the
    # workout_doc made Intervals add the parsed-text duration onto moving_time (5h -> 10h).
    event = icu.build_event_payload(_ride_spec(), "2026-06-20")
    assert "workout_doc" in event
    assert "## Main Set" in event["description"] and "4x" in event["description"]


def test_build_event_payload_gym_has_no_workout_doc():
    spec = _ride_spec()
    spec["sport"] = "gym"
    event = icu.build_event_payload(spec, "2026-06-21")
    assert "workout_doc" not in event


# --- upsert_events: republishing updates in place, never duplicates ----------
# Intervals assigns its own uid on create, so idempotency must come from
# matching existing events by external_id and PUT-updating them in place.
def _fake_api(existing):
    """Return an api_request stub plus a log of the calls it received."""
    calls = []

    def fake(api_key, method, path, query=None, json_body=None):
        calls.append({"method": method, "path": path, "json_body": json_body})
        if method == "GET":
            return existing
        if method == "PUT":
            return {"id": int(path.rsplit("/", 1)[1]), "updated": True}
        if method == "POST":
            return [{"id": 999, "created": True} for _ in json_body]
        raise AssertionError(method)

    return fake, calls


def test_upsert_events_updates_existing_by_external_id(monkeypatch):
    existing = [{"id": 555, "external_id": "thr_4x8:2026-06-20"}]
    fake, calls = _fake_api(existing)
    monkeypatch.setattr(icu, "api_request", fake)
    payload = icu.build_event_payload(_ride_spec(), "2026-06-20")

    icu.upsert_events("KEY", "0", [payload])

    methods = [c["method"] for c in calls]
    assert methods == ["GET", "PUT"]  # matched -> updated in place, no create
    assert calls[1]["path"].endswith("/events/555")


def test_upsert_events_creates_when_no_match(monkeypatch):
    fake, calls = _fake_api([])  # nothing on the calendar yet
    monkeypatch.setattr(icu, "api_request", fake)
    payload = icu.build_event_payload(_ride_spec(), "2026-06-20")

    icu.upsert_events("KEY", "0", [payload])

    methods = [c["method"] for c in calls]
    assert methods == ["GET", "POST"]  # no match -> bulk create
    assert calls[1]["path"].endswith("/events/bulk")
    assert calls[1]["json_body"] == [payload]


def test_upsert_events_mixes_update_and_create(monkeypatch):
    existing = [{"id": 700, "external_id": "thr_4x8:2026-06-20"}]
    fake, calls = _fake_api(existing)
    monkeypatch.setattr(icu, "api_request", fake)
    p1 = icu.build_event_payload(_ride_spec(), "2026-06-20")  # matches 700
    p2 = icu.build_event_payload(_ride_spec(), "2026-06-21")  # new

    icu.upsert_events("KEY", "0", [p1, p2])

    methods = [c["method"] for c in calls]
    assert methods == ["GET", "PUT", "POST"]
    assert calls[1]["path"].endswith("/events/700")
    assert calls[2]["json_body"] == [p2]


# --- falsy-zero guards -------------------------------------------------------
def test_power_target_hr_zone_zero_is_not_dropped():
    assert icu.format_power_target({"hr_zone": 0}) == "0"


@pytest.mark.parametrize("rpe,feel", [(0, 0), ("0", "0")])
def test_missing_feedback_treats_zero_as_present(rpe, feel):
    # int (detail endpoint) and str (CSV) paths must classify identically.
    assert icu.missing_feedback({"icu_rpe": rpe, "feel": feel}) is False


def test_missing_feedback_true_when_absent():
    assert icu.missing_feedback({}) is True


def test_select_event_fields_keeps_zero_load():
    event = {"icu_training_load": 0, "load": 55}
    assert icu.select_event_fields(event)["load"] == 0


def test_format_duration_rejects_negative():
    with pytest.raises(icu.CoachInputError):
        icu.format_duration(-5)


# --- resolve_api_key ---------------------------------------------------------
def test_resolve_api_key_raises_without_key(monkeypatch):
    monkeypatch.delenv("INTERVALS_ICU_API_KEY", raising=False)
    args = argparse.Namespace(api_key=None)
    with pytest.raises(icu.CoachInputError):
        icu.resolve_api_key(args)


def test_resolve_api_key_prefers_arg():
    args = argparse.Namespace(api_key="abc")
    assert icu.resolve_api_key(args) == "abc"

#!/usr/bin/env python3
"""Export gym sessions from coach JSON plans for testing gym tracker apps."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from typing import Any


def load_plan(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def iter_workouts(plan: dict[str, Any]) -> list[dict[str, Any]]:
    workouts = plan.get("workouts")
    if isinstance(workouts, list):
        return workouts
    return [plan]


def planned_date(workout: dict[str, Any]) -> str:
    return workout.get("publication", {}).get("intervals_icu", {}).get("planned_date", "")


def is_gym_session(workout: dict[str, Any]) -> bool:
    return bool(workout.get("gym_table")) or workout.get("discipline") in {"gym", "mobility"}


def command_markdown(args: argparse.Namespace) -> int:
    plans = [load_plan(path) for path in args.plans]
    for plan in plans:
        for workout in iter_workouts(plan):
            if not is_gym_session(workout):
                continue
            print(f"## {planned_date(workout)} - {workout.get('title', 'Gym Session')}")
            centr = workout.get("centr_recommendation") or {}
            if centr:
                print()
                print("Centr selection:")
                print(f"- Primary: {centr.get('primary', 'N/A')}")
                alternatives = centr.get("alternatives") or []
                if alternatives:
                    print(f"- Alternatives: {', '.join(alternatives)}")
                keep = centr.get("keep") or []
                if keep:
                    print(f"- Keep: {', '.join(keep)}")
                skip = centr.get("skip") or []
                if skip:
                    print(f"- Skip: {', '.join(skip)}")
                if centr.get("notes"):
                    print(f"- Notes: {centr['notes']}")
            print()
            print("| Exercise Type | Exercise | Sets | Reps / Time | Rest | Notes |")
            print("| --- | --- | ---: | --- | --- | --- |")
            for row in workout.get("gym_table", []):
                print(
                    "| {movement} | {exercise} | {sets} | {reps} | {rest} | {notes} |".format(
                        movement=row.get("movement", ""),
                        exercise=row.get("exercise", ""),
                        sets=row.get("sets", ""),
                        reps=row.get("reps", ""),
                        rest=row.get("rest", ""),
                        notes=row.get("notes", ""),
                    )
                )
            print()
    return 0


def command_csv(args: argparse.Namespace) -> int:
    writer = csv.DictWriter(
        sys.stdout,
        fieldnames=[
            "date",
            "workout",
            "centr_primary",
            "movement",
            "exercise",
            "sets",
            "reps",
            "rest",
            "notes",
        ],
    )
    writer.writeheader()
    for path in args.plans:
        plan = load_plan(path)
        for workout in iter_workouts(plan):
            if not is_gym_session(workout):
                continue
            centr = workout.get("centr_recommendation") or {}
            for row in workout.get("gym_table", []):
                writer.writerow(
                    {
                        "date": planned_date(workout),
                        "workout": workout.get("title", ""),
                        "centr_primary": centr.get("primary", ""),
                        "movement": row.get("movement", ""),
                        "exercise": row.get("exercise", ""),
                        "sets": row.get("sets", ""),
                        "reps": row.get("reps", ""),
                        "rest": row.get("rest", ""),
                        "notes": row.get("notes", ""),
                    }
                )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    markdown = subparsers.add_parser("markdown", help="Export gym sessions as readable markdown.")
    markdown.add_argument("plans", nargs="+", help="Plan JSON files.")
    markdown.set_defaults(func=command_markdown)

    csv_parser = subparsers.add_parser("csv", help="Export gym sessions as CSV.")
    csv_parser.add_argument("plans", nargs="+", help="Plan JSON files.")
    csv_parser.set_defaults(func=command_csv)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())

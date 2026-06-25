# Intervals Paired Workout Trace

Do not duplicate planned workout instructions into custom activity fields or GitHub files.

Use Intervals.icu as the trace source:
- a completed activity can keep a `paired_event_id`;
- that paired event retains the original planned workout `description`;
- that paired event also retains the structured `workout_doc`.

Workflow:
- read the completed activity;
- if it has `paired_event_id`, read the paired event;
- use the paired event `description` and `workout_doc` as the out-of-the-box Intervals trace;
- do not paste long planned workout text into the activity header or custom fields.

For the May 21 ride, Intervals retained:
- activity ID: `i150436808`;
- paired event ID: `111429133`;
- paired event name: `Frequency Spin, Save Friday`;
- paired event fields: original planned workout `description` and structured `workout_doc`.

Tooling:
- `read-paired-event ACTIVITY_ID` reads Intervals' retained planned event description and `workout_doc`.

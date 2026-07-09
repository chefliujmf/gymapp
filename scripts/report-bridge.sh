#!/usr/bin/env bash
# #440/#452/#465 — BRIDGE prod user bug/idea REPORTS → QA so JM triages them on his QA screen.
# The prod + QA backlog stores are SEPARATE (per-env app_meta) and their report numbers COLLIDE (#1000+
# assigned independently per env), so we match by TITLE (dedup) and assign FRESH QA numbers at 5000+.
# Restarts QA ONLY when something new was added (so its in-memory store reloads). Idempotent — safe to cron.
# Runs ON THE XPS HOST (docker exec reaches both DB containers, like scripts/mirror-prod-to-qa.sh).
# Cron: */15 * * * * /home/jmf/gymapp/scripts/report-bridge.sh >> /home/jmf/report-bridge.log 2>&1
set -euo pipefail

docker exec gymapp-db psql -U platyplus -tAc "select coalesce(doc->'backlog'->'added','[]') from app_meta where id=1" > /tmp/rb_prod.json
docker exec gymapp-staging-db psql -U platyplus -tAc "select coalesce(doc->'backlog','{}') from app_meta where id=1" > /tmp/rb_qa.json

ADDED=$(python3 <<'PY'
import json, base64
prod = json.load(open('/tmp/rb_prod.json'))
qa = json.load(open('/tmp/rb_qa.json'))
qa_added = qa.get('added', []); qa_tri = qa.setdefault('triage', {})
have = {(a.get('title') or '').strip().lower() for a in qa_added}
nextn = max([4999] + [a.get('n', 0) for a in qa_added]) + 1   # QA-side reports live at 5000+
added = 0
for r in reversed(prod):                                       # oldest first → stable numbering
    t = (r.get('title') or '').strip()
    if not t or t.lower() in have:
        continue
    qa_added.insert(0, {'n': nextn, 'at': r.get('at'), 'title': t, 'summary': r.get('summary', ''), 'reporter': r.get('reporter', 'prod')})
    qa_tri[str(nextn)] = {'type': 'bug', 'status': 'review', 'comments': []}
    have.add(t.lower()); nextn += 1; added += 1
qa['added'] = qa_added
open('/tmp/rb_out.b64', 'w').write(base64.b64encode(json.dumps(qa).encode()).decode())
print(added)
PY
)

if [ "${ADDED:-0}" -gt 0 ]; then
  B64=$(tr -d '\n' < /tmp/rb_out.b64)
  docker exec gymapp-staging-db psql -U platyplus -c \
    "update app_meta set doc = jsonb_set(doc,'{backlog}', convert_from(decode('$B64','base64'),'utf8')::jsonb) where id=1" >/dev/null
  docker restart gymapp-staging >/dev/null 2>&1
  echo "$(date '+%F %T') report-bridge: +${ADDED} prod report(s) → QA (reloaded)"
else
  echo "$(date '+%F %T') report-bridge: nothing new"
fi
rm -f /tmp/rb_prod.json /tmp/rb_qa.json /tmp/rb_out.b64

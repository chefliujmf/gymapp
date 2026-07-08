#!/usr/bin/env bash
# #441 — mirror the REAL Platyplus data from PROD → QA so QA has real-life stuff to test against.
# Copies each real user's child rows (plans/logs/coach_reviews/checkins/calendar_items) + coach doc fields
# (coachProfile/coachMemory/activityFeedback/info/thresholds) from the prod DB into the QA DB, keyed by
# EMAIL (prod & QA user ids differ, so user_id is remapped in the SELECT).
#
# SAFE BY DESIGN:
#  • QA stays READ-ONLY toward intervals (IS_STAGING) — copying plans never pushes/deletes intervals events.
#  • QA AUTH is preserved — password_hash / api_token / role / icu_key are separate COLUMNS and passkeys are a
#    separate TABLE; none are touched. Only child tables + the doc JSON's coach fields are replaced/merged.
#  • intervals activities already show on QA (it shares athlete i28814 for READS).
# Run ON THE XPS (both DB containers live there). Re-runnable anytime after changes.
set -euo pipefail
EMAILS="jmfiset@gmail.com xenia.fiset@gmail.com"
PDB() { docker exec gymapp-db psql -U platyplus -d platyplus "$@"; }
QDB_EXEC() { docker exec gymapp-staging-db psql -U platyplus -d platyplus "$@"; }        # no stdin
QDB_IN() { docker exec -i gymapp-staging-db psql -U platyplus -d platyplus "$@"; }        # stdin pipe

for EMAIL in $EMAILS; do
  PID=$(PDB -At -c "select id from users where email='$EMAIL'")
  QID=$(QDB_EXEC -At -c "select id from users where email='$EMAIL'")
  if [ -z "$PID" ] || [ -z "$QID" ]; then echo ">> skip $EMAIL (prod=$PID qa=$QID)"; continue; fi
  echo ">> mirroring $EMAIL  (prod $PID -> qa $QID)"
  copy_tbl() { # $1=table  $2=columns after user_id
    QDB_EXEC -c "delete from $1 where user_id='$QID'" >/dev/null
    PDB -At -c "\copy (select '$QID' as user_id, $2 from $1 where user_id='$PID') to stdout" \
      | QDB_IN -c "\copy $1(user_id, $2) from stdin" >/dev/null
    echo "   $1"
  }
  copy_tbl plans "id, date, sport, title, doc"
  copy_tbl logs "sid, date, doc"
  copy_tbl coach_reviews "id, doc"
  copy_tbl checkins "date, doc"
  copy_tbl calendar_items "id, date, doc"
  # merge the coach/state doc fields into QA's doc (auth columns stay put). base64 carries the multi-line
  # coachProfile safely through the shell (no \copy/temp-table meta-command mixing). strip encode()'s wrap newlines.
  B64=$(PDB -At -c "select encode(convert_to((json_build_object('coachProfile',doc->'coachProfile','coachProfileAt',doc->'coachProfileAt','coachMemory',doc->'coachMemory','coachMemoryAt',doc->'coachMemoryAt','activityFeedback',doc->'activityFeedback','info',doc->'info','sportSettings',doc->'sportSettings','statPrefs',doc->'statPrefs','runVdot',doc->'runVdot','maxHR',doc->'maxHR','ftp',doc->'ftp','vo2max',doc->'vo2max'))::text,'UTF8'),'base64') from users where id='$PID'" | tr -d '\n')
  QDB_EXEC -c "update users set doc = coalesce(doc,'{}'::jsonb) || convert_from(decode('$B64','base64'),'UTF8')::jsonb where id='$QID'" >/dev/null
  echo "   coach doc merged"
done

echo ">> restarting QA app (SIGKILL) so it reloads the mirrored data from Postgres"
docker kill gymapp-staging >/dev/null && docker start gymapp-staging >/dev/null
echo ">> done — QA now mirrors prod (auth preserved, intervals untouched)."

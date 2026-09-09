#!/usr/bin/env bash
# bot-watch.sh — Watchdog-Check fuer die AniWebScale-Bots, lokal.
# Prueft: laufen Prozesse, sind Profile aktiv, wie geht es den Worktrees.
# Gibt eine Zeile pro Fakt plus WARN-Zeilen. Fixt nichts, meldet nur.
#
#   ./scripts/bot-watch.sh [--stale-hours N]   default N=24
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILES="$HOME/.hermes/profiles"
STALE_HOURS=24
WARN_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --stale-hours) STALE_HOURS="${2:?}"; shift 2 ;;
    --warn-only) WARN_ONLY=1; shift ;;
    *) shift ;;
  esac
done
if [ "$WARN_ONLY" = 1 ]; then exec > >(grep "^WARN" || true); fi
NOW="$(date +%s)"
STALE_SECS=$((STALE_HOURS * 3600))

age_h() { echo $(( (NOW - $1) / 3600 )); }

echo "# profile: letzte Aktivitaet + laufende Prozesse"
for p in anirouter anibau aniverify; do
  log="$PROFILES/$p/logs/agent.log"
  if [ -f "$log" ]; then
    mtime="$(stat -c %Y "$log")"
    echo "profile $p: agent.log vor $(age_h "$mtime")h"
    if [ $((NOW - mtime)) -gt $((6 * 3600)) ]; then
      echo "WARN profile $p: seit ueber 6h keine Aktivitaet"
    fi
  else
    echo "WARN profile $p: kein agent.log gefunden"
  fi
  procs="$PROFILES/$p/processes.json"
  if [ -f "$procs" ]; then
    n="$(python3 -c "import json;print(len(json.load(open('$procs'))))" 2>/dev/null || echo "?")"
    echo "profile $p: $n Hintergrundprozesse registriert"
  fi
done

echo "# worktrees"
while read -r path branch; do
  [ "$path" = "$REPO" ] && continue
  branch="${branch#refs/heads/}"
  dirty="$(git -C "$path" status --porcelain | wc -l)"
  last_ts="$(git -C "$path" log -1 --format=%ct 2>/dev/null || echo 0)"
  if git -C "$REPO" merge-base --is-ancestor "$branch" main 2>/dev/null; then merged="ja"; else merged="nein"; fi
  # shellcheck disable=SC2086
  echo "worktree $path [$branch]: dirty=$dirty merged=$merged letzter-commit-vor-$(age_h $last_ts)h"
  if [ "$merged" = "nein" ] && [ $((NOW - last_ts)) -gt "$STALE_SECS" ]; then
    echo "WARN worktree $path: ungemergt und seit ueber ${STALE_HOURS}h kein Commit (verwaist?)"
  fi
  if [ "$dirty" -gt 0 ] && [ $((NOW - last_ts)) -gt "$STALE_SECS" ]; then
    echo "WARN worktree $path: $dirty uncommittete Dateien und alter Stand"
  fi
done < <(git -C "$REPO" worktree list --porcelain | awk '/^worktree /{p=$2} /^branch /{print p" "$2}')
echo "# ende: alles ohne WARN = gesund"

#!/usr/bin/env bash
# bot-send.sh — Bot-Nachricht mit Warten und Wiederholen.
# Gegen besetzte Ziele (target_busy): bis zu 6 Versuche mit wachsender Pause.
# usage: bot-send.sh <profil> <chat> <auftragsdatei>
set -euo pipefail

DM_PY="/home/daniel/.hermes/hermes-agent/venv/bin/python3 /home/daniel/.hermes/hermes-agent/tools/bot_mode_dm.py"
profile="${1:?usage: bot-send.sh <profil> <chat> <auftragsdatei>}"
chat="${2:?usage: bot-send.sh <profil> <chat> <auftragsdatei>}"
qf="${3:?usage: bot-send.sh <profil> <chat> <auftragsdatei>}"
[ -f "$qf" ] || { echo "FEHLER: Auftragsdatei fehlt: $qf (tmp wird aufgeraeumt, frisch schreiben)"; exit 2; }

wait_s=60
for i in 1 2 3 4 5 6; do
  # shellcheck disable=SC2086
  out=$($DM_PY --run-delivery query-file "$qf" --profile-home "$HOME/.hermes/profiles/$profile" hermes -p "$profile" chat --in '~' -c "$chat" --create-if-missing -Q 2>&1 | tail -n 8)
  echo "$out"
  if ! grep -q "target_busy" <<<"$out"; then exit 0; fi
  echo "Besetzt, Versuch $i/6, warte ${wait_s}s..."
  sleep "$wait_s"
  wait_s=$((wait_s * 2))
  [ "$wait_s" -gt 600 ] && wait_s=600
done
echo "FEHLER: Ziel blieb besetzt, spaeter erneut versuchen"
exit 1

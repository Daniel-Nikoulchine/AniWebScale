#!/usr/bin/env bash
# task-worktree.sh — Task-Worktrees fuer parallele Bots, lokal statt Remote.
# Ein Worktree pro Task: eigener Pfad, eigener Branch, geteiltes Objektlager.
#
#   ./scripts/task-worktree.sh new <slug> [base]   Worktree + Branch anlegen
#   ./scripts/task-worktree.sh list                alle Worktrees zeigen
#   ./scripts/task-worktree.sh remove <slug> [--force]
#   ./scripts/task-worktree.sh clean               gemergte + saubere Worktrees weg
#
# Regeln: main-Worktree wird nie angefasst. remove verweigert bei
# uncommitteten Aenderungen oder ungemergtem Branch, ausser mit --force.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARENT="$(dirname "$REPO")"
REPONAME="$(basename "$REPO")"
MAIN_BRANCH="main"

die() { echo "FEHLER: $*" >&2; exit 1; }

wt_path_for() { echo "$PARENT/$REPONAME-$1"; }

branch_for() {
  if [[ "$1" == */* ]]; then echo "$1"; else echo "feat/$1"; fi
}

is_dirty() { [ -n "$(git -C "$1" status --porcelain)" ]; }

is_merged() { git -C "$REPO" merge-base --is-ancestor "$1" "$MAIN_BRANCH" 2>/dev/null; }

cmd_new() {
  local slug="${1:?usage: new <slug> [base]}"
  local base="${2:-$MAIN_BRANCH}"
  local path; path="$(wt_path_for "$slug")"
  local branch; branch="$(branch_for "$slug")"
  [ -e "$path" ] && die "Pfad existiert schon: $path"
  git -C "$REPO" rev-parse --verify "$base" >/dev/null 2>&1 || die "Basis unbekannt: $base"
  git -C "$REPO" show-ref --verify --quiet "refs/heads/$branch" && die "Branch existiert schon: $branch"
  git -C "$REPO" worktree add -b "$branch" "$path" "$base"
  echo "OK: $path auf Branch $branch (Basis $base)"
  echo "Naechste Schritte im Worktree:"
  echo "  cd $path && npm ci && npm run generate:presets"
}

cmd_list() {
  git -C "$REPO" worktree list --porcelain | awk '
    /^worktree /{p=$2} /^branch /{b=$2; print p"  ["b"]"}'
}

cmd_remove() {
  local slug="${1:?usage: remove <slug> [--force]}"
  local force="${2:-}"
  local path; path="$(wt_path_for "$slug")"
  [ "$path" = "$REPO" ] && die "Haupt-Worktree wird nie entfernt"
  git -C "$REPO" worktree list --porcelain | grep -q "^worktree $path$" || die "kein Worktree: $path"
  local branch; branch="$(git -C "$path" rev-parse --abbrev-ref HEAD)"
  if [ "$force" != "--force" ]; then
    is_dirty "$path" && die "uncommittete Aenderungen in $path — erst committen oder --force"
    is_merged "$branch" || die "Branch $branch nicht in $MAIN_BRANCH gemergt — erst mergen oder --force"
    git -C "$REPO" worktree remove "$path"
    git -C "$REPO" branch -d "$branch" || true
  else
    git -C "$REPO" worktree remove --force "$path"
    git -C "$REPO" branch -D "$branch" || true
  fi
  echo "OK: $path entfernt, Branch $branch geloescht"
}

cmd_clean() {
  local removed=0 kept=0
  while read -r path branch; do
    [ "$path" = "$REPO" ] && continue
    branch="${branch#refs/heads/}"
    if ! is_dirty "$path" && is_merged "$branch"; then
      git -C "$REPO" worktree remove "$path"
      git -C "$REPO" branch -d "$branch" || true
      echo "weg: $path [$branch]"
      removed=$((removed + 1))
    else
      echo "bleibt: $path [$branch] (dirty oder ungemergt)"
      kept=$((kept + 1))
    fi
  done < <(git -C "$REPO" worktree list --porcelain | awk '/^worktree /{p=$2} /^branch /{print p" "$2}')
  echo "Fertig: $removed entfernt, $kept behalten"
}

case "${1:-}" in
  new) shift; cmd_new "$@" ;;
  list) cmd_list ;;
  remove) shift; cmd_remove "$@" ;;
  clean) cmd_clean ;;
  *) die "usage: $0 {new|list|remove|clean}" ;;
esac

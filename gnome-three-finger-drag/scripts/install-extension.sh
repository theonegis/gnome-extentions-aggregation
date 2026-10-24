#!/bin/sh
set -eu

uuid='three-finger-drag@example.local'
script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
source_dir=$(dirname -- "$script_dir")/extension
target_dir=${XDG_DATA_HOME:-"$HOME/.local/share"}/gnome-shell/extensions/$uuid

mkdir -p "$target_dir"
cp "$source_dir/extension.js" "$source_dir/metadata.json" "$source_dir/prefs.js" "$target_dir/"
printf 'Installed extension to %s\n' "$target_dir"
printf 'Log out and back in, then enable %s\n' "$uuid"

#!/usr/bin/env bash
# Native Linux launcher. In Steam use /usr/bin/bash as the target, with this
# script and the AppImage as quoted launch options. Leave Proton disabled.
set -u
umask 077

clean_runtime=false
if [[ ${1:-} == --clean-runtime ]]; then clean_runtime=true; shift; fi
if [[ $# -lt 1 ]]; then
  printf 'Uso: bash PodcastSteam-Steam.sh [--clean-runtime] "/ruta/PodcastSteam.AppImage" [argumentos de la app]\n' >&2
  exit 64
fi

image=$1
shift
if [[ ! -f "$image" || ! -x "$image" ]]; then
  printf 'No se encuentra el AppImage o no tiene permiso de ejecución: %s\n' "$image" >&2
  exit 66
fi
image_dir=$(cd -- "$(dirname -- "$image")" && pwd -P) || exit 66
image="$image_dir/$(basename -- "$image")"
state_dir="${XDG_STATE_HOME:-${HOME:?}/.local/state}/PodcastSteam"
mkdir -p -- "$state_dir" || exit 73
log="$state_dir/steam-launch.log"
if [[ -f "$log" ]]; then mv -f -- "$log" "$log.previous" || exit 73; fi
exec >>"$log" 2>&1

printf 'PodcastSteam native Steam launcher\n'
printf 'Date: %s\n' "$(date -u +%FT%TZ)"
printf 'Architecture: %s\n' "$(uname -m)"
printf 'Clean runtime: %s\n' "$clean_runtime"
if [[ -f /.flatpak-info ]]; then printf 'Flatpak container: yes\n'; else printf 'Flatpak container: no\n'; fi
# Presence only: do not dump the environment, credentials or user arguments.
for name in LD_PRELOAD LD_LIBRARY_PATH STEAM_RUNTIME DISPLAY WAYLAND_DISPLAY XDG_SESSION_TYPE; do
  if [[ -v $name ]]; then printf '%s: present\n' "$name"; else printf '%s: absent\n' "$name"; fi
done

cd -- "$image_dir" || exit 66
if "$clean_runtime"; then
  # Optional experiment: remove Steam-injected overlay/library overrides only
  # for this child. Do not alter Steam, drivers, the system, or the sandbox.
  env -u LD_PRELOAD -u LD_LIBRARY_PATH "$image" "$@"
else
  "$image" "$@"
fi
status=$?
printf '\nApplication exit status: %s\n' "$status"
exit "$status"

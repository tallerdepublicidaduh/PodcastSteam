#!/usr/bin/env bash
# Source this file from Bash in the Codex cloud workspace, not on personal PCs.
export npm_config_cache=/workspace/.cache/podcaststeam/npm
export XDG_CACHE_HOME=/workspace/.cache
export XDG_CONFIG_HOME=/workspace/.cache/podcaststeam/config
export ELECTRON_BUILDER_CACHE=/workspace/.cache/podcaststeam/builder
export NODE_USE_ENV_PROXY=1
mkdir -p "$npm_config_cache" "$XDG_CONFIG_HOME"
if ! xdpyinfo >/dev/null 2>&1; then
  export DISPLAY=:99
  if ! xdpyinfo >/dev/null 2>&1; then
    cat > /tmp/podcaststeam-xorg.conf <<'EOF'
Section "ServerFlags"
 Option "AutoAddDevices" "false"
 Option "AutoEnableDevices" "false"
EndSection
Section "Device"
 Identifier "Dummy"
 Driver "dummy"
 VideoRam 256000
EndSection
Section "Monitor"
 Identifier "Monitor"
 HorizSync 5.0-1000.0
 VertRefresh 5.0-200.0
 Modeline "1280x800" 83.5 1280 1352 1480 1680 800 803 809 831
EndSection
Section "Screen"
 Identifier "Screen"
 Device "Dummy"
 Monitor "Monitor"
 DefaultDepth 24
 SubSection "Display"
  Depth 24
  Modes "1280x800"
 EndSubSection
EndSection
EOF
    /usr/lib/xorg/Xorg "$DISPLAY" -config /tmp/podcaststeam-xorg.conf -logfile /tmp/podcaststeam-xorg.log -nolisten tcp -noreset > /tmp/podcaststeam-xorg-start.log 2>&1 &
    for attempt in {1..30}; do
      if xdpyinfo >/dev/null 2>&1; then break; fi
      sleep 0.1
    done
    if ! xdpyinfo >/dev/null 2>&1; then
      echo 'No se pudo iniciar la pantalla virtual. Revisa /tmp/podcaststeam-xorg.log.' >&2
      return 1
    fi
  fi
fi

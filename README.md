# Sonos Remote for Home Assistant

Sonos Remote is a mobile-first Home Assistant remote with a Lovelace frontend and a companion backend integration.

The Now Playing header includes quick access to the Music Assistant UI and a persistent **Fixed-volume Sonos** selector. Mark any Sonos entity that uses fixed line-out so the card hides its volume control while leaving normal Sonos speakers fully adjustable.

## v0.5.3

This first version establishes the combined architecture.

### Backend
- Home Assistant custom integration at `custom_components/sonos_remote`
- UI config flow
- Depends on Home Assistant's native Sonos integration
- Serves the bundled Lovelace card locally
- Provides the first `sonos_remote/info` WebSocket endpoint for richer frontend/backend communication

### Frontend
- iPhone-first single-column layout
- Now Playing artwork and metadata
- Play/pause, previous and next
- Volume control
- Current group display
- Four standard internal views: Now Playing, Rooms, Music and Queue\n- A fifth **My Music** tab appears automatically when Music Assistant is configured\n- My Music browses MA music sources and their folders in-place, with Play Now / Play Next / Add to Queue actions\n- Now Playing → ⋮ → **My Music services** lets you choose which MA sources appear in My Music; selections persist across restarts\n- My Music caches visited browse levels for faster back-and-forth navigation and provides a Home button to jump directly to its root\n- Music Assistant's synthetic parent/root browse rows are handled by the card rather than exposed as provider subpaths
- Home Assistant theme support
- Rooms, Music and Queue are the next implementation stages

## Install with HACS

Add this repository as a custom HACS **Integration** repository and download it.

Restart Home Assistant, then go to **Settings → Devices & services → Add Integration → Sonos Remote**.

The integration serves the card at:

`/sonos_remote/sonos-remote-card.js`

Until automatic Lovelace resource registration is added, add that URL once under Dashboard Resources as a **JavaScript Module**.

Then add the card:

```yaml
type: custom:sonos-remote-card
```

Optional explicit player configuration:

```yaml
type: custom:sonos-remote-card
entities:
  - media_player.living_room
  - media_player.kitchen
default_player: media_player.living_room
```

## Architecture

The native Home Assistant Sonos integration remains responsible for normal speaker control. Sonos Remote adds a purpose-built mobile UI and a lightweight backend for features that are awkward or unavailable through the generic `media_player` frontend API.

Planned backend-assisted features include room/group management, Sonos Favorites/media browsing, queue access and manipulation, capability discovery, and richer search where Home Assistant/Sonos expose it.

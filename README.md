# HA Sonos Remote

A mobile-first Sonos remote card for Home Assistant, designed around a one-column Companion App experience.

## v0.1.0

Initial functional shell:

- Sonos player auto-discovery
- Optional explicit entity list
- Now Playing artwork and metadata
- Play/pause, previous and next
- Volume control
- Current group display
- Four-view navigation: Now Playing, Rooms, Music and Queue
- Home Assistant theme support
- Mobile-first layout capped at 430 px on wider dashboards
- No product or installer branding

## Installation (development)

Add `sonos-remote-card.js` as a Lovelace JavaScript module, then add:

```yaml
type: custom:sonos-remote-card
```

Optional:

```yaml
type: custom:sonos-remote-card
entities:
  - media_player.living_room
  - media_player.kitchen
default_player: media_player.living_room
```

## Roadmap

1. Rooms: grouping/ungrouping and per-room volume
2. Music: Sonos Favorites and Home Assistant media browsing
3. Queue: current/up-next queue management
4. Optional Music Assistant enhancements
5. HACS release packaging

## Design principles

The card should feel native to Home Assistant, remain usable with one thumb on iPhone, inherit HA light/dark themes, and avoid requiring Music Assistant for core Sonos control.

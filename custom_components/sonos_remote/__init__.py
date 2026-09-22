from __future__ import annotations

from pathlib import Path

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .const import CARD_URL, DOMAIN, VERSION


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend_path = Path(__file__).parent / "www" / "sonos-remote-card.js"
    domain_data = hass.data.setdefault(DOMAIN, {})

    if not domain_data.get("static_registered"):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(CARD_URL, str(frontend_path), False)]
        )
        domain_data["static_registered"] = True

    if not domain_data.get("ws_registered"):
        websocket_api.async_register_command(hass, websocket_sonos_remote_info)
        websocket_api.async_register_command(hass, websocket_sonos_remote_search)
        websocket_api.async_register_command(hass, websocket_sonos_remote_play)
        domain_data["ws_registered"] = True

    frontend = hass.data.get("frontend")
    if frontend is not None:
        extra_modules = getattr(frontend, "extra_modules", None)
        if extra_modules is not None:
            extra_modules.add(f"{CARD_URL}?v={VERSION}")

    domain_data[entry.entry_id] = {}
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True


def _platform_entities(hass: HomeAssistant, platform: str) -> list[str]:
    registry = er.async_get(hass)
    return sorted(
        entity.entity_id
        for entity in registry.entities.values()
        if entity.platform == platform and entity.domain == "media_player"
    )


def _sonos_entities(hass: HomeAssistant) -> list[str]:
    return _platform_entities(hass, "sonos")


def _ma_entry(hass: HomeAssistant):
    entries = hass.config_entries.async_entries("music_assistant")
    return entries[0] if entries else None


def _ma_players(hass: HomeAssistant) -> list[dict]:
    players = []
    for entity_id in _platform_entities(hass, "music_assistant"):
        state = hass.states.get(entity_id)
        if state is None:
            continue
        players.append(
            {
                "entity_id": entity_id,
                "name": state.attributes.get("friendly_name", entity_id),
                "state": state.state,
            }
        )
    return players


def _ma_player_for_sonos(hass: HomeAssistant, sonos_entity_id: str) -> str | None:
    sonos = hass.states.get(sonos_entity_id)
    if sonos is None:
        return None
    sonos_name = str(sonos.attributes.get("friendly_name", "")).strip().casefold()
    if not sonos_name:
        return None

    exact = []
    contains = []
    for player in _ma_players(hass):
        ma_name = str(player["name"]).strip().casefold()
        if ma_name == sonos_name:
            exact.append(player["entity_id"])
        elif sonos_name in ma_name or ma_name in sonos_name:
            contains.append(player["entity_id"])
    if len(exact) == 1:
        return exact[0]
    if len(contains) == 1:
        return contains[0]
    return None


@websocket_api.websocket_command({"type": "sonos_remote/info"})
@websocket_api.async_response
async def websocket_sonos_remote_info(hass, connection, msg):
    players = []
    for entity_id in _sonos_entities(hass):
        state = hass.states.get(entity_id)
        if state is None:
            continue
        attrs = state.attributes
        players.append(
            {
                "entity_id": entity_id,
                "name": attrs.get("friendly_name", entity_id),
                "state": state.state,
                "group_members": attrs.get("group_members", [entity_id]),
                "volume_level": attrs.get("volume_level"),
                "music_assistant_player": _ma_player_for_sonos(hass, entity_id),
            }
        )

    ma_entry = _ma_entry(hass)
    connection.send_result(
        msg["id"],
        {
            "version": VERSION,
            "players": players,
            "music_assistant": {
                "available": ma_entry is not None
                and hass.services.has_service("music_assistant", "search"),
                "config_entry_id": ma_entry.entry_id if ma_entry else None,
                "players": _ma_players(hass),
            },
        },
    )


@websocket_api.websocket_command(
    {
        "type": "sonos_remote/search",
        vol.Required("query"): str,
        vol.Optional("limit", default=5): vol.All(int, vol.Range(min=1, max=20)),
    }
)
@websocket_api.async_response
async def websocket_sonos_remote_search(hass, connection, msg):
    ma_entry = _ma_entry(hass)
    if ma_entry is None or not hass.services.has_service("music_assistant", "search"):
        connection.send_error(msg["id"], "music_assistant_unavailable", "Music Assistant integration is not available")
        return

    response = await hass.services.async_call(
        "music_assistant",
        "search",
        {
            "config_entry_id": ma_entry.entry_id,
            "name": msg["query"],
            "media_type": ["artist", "album", "track", "playlist", "radio"],
            "limit": msg["limit"],
            "library_only": False,
        },
        blocking=True,
        return_response=True,
    )
    connection.send_result(msg["id"], response or {})


@websocket_api.websocket_command(
    {
        "type": "sonos_remote/play",
        vol.Required("sonos_entity_id"): str,
        vol.Required("media_id"): str,
        vol.Optional("media_type"): str,
        vol.Optional("enqueue", default="replace"): vol.In(
            ["play", "replace", "next", "replace_next", "add"]
        ),
    }
)
@websocket_api.async_response
async def websocket_sonos_remote_play(hass, connection, msg):
    ma_player = _ma_player_for_sonos(hass, msg["sonos_entity_id"])
    if ma_player is None:
        connection.send_error(
            msg["id"],
            "music_assistant_player_not_found",
            "No unique Music Assistant player matches the selected Sonos room",
        )
        return

    data = {
        "media_id": msg["media_id"],
        "enqueue": msg["enqueue"],
    }
    if msg.get("media_type"):
        data["media_type"] = msg["media_type"]

    await hass.services.async_call(
        "music_assistant",
        "play_media",
        data,
        target={"entity_id": ma_player},
        blocking=True,
    )
    connection.send_result(msg["id"], {"player": ma_player})

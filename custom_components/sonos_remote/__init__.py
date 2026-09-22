from __future__ import annotations

from pathlib import Path

from homeassistant.components import websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CARD_URL, DOMAIN

PLATFORMS: list[str] = []


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend_path = Path(__file__).parent / "www" / "sonos-remote-card.js"

    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(frontend_path), False)]
    )

    if not hass.data.setdefault(DOMAIN, {}).get("ws_registered"):
        websocket_api.async_register_command(hass, websocket_sonos_remote_info)
        hass.data[DOMAIN]["ws_registered"] = True

    hass.data[DOMAIN][entry.entry_id] = {}
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True


@websocket_api.websocket_command({"type": "sonos_remote/info"})
@websocket_api.async_response
async def websocket_sonos_remote_info(hass, connection, msg):
    players = []
    for state in hass.states.async_all("media_player"):
        attrs = state.attributes
        if (
            attrs.get("platform") == "sonos"
            or "sonos_group" in attrs
            or "group_members" in attrs
        ):
            players.append(
                {
                    "entity_id": state.entity_id,
                    "name": attrs.get("friendly_name", state.entity_id),
                    "state": state.state,
                    "group_members": attrs.get("group_members", attrs.get("sonos_group", [])),
                }
            )

    connection.send_result(msg["id"], {"version": "0.1.0", "players": players})

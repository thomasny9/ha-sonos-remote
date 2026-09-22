from __future__ import annotations

from pathlib import Path

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
        domain_data["ws_registered"] = True

    # Load the bundled card for all dashboards without requiring a manually
    # configured Lovelace resource.
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


def _sonos_entities(hass: HomeAssistant) -> list[str]:
    registry = er.async_get(hass)
    ids = [
        entity.entity_id
        for entity in registry.entities.values()
        if entity.platform == "sonos" and entity.domain == "media_player"
    ]
    return sorted(ids)


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
            }
        )
    connection.send_result(msg["id"], {"version": VERSION, "players": players})

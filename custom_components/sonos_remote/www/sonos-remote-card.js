class SonosRemoteCard extends HTMLElement {
  setConfig(config) {
    this.config = config || {};
    this._view = this._view || "now";
    this._selectedRooms = this._selectedRooms || new Set();\n    this._maResults = this._maResults || null;\n    this._maLoading = false;\n    this._backendInfo = this._backendInfo || null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }
  set hass(hass) {
    this._hass = hass;
    this._players = this._backendInfo?.players?.map(p=>hass.states[p.entity_id]).filter(Boolean) || this._discoverPlayers(hass);\n    if (!this._infoLoading) this._loadBackendInfo();
    this._selected = this._selected && hass.states[this._selected]
      ? this._selected : (this.config.default_player || this._players[0]?.entity_id);
    if (!this._selectedRooms.size) (this._hass.states[this._selected]?.attributes?.group_members || [this._selected]).filter(Boolean).forEach(id => this._selectedRooms.add(id));
    this._render();
  }
  getCardSize() { return 8; }\n  async _loadBackendInfo() {\n    if (!this._hass || this._infoLoading) return;\n    this._infoLoading = true;\n    try {\n      this._backendInfo = await this._hass.callWS({type:"sonos_remote/info"});\n      this._players = (this._backendInfo.players||[]).map(p=>this._hass.states[p.entity_id]).filter(Boolean);\n    } catch(e) { console.warn("Sonos Remote backend info unavailable",e); }\n    finally { this._infoLoading=false; this._render(); }\n  }\n  async _searchMA(query) {\n    if (!query?.trim() || this._maLoading) return;\n    this._maLoading=true; this._maResults=null; this._render();\n    try { this._maResults=await this._hass.callWS({type:"sonos_remote/search",query:query.trim(),limit:5}); }\n    catch(e) { this._maResults={error:e?.message||"Music Assistant search failed"}; }\n    finally { this._maLoading=false; this._render(); }\n  }\n  _maResultsHtml() {\n    if(this._maLoading)return `<div class="mahint">Searching Music Assistant…</div>`;\n    if(!this._maResults)return `<div class="mahint">Search Apple Music, Spotify and your Music Assistant library.</div>`;\n    if(this._maResults.error)return `<div class="mahint">${this._esc(this._maResults.error)}</div>`;\n    const groups=[["tracks","Tracks","track","mdi:music-note"],["albums","Albums","album","mdi:album"],["artists","Artists","artist","mdi:account-music"],["playlists","Playlists","playlist","mdi:playlist-music"],["radio","Radio","radio","mdi:radio"]];\n    let html="";\n    for(const [key,label,type,icon] of groups){const items=this._maResults[key]||[];if(!items.length)continue;html+=`<div class="sectiontitle">${label}</div>`+items.map(item=>{const uri=item.uri||item.media_content_id||"";const provider=uri.includes("://")?uri.split("://")[0]:"Music Assistant";const sub=item.artist||item.artist_name||item.album||item.album_name||provider;return `<button class="fav maitem" data-ma-uri="${this._esc(uri)}" data-ma-type="${type}"><span class="favart"><ha-icon icon="${icon}"></ha-icon></span><span><span class="favname">${this._esc(item.name||item.title||"Unknown")}</span><span class="favsub">${this._esc(sub)}</span></span><ha-icon icon="mdi:play"></ha-icon></button>`}).join("");}\n    return html||`<div class="mahint">No results found.</div>`;\n  }
  _discoverPlayers(hass) {
    const configured = this.config.entities || [];
    if (configured.length) return configured.map(id => hass.states[id]).filter(Boolean);
    return Object.values(hass.states).filter(s => s.entity_id.startsWith("media_player.") &&
      (s.attributes.platform === "sonos" || Array.isArray(s.attributes.sonos_group) ||
       (s.attributes.device_class === "speaker" && "group_members" in s.attributes)));
  }
  _call(service, data={}) {
    if (!this._selected) return;
    return this._hass.callService("media_player", service, {entity_id:this._selected, ...data});
  }
  _esc(v) { const d=document.createElement("div"); d.textContent=v||""; return d.innerHTML; }
  _tab(id,icon,label) {
    return `<button class="tab ${this._view===id?"active":""}" data-view="${id}"><ha-icon icon="${icon}"></ha-icon><span>${label}</span></button>`;
  }
  _favoritesHtml() {
    const sensor=Object.values(this._hass.states).find(s=>s.entity_id.startsWith("sensor.")&&s.entity_id.includes("sonos_favorites"));
    const items=sensor?.attributes?.items||{};
    const entries=Object.entries(items);
    if(!entries.length)return '<div class="artist">Enable the Sonos Favorites sensor to show My Sonos favorites here.</div>';
    return entries.map(([id,name])=>`<button class="fav" data-favorite="${this._esc(id)}"><span class="favart"><ha-icon icon="mdi:heart"></ha-icon></span><span><span class="favname">${this._esc(name)}</span><span class="favsub">Sonos Favorite</span></span><ha-icon icon="mdi:play"></ha-icon></button>`).join("");
  }
  _render() {
    if (!this.shadowRoot || !this._hass) return;
    const st=this._hass.states[this._selected], a=st?.attributes||{};
    const title=a.media_title||"Nothing playing", artist=a.media_artist||"", album=a.media_album_name||"";
    const art=a.entity_picture?this._hass.hassUrl(a.entity_picture):"", playing=st?.state==="playing";
    const volume=Math.round((a.volume_level||0)*100);
    const members=a.group_members||a.sonos_group||[this._selected].filter(Boolean);
    const rooms=members.map(id=>this._hass.states[id]?.attributes?.friendly_name||id).join(" + ");
    this.shadowRoot.innerHTML=`
    <style>
      :host{display:block} ha-card{overflow:hidden;border-radius:22px;background:var(--ha-card-background,var(--card-background-color));color:var(--primary-text-color)}
      .wrap{padding:18px 18px 8px}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.top h1{font-size:28px;margin:0}.top button{width:42px;height:42px;border-radius:50%;background:var(--secondary-background-color)}.art,.placeholder{aspect-ratio:1/1;width:100%;border-radius:18px;background:var(--secondary-background-color)}
      .art{object-fit:cover;display:block}.placeholder{display:grid;place-items:center;font-size:64px;opacity:.65}
      h2{margin:18px 0 3px;font-size:26px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .artist,.album{color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.album{font-size:13px;margin-top:3px}
      .controls{display:grid;grid-template-columns:1fr 1fr 1.2fr 1fr 1fr;align-items:center;margin:18px 18px 12px}
      button{appearance:none;border:0;background:none;color:inherit;min-height:48px;cursor:pointer}.activecmd{color:var(--primary-color)}.main{width:68px;height:68px;border:1px solid var(--divider-color);border-radius:50%;justify-self:center;font-size:27px}.skip{font-size:25px}
      .volume{display:grid;grid-template-columns:28px 1fr 38px;gap:8px;align-items:center;margin:0 18px 18px}.volume input{width:100%}
      .group{margin:0 18px 18px;padding:13px 14px;border-radius:14px;background:var(--secondary-background-color);cursor:pointer}.group small{display:block;color:var(--secondary-text-color);margin-bottom:3px}
      .tabs{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--divider-color);padding:7px 4px calc(7px + env(safe-area-inset-bottom))}
      .tab{font-size:11px;opacity:.62;display:flex;flex-direction:column;gap:4px;align-items:center}.tab.active{opacity:1;color:var(--primary-color)}.tab ha-icon{--mdc-icon-size:22px}
      .rooms{padding:18px}.roomhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.roomhead h1{margin:0;font-size:28px}.room{display:grid;grid-template-columns:36px 1fr 28px;gap:10px;align-items:center;padding:12px 8px;border:1px solid var(--divider-color);border-radius:14px;margin-bottom:8px;background:var(--secondary-background-color)}.check{width:28px;height:28px;border:1px solid var(--secondary-text-color);border-radius:8px;display:grid;place-items:center}.check.on{background:var(--primary-color);border-color:var(--primary-color);color:white}.roomname{font-weight:600}.roomsub{font-size:12px;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.roomvol{display:grid;grid-template-columns:1fr 34px;gap:8px;align-items:center;margin-top:7px}.roomvol input{width:100%}.apply{width:100%;height:50px;border-radius:25px!important;background:var(--primary-color)!important;color:white!important;font-weight:600;margin-top:10px}.music{padding:18px}.search{display:grid;grid-template-columns:24px 1fr;gap:8px;align-items:center;background:var(--secondary-background-color);border-radius:14px;padding:11px 13px;margin-bottom:16px}.search input{border:0;outline:0;background:transparent;color:var(--primary-text-color);font:inherit;width:100%}.sectiontitle{font-size:18px;font-weight:700;margin:18px 0 10px}.fav{display:grid;grid-template-columns:48px 1fr 28px;gap:10px;align-items:center;padding:10px;border-radius:14px;background:var(--secondary-background-color);margin-bottom:8px}.favart{width:48px;height:48px;border-radius:8px;background:var(--card-background-color);display:grid;place-items:center}.favname{font-weight:600}.favsub{font-size:12px;color:var(--secondary-text-color)}.mahint{padding:12px 4px;color:var(--secondary-text-color);font-size:13px}.maitem{text-align:left;width:100%}.stub{min-height:520px;padding:20px}.stub h2{margin-top:0}@media(min-width:600px){ha-card{max-width:430px;margin:auto}}
    </style><ha-card>
    ${this._view==="now"?`<div class="wrap"><div class="top"><h1>Now Playing</h1><button><ha-icon icon="mdi:dots-horizontal"></ha-icon></button></div>${art?`<img class="art" src="${art}" alt="">`:`<div class="placeholder">♫</div>`}<h2>${this._esc(title)}</h2><div class="artist">${this._esc(artist)}</div><div class="album">${this._esc(album)}</div></div>
    <div class="controls"><button class="${a.shuffle?"activecmd":""}" data-action="shuffle"><ha-icon icon="mdi:shuffle-variant"></ha-icon></button><button class="skip" data-action="previous"><ha-icon icon="mdi:skip-previous"></ha-icon></button><button class="main" data-action="toggle"><ha-icon icon="${playing?"mdi:pause":"mdi:play"}"></ha-icon></button><button class="skip" data-action="next"><ha-icon icon="mdi:skip-next"></ha-icon></button><button class="${a.repeat&&a.repeat!=="off"?"activecmd":""}" data-action="repeat"><ha-icon icon="${a.repeat==="one"?"mdi:repeat-once":"mdi:repeat"}"></ha-icon></button></div>
    <div class="volume"><button data-action="mute"><ha-icon icon="${a.is_volume_muted?"mdi:volume-off":"mdi:volume-medium"}"></ha-icon></button><input id="vol" type="range" min="0" max="100" value="${volume}"><span>${volume}</span></div>
    <div class="group" data-view="rooms"><small>Playing in</small>${this._esc(rooms||"Select a room")} ›</div>`:
    this._view==="rooms"?`<div class="rooms"><div class="roomhead"><h1>Rooms</h1><button class="round"><ha-icon icon="mdi:dots-horizontal"></ha-icon></button></div>${this._players.map(p=>{const pa=p.attributes||{},v=Math.round((pa.volume_level||0)*100),on=this._selectedRooms.has(p.entity_id);return `<div class="room"><button class="check ${on?"on":""}" data-room="${p.entity_id}">${on?"✓":""}</button><div><div class="roomname">${this._esc(pa.friendly_name||p.entity_id)}</div><div class="roomsub">${this._esc(pa.media_title||"Not Playing")}</div><div class="roomvol"><input data-roomvol="${p.entity_id}" type="range" min="0" max="100" value="${v}"><span>${v}</span></div></div><ha-icon icon="mdi:dots-horizontal"></ha-icon></div>`}).join("")}<button class="apply" id="apply">Apply to ${this._selectedRooms.size} Room${this._selectedRooms.size===1?"":"s"}</button></div>`:this._view==="music"?`<div class="music"><div class="roomhead"><h1>Music</h1><button class="round"><ha-icon icon="mdi:dots-horizontal"></ha-icon></button></div><label class="search"><ha-icon icon="mdi:magnify"></ha-icon><input id="musicsearch" placeholder="Search Music Assistant" value="${this._esc(this._lastSearch||"")}"></label>${this._backendInfo?.music_assistant?.available?`<div id="maresults">${this._maResultsHtml()}</div>`:`<div class="mahint">Music Assistant is not connected to this Home Assistant instance.</div>`}<div class="sectiontitle">Sonos Favorites</div><div id="favorites">${this._favoritesHtml()}</div></div>`:`<div class="stub"><h2>${this._view[0].toUpperCase()+this._view.slice(1)}</h2><div class="artist">Coming in the next implementation stage</div></div>`}
    <nav class="tabs">${this._tab("now","mdi:music-circle","Now Playing")}${this._tab("rooms","mdi:speaker-multiple","Rooms")}${this._tab("music","mdi:music-note","Music")}${this._tab("queue","mdi:playlist-music","Queue")}</nav></ha-card>`;
    this.shadowRoot.querySelectorAll("[data-view]").forEach(el=>el.onclick=()=>{this._view=el.dataset.view;this._render()});
    this.shadowRoot.querySelector('[data-action="toggle"]')?.addEventListener("click",()=>this._call("media_play_pause"));
    this.shadowRoot.querySelector('[data-action="previous"]')?.addEventListener("click",()=>this._call("media_previous_track"));
    this.shadowRoot.querySelector('[data-action="next"]')?.addEventListener("click",()=>this._call("media_next_track"));
    this.shadowRoot.querySelector('[data-action="shuffle"]')?.addEventListener("click",()=>this._call("shuffle_set",{shuffle:!a.shuffle}));
    this.shadowRoot.querySelector('[data-action="repeat"]')?.addEventListener("click",()=>{const next=a.repeat==="off"?"all":a.repeat==="all"?"one":"off";this._call("repeat_set",{repeat:next});});
    this.shadowRoot.querySelector('[data-action="mute"]')?.addEventListener("click",()=>this._call("volume_mute",{is_volume_muted:!a.is_volume_muted}));
    this.shadowRoot.querySelector("#vol")?.addEventListener("change",e=>this._call("volume_set",{volume_level:Number(e.target.value)/100}));
    this.shadowRoot.querySelectorAll("[data-roomvol]").forEach(el=>el.addEventListener("change",e=>this._hass.callService("media_player","volume_set",{entity_id:e.target.dataset.roomvol,volume_level:Number(e.target.value)/100})));
    this.shadowRoot.querySelectorAll("[data-room]").forEach(el=>el.onclick=()=>{const id=el.dataset.room;this._selectedRooms.has(id)?this._selectedRooms.delete(id):this._selectedRooms.add(id);this._render();});
    this.shadowRoot.querySelectorAll("[data-favorite]").forEach(el=>el.onclick=()=>this._hass.callService("media_player","play_media",{entity_id:this._selected,media_content_type:"favorite_item_id",media_content_id:el.dataset.favorite}));
    this.shadowRoot.querySelector("#musicsearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){const ev=new CustomEvent("hass-notification",{detail:{message:"Local Sonos library search backend is next."},bubbles:true,composed:true});this.dispatchEvent(ev);}});
    this.shadowRoot.querySelector("#openmedia")?.addEventListener("click",()=>{this._hass.navigate?.("/media-browser/browser");});
    this.shadowRoot.querySelector("#apply")?.addEventListener("click",async()=>{const chosen=[...this._selectedRooms];if(!chosen.length)return;const leader=chosen.includes(this._selected)?this._selected:chosen[0];const current=this._hass.states[leader]?.attributes?.group_members||[leader];for(const id of current){if(!chosen.includes(id))await this._hass.callService("media_player","unjoin",{entity_id:id});}const others=chosen.filter(id=>id!==leader);if(others.length)await this._hass.callService("media_player","join",{entity_id:leader,group_members:others});this._selected=leader;});
  }
}
if(!customElements.get("sonos-remote-card")) customElements.define("sonos-remote-card",SonosRemoteCard);
window.customCards=window.customCards||[];
window.customCards.push({type:"sonos-remote-card",name:"Sonos Remote",description:"Mobile-first Sonos remote for Home Assistant."});
console.info("%c SONOS REMOTE %c v0.3.0 ","color:white;background:#03a9f4;font-weight:bold","color:#03a9f4;background:white");

# Home Assistant Device Cards

Compact, device-focused dashboard cards for Home Assistant.
One frontend library, independently configurable cards, no backend integration.

## Cards

### Power Strip

A single compact tile shows the strip icon and `4 On · 2 Off`.
Tap to open a two-column panel with independent outlet controls.

- Any number of existing `switch` and `light` entities.
- Per-outlet names, icons, ordering and optional action confirmation.
- Live on/off/unavailable counts; unavailable outlets cannot be operated.
- Individual service errors displayed in the panel.
- Visual editor with entity selection and reordering.
- No master switch, new entities, automation changes or external network calls.
- Theme-aware styling, keyboard-accessible modal and 32px strip icon.

### Stereo and home theater

- `custom:homepod-stereo-card`: a HomePod or HomePod mini stereo pair.
- `custom:apple-theater-card`: an Apple TV with two or four already configured
  HomePods, ordered front left, front right, rear left, rear right.
- `custom:general-speaker-stereo-card`: a stereo player, such as a Sonos pair.
  Optional left/right entities provide individual status.

Each has a visual editor. The tile opens playback, volume and member status.
Unsupported controls are hidden; unknown volume is never presented as zero.
Commands go to **one player**, never blindly to all members.
By default this is the configured `entity`, with an optional `volume_entity`.
To follow other sources, set `playback_entities` to an ordered list of additional
controllable HA media players (for example a Music Assistant room and native HomePods).
The first playing/buffering source wins, with the primary checked first.
A paused source (or MA's idle state with retained media) is retained for resume;
otherwise the first resumable source is used,
falling back to the primary. Alternate sources use their own volume control;
`volume_entity` applies only to the primary. The dialog identifies the selected player.
Controls remain limited by what the selected HA integration actually supports;
an activity status alone does not guarantee control over every external AirPlay source.
Member buttons open native HA details.

The combined icon is active when a player or speaker is `playing` or `buffering`,
or the optional physical television is powered on.
Paused and idle audio players stay gray; availability alone does not imply playback.
Member icons in the dialog follow their own status independently.
Colors inherit HA's media-player active/inactive theme colors.
For integrations that miss AirPlay activity,
`speaker_state_entities` accepts an optional parallel list of activity entities
(for example HA's Music Assistant players). These affect display only, never
service targets. Native `playing` takes precedence; otherwise an available
activity entity supplies the status, with fallback to the native entity.

```yaml
type: custom:homepod-stereo-card
name: Bedroom Stereo
entity: media_player.bedroom_stereo
model: mini
speakers:
  - media_player.bedroom_left
  - media_player.bedroom_right
```

```yaml
type: custom:apple-theater-card
name: Home Theater
entity: media_player.theater_apple_tv
volume_entity: media_player.theater_audio
television: media_player.theater_tv
playback_entities:
  - media_player.music_assistant_theater
  - media_player.theater_audio
model: homepod
speakers:
  - media_player.front_left
  - media_player.front_right
  - media_player.rear_left
  - media_player.rear_right
```

```yaml
type: custom:general-speaker-stereo-card
name: Stereo
entity: media_player.stereo
```

`television` is an optional details shortcut, not another playback target.
The theater layout describes your existing system. It does not pair speakers,
enable surround sound, synchronize independent players, or claim HA can control
features it does not expose. Select the real playback coordinator yourself.
Community HomePod artwork is MIT-licensed, not Apple's proprietary icons.

## Install with HACS

[![Open repository in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=rz467fzs7d&repository=home-assistant-device-cards&category=plugin)

Add `https://github.com/rz467fzs7d/home-assistant-device-cards` as a custom
repository in HACS, category **Dashboard**, and download the release.
This repository is not yet included in the default HACS catalog.

Check that the dashboard resource is registered once as a JavaScript module:

```text
/hacsfiles/home-assistant-device-cards/home-assistant-device-cards.js
```

Refresh the browser. Add **Power Strip** through the dashboard card picker.
No Home Assistant restart is needed.

## Configuration

```yaml
type: custom:power-strip-card
name: Power Strip
entities:
  - entity: switch.desk_outlet
    name: Monitor
  - entity: light.desk_lamp
    name: Desk Lamp
    icon: mdi:lightbulb
  - entity: switch.appliance_outlet
    name: Appliance
    confirmation: Change appliance power?
```

`entities` also accepts bare entity IDs. `confirmation` accepts a message or
`true`. Names default to `Outlet 1`, `Outlet 2`, etc.
The icon is decorative: its socket count does not represent the actual count.
Actual counts and the controls reflect the configured entities.

## Migrating the standalone card

Existing `custom:power-strip-card` configurations remain compatible.
Remove the old `power-strip-card.js` dashboard resource when adding this library,
then refresh all clients. Do not load both resources together.
The icon is embedded in the bundle; the old separately hosted SVG is no longer required.

## Development

```sh
npm ci
npm run build
npm test
```

Cards live under `src/cards/`; `src/index.js` registers the library.
Add shared utilities only when multiple cards actually need them.
The build emits one self-contained module, including the icon.

## Releases

Use semantic versions. Update `package.json` and lockfile for every release.
Push a matching `vX.Y.Z` tag; GitHub Actions builds, tests and publishes the
downloadable module. HACS updates use GitHub releases.

## License

MIT for code; CC0 for the selected Powerstrip artwork. See [NOTICE.md](NOTICE.md).

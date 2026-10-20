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
Commands go to **one explicitly selected primary player**, never all members.
Volume defaults to that player, or can target a separate `volume_entity`.
Member buttons open native HA details.

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

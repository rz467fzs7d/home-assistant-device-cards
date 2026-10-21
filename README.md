# Home Assistant Device Cards

Compact, device-focused dashboard cards for Home Assistant.
One frontend library, independently configurable cards, no backend integration.

![Power strip, stereo and home theater card overview](docs/images/cards-overview.png)

Screenshots show the actual cards with synthetic demo entities and states.

## Cards

### Washer

`custom:washer-card` shows one compact status tile. Tap it to open Start/Stop,
Delay and estimated finish. Colors and sizing follow the other device cards.
Start sends `wake_up` when sleeping or powered off, waits for a ready state and
Remote Start permission, then sends `start`. Commands are confirmed by live
state updates, with a 30-second timeout per stage and visible cloud errors.
Remote Start must be enabled on the appliance; the card cannot grant permission.
Closing the panel cancels any subsequent commands, not commands already sent.
Power-off wake support depends on the appliance and integration.
No physical outlet is switched, and no program-selection capability is implied.

```yaml
type: custom:washer-card
name: Washer
state_entity: sensor.laundry_washer_current_status
operation_entity: select.laundry_washer_operation
remote_start_entity: binary_sensor.laundry_washer_remote_start
finish_entity: sensor.laundry_washer_remaining_time
delay_entity: number.laundry_washer_delayed_end
```

The official LG ThinQ entity values are supported. `state_entity` and
`operation_entity` are required; the other bindings are optional. `delay_entity`
also accepts an existing `input_select`. A visual editor exposes these bindings.

<img src="docs/images/washer-controls.png" alt="Washer panel showing live state, estimated finish, Start or Stop, and a delay selector" width="390">

### Power Strip

A single compact tile shows the strip icon and `4 On · 2 Off`.
Tap to open a two-column panel with independent outlet controls.

- Any number of existing `switch` and `light` entities.
- Per-outlet names, icons, ordering and optional action confirmation.
- Live on/off/unavailable counts; unavailable outlets cannot be operated.
- Individual service errors displayed in the panel.
- Visual editor with entity selection and reordering.
- Nine artwork options, including Chinese five-hole sockets, staggered layouts,
  decorative USB ports, and left/right power cords.
- No master switch, new entities, automation changes or external network calls.
- Theme-aware styling, keyboard-accessible modal and 32px strip icon.

<img src="docs/images/power-strip-controls.png" alt="Power strip panel with six independently controlled outlets, including a lamp" width="360">

### Stereo and home theater

- `custom:homepod-stereo-card`: a HomePod or HomePod mini stereo pair.
- `custom:apple-theater-card`: an Apple TV with two or four already configured
  HomePods. Two speakers are Left and Right; four speakers are Front Left,
  Front Right, Rear Left and Rear Right.
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
`volume_entity` applies only to the primary. Internal player names are not displayed.
Controls remain limited by what the selected HA integration actually supports;
an activity status alone does not guarantee control over every external AirPlay source.
Member buttons open native HA details.

| HomePod Stereo | Apple Theater |
| --- | --- |
| <img src="docs/images/homepod-stereo-controls.png" alt="HomePod stereo playback and independent left and right status" width="360"> | <img src="docs/images/apple-theater-controls.png" alt="Apple theater playback, speaker status, Apple TV and physical television shortcuts" width="360"> |

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
icon_variant: cn-six-usb
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

Choose **Appearance** in the visual editor, or set `icon_variant`:

| Value | Artwork |
| --- | --- |
| `default` | Original power strip |
| `cn-six-usb` | Six staggered sockets with four decorative USB ports |
| `cn-six` | Six staggered sockets without USB |
| `cn-four-inline` / `cn-five-inline` | Four or five inline sockets |
| `cn-four-cord-left` / `cn-four-cord-right` | Four inline sockets with a left/right cord |
| `cn-five-cord-left` / `cn-five-cord-right` | Five inline sockets with a left/right cord |

All `cn-*` artwork uses Chinese five-hole socket markings. Changing appearance
does not change the number of controls or their entity bindings.

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

Regenerate the documentation screenshots after building:

```sh
node scripts/screenshots.mjs
```

This uses synthetic data and local Chrome (or `PW_CHANNEL=chromium`).
It downloads pinned MDI SVGs for the screenshot fixture only; the cards do not
make those network calls.

## Releases

Use semantic versions. Update `package.json` and lockfile for every release.
Push a matching `vX.Y.Z` tag; GitHub Actions builds, tests and publishes the
downloadable module. HACS updates use GitHub releases.

## License

MIT for code; CC0 for the selected Powerstrip artwork. See [NOTICE.md](NOTICE.md).

# BVideo `.bveffect` format

`.bveffect` is a UTF-8 JSON file containing declarative effect recipes. It cannot execute JavaScript, load remote assets, or invoke native commands. The current `schemaVersion` is `3` (versions `1` and `2` remain supported), and files are limited to 2 MB and 100 effects.

## Top-level fields

```json
{
  "schemaVersion": 3,
  "manifest": {
    "id": "publisher-pack",
    "name": "Publisher Pack",
    "version": "1.0.0",
    "author": "Publisher",
    "description": "Short description"
  },
  "effects": [],
  "signature": {
    "algorithm": "ed25519",
    "publicKeyBase64": "...",
    "signatureBase64": "..."
  }
}
```

`manifest.id` and each local effect `id` use lowercase ASCII letters, digits, `-`, or `_`. Package versions use strict SemVer. Installed effect IDs are namespaced as `manifest.id:effect.id`; a package update cannot be older than the installed version. To install an older version, uninstall the current package first.

## Effect fields

Each effect has `id`, `name`, `category`, `description`, `tags`, `defaultDurationUs`, `defaultText`, `defaultColor`, `defaultAccentColor`, and `recipe`. Colors use six-digit hex notation. Supported categories are `标题`, `强调`, `卡片`, `标注`, `布局`, and `场景`.

Recipe fields and allowed values:

| Field | Values |
| --- | --- |
| `layout` | `highlight`, `number`, `panel`, `underline`, `frame` |
| `entrance` | `slide-left`, `fade-up`, `pop`, `none` |
| `paddingX`, `paddingY` | `0..100` |
| `borderWidth` | `0..20` |
| `borderRadius` | `0..40` |
| `backgroundOpacity` | `0..1` |

Schema v2 recipes can also contain an optional `animation` object:

```json
{
  "durationSeconds": 0.55,
  "easing": "ease-out",
  "keyframes": [
    { "offset": 0, "translateX": 0, "translateY": 35, "scale": 0.88, "rotation": -3 },
    { "offset": 1, "translateX": 0, "translateY": 0, "scale": 1, "rotation": 0 }
  ]
}
```

`durationSeconds` is `0.05..10`; easing supports `linear`, `ease-in`, `ease-out`, and `ease-in-out`. Recipes contain 2 to 16 keyframes with strictly increasing `offset` values from exactly `0` to `1`. Translation is relative to the overlay size (`-400..400` percent), scale is `0.05..5`, and rotation is `-720..720` degrees. The same keyframes are evaluated by the editor preview and FFmpeg export.

## Scene templates

Schema v3 packages can define reusable multi-effect scenes. A scene uses `category: "场景"`, `kind: "scene"`, and a `sceneLayers` array containing 2 to 8 atomic effects from the same package. Nested scenes are rejected. Layer references are automatically namespaced when the package is installed.

```json
{
  "id": "intro-scene",
  "name": "Intro scene",
  "category": "场景",
  "kind": "scene",
  "description": "A title and subtitle combination",
  "tags": ["intro", "subtitle"],
  "defaultDurationUs": 4000000,
  "defaultText": "Main title",
  "defaultColor": "#ffffff",
  "defaultAccentColor": "#47d7ac",
  "recipe": { "layout": "frame", "entrance": "none", "paddingX": 10, "paddingY": 10, "borderWidth": 1, "borderRadius": 2, "backgroundOpacity": 0.2 },
  "sceneLayers": [
    { "effectId": "title", "x": 50, "y": 35, "fontSize": 60, "zIndex": 30 },
    { "effectId": "subtitle", "x": 50, "y": 65, "scale": 0.7, "zIndex": 20, "startRatio": 0.2 }
  ]
}
```

Required layer fields are `effectId`, `x`, `y`, and `zIndex`. Optional fields are `text`, `scale`, `rotation`, `opacity`, `fontSize`, `startRatio`, and `durationRatio`. Installed scene templates participate in the same local subtitle retrieval and cloud AI candidate selection as built-in scenes.

See [`examples/effects/starter-pack.bveffect`](../examples/effects/starter-pack.bveffect) for an installable unsigned example.

## Signature

For a signed package, remove the complete `signature` property and serialize the remaining JSON value with the same compact serialization semantics as `serde_json::to_vec`. Sign those bytes with Ed25519, then store the raw 32-byte public key and raw 64-byte signature as Base64.

The signature proves package integrity and identifies the signing key fingerprint. BVideo does not currently maintain a publisher trust store, so a valid self-signed package is not an endorsement of its author. Unsigned packages require explicit confirmation.

## Project compatibility

When an effect is placed on the timeline or selected by an AI-generated scene, BVideo stores a complete recipe snapshot in project schema v10. Updating or uninstalling its source package therefore does not change existing projects; the snapshot remains available for preview and export.

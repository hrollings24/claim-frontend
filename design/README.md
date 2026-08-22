# Design source

`app-icon-source.png` is the icon as supplied, on a white ground.

`app-icon-full-bleed.png` is the same artwork with the white margin and the corner arcs filled
with the brand navy. iOS masks home screen icons with its own rounded corners, so a white margin
would show as pale slivers around the edge — the shipped icons are generated from the full-bleed
version.

Neither file is under `src/assets`, because everything there is copied into the deployed bundle
and these are megabyte-scale sources nothing links to.

To regenerate the shipped sizes:

```
sips -Z 512 design/app-icon-full-bleed.png --out src/assets/icon/icon-512.png
sips -Z 192 design/app-icon-full-bleed.png --out src/assets/icon/icon-192.png
sips -Z 180 design/app-icon-full-bleed.png --out src/assets/icon/icon-180.png
sips -Z  64 design/app-icon-full-bleed.png --out src/assets/icon/favicon.png
sips -Z 1024 design/app-icon-full-bleed.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
```

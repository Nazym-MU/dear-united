# Textures

Drop a real grass photo here as `grass.jpg` and the History section's pitch
will use it automatically as the playing surface (mowing stripes and lighting
are layered on top of it).

- File: `public/textures/grass.jpg`
- Ideal: a fairly uniform, top-down turf photo, roughly 1500-2500px on the
  long side. It is displayed with `background-size: cover` on a portrait
  pitch (aspect ratio 660:1020), so seamless/tileable is not required.

Until the file exists, a procedural grass fallback (layered green gradients,
alternating mowing stripes, and turbulence noise) is shown instead, so the
missing-file 404 in the console is expected and harmless.

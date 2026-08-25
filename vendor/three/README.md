# Three.js runtime subset

- Upstream package: `three@0.185.1`
- Source: npm package `three`
- License: MIT (`LICENSE.txt`)
- Purpose: lazy-loaded D-CATS product GLB viewer

Only the WebGL module, OrbitControls, GLTF/KTX2/Draco loaders, Meshopt/KTX2/Draco decoders, and their direct helper dependencies are vendored. Example-module imports that referenced the bare `three` package were changed to the local `build/three.module.min.js` path so the static site does not need a bundler or CDN at runtime.

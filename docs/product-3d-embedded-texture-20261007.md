# Embedded GLB textures under the unchanged D-CATS CSP

## Scope and acceptance

Recover accurate color rendering in the common Viewer without regenerating or
changing model files, permissions, authentication, server state, or CSP.
The existing user instruction to finish the Viewer covers this bounded frontend
repair; the private-preview-only pilot remains private.

The pinned GLTFLoader selects ImageBitmapLoader when available. For embedded
images it creates blob URLs, which ImageBitmapLoader reads with fetch. Production
allows blob images in img-src but deliberately not in connect-src. Actual model
preview emitted three fixed GLTFLoader texture-load errors and showed a white
model. The synthetic embedded PNG also appeared white under the same CSP.

## Repair

Use GLTFLoader's register hook to choose TextureLoader for ordinary image
textures. The parser still handles texture coordinates, samplers, color spaces,
flipY and material assignment. KTX2/BasisU uses its original specialized handler.
Keep vendored sources and _headers byte-for-byte unchanged. No globals are
modified and no new resource origins are permitted.

Use a per-Viewer LoadingManager to detect otherwise silently dropped textures.
Dispose partially loaded scenes and fail the preview when a texture fails rather
than displaying an incomplete white model as successful. The surrounding
product page, normal photos and upload/generation state remain independent.

## Verification

- Node product-3D suite: 135 passing tests, including loader/CSP/pinned-parser
  contracts; the original self-contained geometry load remains supported.
- Authoritative search-performance workflow: all 125 Node commands passed,
  including shared UI, version/cache, static build and response-header checks.
- Hidden browser, same access-restricting production CSP (only HTTPS upgrading
  omitted for HTTP loopback): the embedded red/green/blue/yellow PNG renders;
  corrupt PNG fails with a fixed load error instead of a white success.
- Desktop 1280x720 and mobile 390x844: colored rendering and no horizontal
  overflow. Browser-created diagnostics do not use user sessions or real photos.
- Source change: decoder + failure guard and mechanical v1.1.1120 cache/version
  alignment only. No server, data, access policy or other feature logic changes.

## Release and remaining checks

CI must pass on this exact source before merging. Verify the deployed assets,
unchanged CSP and the same saved model's private preview after release.
Successful rendering does not approve geometric accuracy or customer publication.
No new paid generation, image submission, job rearming or model overwrite.
Rollback candidate: frontend main 6994650cd08f51137085ec50d8e5e4b8b66b8a2a;
rollback is not performed by this change. Preserve the saved GLB and ledger.

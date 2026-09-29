# Windows Release

The GitHub Actions workflow at `.github/workflows/release.yml` builds Windows x64 assets when a version tag (`v*`) is pushed. It publishes an NSIS installer and a portable executable to a GitHub Release.

伊埃斯 is the only character-based companion; Forest Flow and Iridescent Opal are shader-based orbs. The repository and Windows packages include the project's fan-made recreation in `assets/pets/eous/` under its separate CC BY-NC-SA 4.0 license. The root MIT license covers source code only. The fan-art license allows non-commercial fan sharing of the creator's original contributions; the original character and related IP belong to miHoYo / HoYoverse and are not licensed by this project. Keep both `spritesheet.webp` and `LICENSE.txt` in every release.

## Publish a version

1. Update `version` in `package.json` and the matching root entry in `package-lock.json`.
2. Update `RELEASE_NOTES.md` with the user-visible changes.
3. Create and push an annotated tag whose version matches `package.json`:

   ```powershell
   git tag -a v1.0.1 -m "斐墨 v1.0.1"
   git push origin v1.0.1
   ```

4. Follow the Windows Release workflow in the repository's Actions tab. On success, the matching GitHub Release contains `Feimo-<version>-Setup-x64.exe`, `Feimo-<version>-Portable-x64.exe`, and `SHA256SUMS.txt`.

## Build locally

On Windows x64 with Node.js 22+:

```powershell
npm ci
npm run dist:win
```

Artifacts are written to `release/`. Other local-only artwork, screenshots and application configuration are excluded from the package.

## Release safety

- Never commit `.env`, `secrets.bin`, user settings, real calendar data, chat history, or local screenshots.
- 伊埃斯 fan-art files are public under `assets/pets/eous/LICENSE.txt`; do not relicense them under MIT or imply that the underlying character/IP is project-owned.
- `lib/pets.local.js`, other local-only art, screenshots, installed skill files, and machine-specific helper scripts are excluded from source control and releases.
- The Windows package includes the 伊埃斯 fan-art pack with its non-commercial license notice. Do not use or distribute the art commercially.
- Initial releases are unsigned; use the published SHA-256 sums to verify downloads.

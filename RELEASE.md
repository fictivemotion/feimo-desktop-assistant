# Windows Release

The GitHub Actions workflow at `.github/workflows/release.yml` builds Windows x64 assets when a version tag (`v*`) is pushed. It publishes an NSIS installer and a portable executable to a GitHub Release.

伊埃斯 is the only companion. Its sprite sheet is not bundled by default. Before publishing a public binary, add an art pack and license that explicitly allow redistribution, then review the `files` allow-list in `package.json` to include only that authorized pack.
The release workflow checks for both `spritesheet.webp` and `LICENSE.txt` and stops if either is missing. Because `.gitignore` and the packaging allow-list currently exclude the local pack, change both only after the license has been reviewed.

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

Artifacts are written to `release/`. Local personal artwork, screenshots and configuration are excluded from the package.

## Release safety

- Never commit `.env`, `secrets.bin`, user settings, real calendar data, chat history, or local screenshots.
- Personal pet artwork under `assets/pets/eous/` and `lib/pets.local.js` are excluded from source control and releases.
- Local QA screenshots, installed skill files, and machine-specific helper scripts are excluded from source control and releases.
- Public binaries must not include the local-only art under `assets/pets/eous/` until a redistribution license is provided and reviewed.
- Initial releases are unsigned; use the published SHA-256 sums to verify downloads.

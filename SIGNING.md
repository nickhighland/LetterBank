# Releasing, signing and notarizing

## Releasing

1. Set `"version"` in `package.json` (for example `1.3.0`) and commit it to `master`.
2. Tag that commit and push the tag:

   ```bash
   git tag v1.3.0
   git push origin v1.3.0
   ```

The **Release** workflow (`.github/workflows/release.yml`) then runs the tests,
builds the Mac app, and publishes a GitHub release with the `.dmg`, the `.zip`
and `latest-mac.yml`. Installed copies find the new version through
`latest-mac.yml`. The workflow stops if the tag and `package.json` disagree.

## Signing and notarizing

Until the secrets below exist, releases are unsigned, as they have been so far:
macOS warns on first open, and the app can only tell people a new version is
out and link to the download.

Once they exist, every release is signed with your Developer ID and notarized
by Apple. macOS opens it without a warning, and the app downloads updates in
the background and offers **Restart to update**. Copies installed before the
first signed release still need that one release downloaded by hand.

### What you need to do (once)

You need a paid Apple Developer Program membership, and you need to be its
Account Holder, because only the Account Holder can create a Developer ID
certificate.

1. **Create the certificate.** In Xcode, open Settings › Accounts, select your
   Apple ID, choose Manage Certificates, click +, and pick
   **Developer ID Application**.
2. **Export it.** In Keychain Access, under My Certificates, right-click
   "Developer ID Application: …", choose Export, save it as a `.p12` file, and
   set a password.
3. **Turn the file into text** for GitHub:

   ```bash
   base64 -i ~/Desktop/DeveloperID.p12 | pbcopy
   ```

4. **Make an app-specific password** at <https://account.apple.com>, under
   Sign-In and Security › App-Specific Passwords. Name it "LetterBank notarize".
5. **Find your Team ID** at <https://developer.apple.com/account>, under
   Membership details. It is 10 characters long.
6. **Add five repository secrets** at GitHub › LetterBank › Settings ›
   Secrets and variables › Actions › New repository secret:

   | Secret                        | Value                                     |
   | ----------------------------- | ----------------------------------------- |
   | `MAC_CERTIFICATE`             | the base64 text from step 3               |
   | `MAC_CERTIFICATE_PASSWORD`    | the password from step 2                  |
   | `APPLE_ID`                    | your Apple ID email                       |
   | `APPLE_APP_SPECIFIC_PASSWORD` | the password from step 4                  |
   | `APPLE_TEAM_ID`               | the Team ID from step 5                   |

Then delete the `.p12` file from your Desktop. The certificate stays in your
keychain.

### Building a signed copy on your Mac instead

With the certificate in your keychain, electron-builder finds it by itself.
Notarization needs the same three values as environment variables:

```bash
APPLE_ID=you@example.com \
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx \
APPLE_TEAM_ID=ABCDE12345 \
npm run electron:build
```

The hardened-runtime entitlements are in `build/entitlements.mac.plist`.

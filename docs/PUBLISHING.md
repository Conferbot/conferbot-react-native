# Publishing to npm

This guide explains how to publish the Conferbot React Native SDK to npm.

## Prerequisites

1. **npm Account**: You need an npm account with publish access to the `@conferbot` organization
2. **Build Passing**: Ensure all tests and lints pass
3. **Clean Working Directory**: Commit all changes before publishing

## Pre-Publishing Checklist

### 1. Run All Checks

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build

# Test (if tests exist)
npm test
```

All commands should pass with **0 errors** and **0 warnings**.

### 2. Update Version

Update the version in `package.json` following [Semantic Versioning](https://semver.org/):

- **Patch** (1.0.X): Bug fixes, minor changes
- **Minor** (1.X.0): New features, backward compatible
- **Major** (X.0.0): Breaking changes

```bash
# Using npm version command (recommended)
npm version patch   # 1.0.0 -> 1.0.1
npm version minor   # 1.0.0 -> 1.1.0
npm version major   # 1.0.0 -> 2.0.0

# This will:
# - Update package.json version
# - Create a git commit
# - Create a git tag
```

Or manually edit `package.json`:

```json
{
  "version": "1.0.1"
}
```

### 3. Update CHANGELOG (Recommended)

Create a `CHANGELOG.md` if it doesn't exist and document changes:

```markdown
# Changelog

## [1.0.1] - 2024-01-15

### Fixed
- Fixed typing indicator animation
- Resolved socket reconnection issue

### Added
- New dark theme
```

### 4. Review What Will Be Published

Check which files will be included in the package:

```bash
npm pack --dry-run
```

This shows exactly what will be published. The `files` array in `package.json` controls this:

```json
{
  "files": [
    "lib",      // Compiled JavaScript + type definitions
    "src",      // Source TypeScript (for sourcemaps)
    "README.md",
    "LICENSE"
  ]
}
```

**What's excluded** (via `.npmignore`):
- `example/` directory
- `tests/` directory
- `docs/` directory
- `.git/`, `.vscode/`, IDE files
- Build configs (tsconfig, eslint, etc)

## Publishing

### Step 1: Login to npm

```bash
npm login
```

Enter your npm credentials. You need publish access to the `@conferbot` organization.

### Step 2: Publish

```bash
# Dry run first (simulate publish without actually doing it)
npm publish --dry-run

# Actually publish
npm publish
```

For a **scoped package** like `@conferbot/react-native`, you need public access:

```bash
npm publish --access public
```

This is already configured in `package.json`:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

### Step 3: Verify Publication

Check that your package is live:

```bash
npm view @conferbot/react-native
```

Or visit: https://www.npmjs.com/package/@conferbot/react-native

### Step 4: Push Git Tags

```bash
git push origin main
git push origin --tags
```

## Installation for Users

Once published, users can install via:

```bash
npm install @conferbot/react-native
# or
yarn add @conferbot/react-native
```

The package includes:
- ✅ Compiled JavaScript (`lib/` directory)
- ✅ TypeScript definitions (`.d.ts` files)
- ✅ Source maps (for debugging)
- ✅ README and LICENSE

## Troubleshooting

### Error: "You do not have permission to publish"

**Solution**: You need to be added as a maintainer of the `@conferbot` organization on npm.

```bash
# Organization owner needs to run:
npm org set conferbot <your-npm-username> developer
```

### Error: "Version already published"

**Solution**: Increment the version in `package.json`:

```bash
npm version patch
npm publish
```

npm doesn't allow republishing the same version.

### Error: "Package name taken"

**Solution**: The package name `@conferbot/react-native` is unique to the `@conferbot` organization. If you don't own the org, choose a different name or create the org first.

### Build Errors Before Publishing

**Solution**: Ensure all dependencies are installed and build passes:

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Updating After Publication

### Patch Release (Bug Fixes)

```bash
# 1. Fix the bug
# 2. Update version
npm version patch

# 3. Publish
npm publish

# 4. Push
git push origin main --tags
```

### Minor Release (New Features)

```bash
# 1. Build new features
# 2. Update docs
# 3. Update version
npm version minor

# 4. Publish
npm publish

# 5. Push
git push origin main --tags
```

### Major Release (Breaking Changes)

```bash
# 1. Make breaking changes
# 2. Update docs with migration guide
# 3. Update version
npm version major

# 4. Publish
npm publish

# 5. Push
git push origin main --tags
```

## Best Practices

1. **Always test before publishing**: Run example app, test all features
2. **Semantic versioning**: Follow semver strictly
3. **Changelog**: Document all changes
4. **Git tags**: Tag each release
5. **README**: Keep installation instructions up to date
6. **Build before publish**: `npm run prepare` runs automatically before publish
7. **Dry run first**: Use `npm publish --dry-run` to verify
8. **Monitor downloads**: Check npm stats after publishing

## Automated Publishing (CI/CD)

For automated publishing via GitHub Actions:

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          registry-url: https://registry.npmjs.org/
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
```

Add your npm token as a GitHub secret: `NPM_TOKEN`

## Quick Reference

```bash
# Full publishing workflow
npm run lint          # Check code quality
npm run type-check    # Check types
npm run build         # Build package
npm version patch     # Bump version
npm publish           # Publish to npm
git push --tags       # Push git tags
```

## Support

- **npm docs**: https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry
- **Semantic versioning**: https://semver.org/
- **Package.json docs**: https://docs.npmjs.com/cli/v10/configuring-npm/package-json

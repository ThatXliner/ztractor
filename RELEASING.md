# Releasing Ztractor

Only `packages/core` is published as **ztractor**. The repository root and
`packages/node` are private workspaces. Do not publish all workspaces.

## Prepare and verify

Use Bun 1.3.14 for offline build/test APIs and Node 22.23.4 for HTTPS, matching the validated toolchain. From the
repository root:

```sh
git submodule update --init --recursive
npm ci
npm run build
npm run check --workspace ztractor
npm run check --workspace ztractor-node
bun test
```

Check that `packages/core/package.json` says `3.0.0`. Keep the npm lockfile's workspace versions in sync
when preparing later releases. Review the [migration notes](./packages/core/CHANGELOG.md)
and commit the release changes before publishing.

## Pack the public package

From the repository root:

```sh
mkdir -p dist/release
cd packages/core
npm pack --pack-destination ../../dist/release
cd ../..
npm publish ./dist/release/ztractor-3.0.0.tgz --dry-run
```

The archive should include `package.json`, `README.md`, `LICENSE`,
`CHANGELOG.md`, and all `dist` files, including the runtime chunks and type
declarations. It must contain version `3.0.0` and no workspace dependencies.
Install this tarball in a clean consumer and run the captured-HTML fixture
with `network: 'deny'` before publishing a rebuilt or modified candidate.

## Publish when ready

These commands upload the package; run them yourself after validation.

```sh
npm login
npm whoami
npm view ztractor versions --json
npm publish ./dist/release/ztractor-3.0.0.tgz --access public --tag latest
```

Run them from the repository root. Your npm account must have permission to
publish `ztractor`; npm may request two-factor authentication. Confirm that
`3.0.0` has not already been published, since npm package versions cannot be
reused. Publish the same tarball you validated rather than an unbuilt source
directory.

After publishing, check `npm view ztractor@3.0.0 version` and install
`ztractor@3.0.0` in a fresh consumer. Create a matching `v3.0.0` git tag and
release notes pointing to the commit used to build the published archive.

Reference: [npm publish documentation](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

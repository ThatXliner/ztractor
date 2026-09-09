# Releasing Ztractor

Only `packages/core` is published as **ztractor**. The repository root and
`packages/node` are private workspaces. Do not publish all workspaces.

## Prepare and verify

Use Bun 1.3.14 and Node 22.22.3, matching the validated toolchain. From the
repository root:

```sh
git submodule update --init --recursive
bun install --frozen-lockfile
bun run build
bun run --filter ztractor check
bun run --filter ztractor-node check
bun test
```

Check that `packages/core/package.json` and the core workspace entry in
`bun.lock` both say `2.0.1`. Keep the lockfile's workspace versions in sync
when preparing later releases. Review the [migration notes](./packages/core/CHANGELOG.md)
and commit the release changes before publishing.

## Pack the public package

From the repository root:

```sh
mkdir -p dist/release
cd packages/core
npm pack --pack-destination ../../dist/release
cd ../..
npm publish ./dist/release/ztractor-2.0.1.tgz --dry-run
```

The archive should include `package.json`, `README.md`, `LICENSE`,
`CHANGELOG.md`, and all `dist` files, including the runtime chunks and type
declarations. It must contain version `2.0.1` and no workspace dependencies.
Install this tarball in a clean consumer and run the captured-HTML fixture
with `network: 'deny'` before publishing a rebuilt or modified candidate.

## Publish when ready

These commands upload the package; run them yourself after validation.

```sh
npm login
npm whoami
npm view ztractor versions --json
npm publish ./dist/release/ztractor-2.0.1.tgz --access public --tag latest
```

Run them from the repository root. Your npm account must have permission to
publish `ztractor`; npm may request two-factor authentication. Confirm that
`2.0.1` has not already been published, since npm package versions cannot be
reused. Publish the same tarball you validated rather than an unbuilt source
directory.

After publishing, check `npm view ztractor@2.0.1 version` and install
`ztractor@2.0.1` in a fresh consumer. Create a matching `v2.0.1` git tag and
release notes pointing to the commit used to build the published archive.

Reference: [npm publish documentation](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

---
status: partial
phase: 06-publish
source: [06-VERIFICATION.md]
started: 2026-03-28T00:00:00Z
updated: 2026-03-28T00:00:00Z
---

## Current Test

awaiting human publishing

## Tests

### 1. Publish ztractor core to npm
expected: `cd packages/core && npm publish` succeeds, package visible at npmjs.com/package/ztractor
result: [pending]

### 2. Publish ztractor-node to npm
expected: `cd packages/node && npm publish` succeeds (after core is live), package visible at npmjs.com/package/ztractor-node
result: [pending]

### 3. Post-publish install test
expected: `mkdir /tmp/ztractor-test && cd /tmp/ztractor-test && npm install ztractor-node && node -e "import('ztractor-node').then(({extractMetadata})=>extractMetadata('https://arxiv.org/abs/2303.08774')).then(r=>console.log(r.items[0].title))"` prints the GPT-4 paper title
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

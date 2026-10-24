# Contributing

Issues and pull requests are welcome. Maintainer time is limited, so review can be slow, and a pull request may be declined if it conflicts with the product's design (see "What not to contribute").

This app needs a backend to do anything useful. The backend is a separate private project and is not part of this repository.

## Run it

```bash
npm install
npm run dev     # development server on port 8082
npm run build
npm run lint
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the backend you want to use.

## Reporting bugs

Open a GitHub Issue. Include:

- What you expected to happen and what actually happened
- Browser and version
- Steps to reproduce

Do not file a security vulnerability as a public issue. See [`SECURITY.md`](SECURITY.md).

## Submitting a pull request

1. **Branch naming**: `fix/short-description` or `feature/short-description`.
2. **Commit messages**: describe why, not just what.
3. **Checks**: run `npm run lint` and `npm run build` before opening the PR. There is no test runner yet, so say in the description how you checked your change.
4. **Scope**: one thing per PR.

## The vendored detection code

Everything under `public/detection/` is copied from the alcoia browser extension by `scripts/sync-detection.mjs`. Do not edit those files here. Changes to them belong in the extension repository, followed by a re-sync.

## What happens to your contribution

Anything merged is licensed under **AGPL-3.0**, the same as the rest of this repository (see [`LICENSE`](LICENSE)). By opening a pull request you agree your contribution is offered under that license. There is no separate CLA.

## What not to contribute

These conflict with the product's principles and will be declined however well they are implemented:

- **Camera or webcam access.**
- **Sending reading content or usage data off the device without a visible disclosure at the point it happens.**
- **Accuracy claims, percentages or benchmark figures** in code, comments or UI copy.
- **Covert monitoring**: no hidden mode that observes a reader without an action of theirs.
- **Rankings or leaderboards** of people.

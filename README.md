# Chat Organizer

A Chrome Manifest V3 extension for incrementally organizing ChatGPT conversations into existing Projects.

## Current status

Milestone 1 is implemented: the WXT React extension provides a ChatGPT-only content adapter, side panel, centralized selectors, and a scan dashboard. Organization and AI classification are intentionally not enabled yet.

## Privacy model

The extension does not include a conversation database. Project membership remains the organization checkpoint inside ChatGPT. Future AI requests will use minimal context and a stateless proxy; raw conversation content must not be persisted or logged.

## Development

```sh
npm install
npm run dev
```

Build a production package with `npm run build`. Load the generated extension from `.output/chrome-mv3` in Chrome's extension developer mode.

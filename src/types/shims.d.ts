// Ambient module shims for packages without TypeScript types in this repo
declare module 'openai'
declare module 'pdf-parse'

// If any other third-party packages cause TS "Cannot find module" errors,
// add them here as temporary shims or install proper type packages.

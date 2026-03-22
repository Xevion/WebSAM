# WebSAM

[![Deploy](https://img.shields.io/badge/demo-websam.xevion.dev-indigo)](https://websam.xevion.dev) [![Built with SvelteKit](https://img.shields.io/badge/SvelteKit-5-ff3e00?logo=svelte&logoColor=white)](https://svelte.dev) [![ONNX Runtime Web](https://img.shields.io/badge/ONNX_Runtime-WebGPU-007CFF?logo=onnx&logoColor=white)](https://onnxruntime.ai) [![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-deployed-F38020?logo=cloudflarepages&logoColor=white)](https://pages.cloudflare.com)

Segment Anything (SAM / SAM 2 / SAM 2.1) running entirely in your browser. No server, no uploads, no API keys. Pick a model, load an image, click to segment.

**[Try it out](https://websam.xevion.dev)**

## How it works

Model weights are downloaded once and cached locally via the Origin Private File System. Inference runs through ONNX Runtime Web -- WebGPU when available, WASM as fallback. Everything happens in a Web Worker so the UI stays responsive.

Point at something and click. Left-click marks foreground, right-click marks background. You can also draw bounding boxes or let it segment the whole image at once.

## Models

| Family | Variants | Size range | Backend |
|--------|----------|------------|---------|
| SAM 2.1 | Tiny, Small, Base+, Large | 145 MB - 878 MB | WebGPU |
| SAM 2 | Tiny, Small, Base+, Large | 148 MB - 869 MB | WebGPU |
| SAM 1 | SlimSAM-77 (INT8) | ~14 MB | WASM (CPU) |

SlimSAM-77 works on any browser. The SAM 2.x models need WebGPU support (Chrome 121+, Edge 121+).

## Stack

SvelteKit 5 (Svelte runes) with PandaCSS, Ark UI, and Comlink for worker communication. Hosted on Cloudflare Pages as a fully static SPA.

## Development

```bash
bun install
bun run dev
```

Model weights go in `models/` (git-ignored). See `src/lib/inference/models.ts` for the expected directory structure.

```bash
bun run check    # type-check
bun run lint     # eslint
bun run format   # biome
bun run build    # production build
```

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `P` | Point mode |
| `B` | Box mode |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Escape` | Clear prompts |
| `D` | Download mask |
| `Shift+D` | Download cutout |
| `?` | Show shortcut help |

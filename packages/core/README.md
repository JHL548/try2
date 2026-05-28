# @jhl548/duplicate-doc-core

`@jhl548/duplicate-doc-core` provides framework-independent types and helpers for duplicate document highlighting.

## Features

- Shared document, range, duplicate point, and editor snapshot types.
- Similarity-based highlight color and CSS class helpers.
- Range normalization and document filtering utilities.
- Plain-text highlight resolution helpers for checking whether a range can still render after edits.
- Tiptap duplicate highlight extension.
- Shared highlight styles via `@jhl548/duplicate-doc-core/style.css`.

## Install

```bash
npm install @jhl548/duplicate-doc-core
```

## Usage

```ts
import {
  DuplicateHighlightExtension,
  filterHighlightsForDocument,
  type DuplicateHighlight,
  type NormalizedDocument
} from "@jhl548/duplicate-doc-core";
import { hasResolvableHighlightInPlainText } from "@jhl548/duplicate-doc-core/highlight-resolution";
import "@jhl548/duplicate-doc-core/style.css";
```

This package is intended to be consumed directly by framework adapters such as `@jhl548/duplicate-doc-vue`, or by applications that need access to the shared duplicate document model.

Use `hasResolvableHighlightInPlainText(plainText, highlight)` from the pure `highlight-resolution` subpath before switching documents when the app needs to know whether at least one highlight range can still be resolved in the current edited text.

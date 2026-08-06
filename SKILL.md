---
name: squeeze-ai
description: The enterprise context compression layer for Claude & AI agents. Use to shrink large JSON payloads, AST code, logs, and long pastes locally by 60-95% to save context headroom.
---

# SQUEEZE AI — Context Compression Skill for Claude

When analyzing large codebases, JSON API payloads, long terminal logs, or past conversations, follow these SQUEEZE AI principles:

## Core Compression Guidelines
1. **JSON Compression (JSON Crusher)**:
   - Minify whitespace and line breaks.
   - Remove null, empty string, and default keys.
   - Hash repetitive schema headers into short key identifiers.

2. **AST Code Compression**:
   - Strip conversational preambles and polite filler.
   - Retain function signatures, type definitions, and exported modules while stripping boilerplate comments.

3. **Content Citation & Hydration (CCR Memory Vault)**:
   - Replace massive static arrays or unchanged file blocks with Content Citation references: `[sq_ref_<id>]`.
   - If the user or agent needs the full uncompressed payload, request hydration via `squeeze_retrieve(refId)`.

## SQUEEZE MCP Tools Available
- `squeeze_compress`: Compress context payloads before inserting into the chat window.
- `squeeze_retrieve`: Fetch original uncompressed content by CCR ref ID.
- `squeeze_stats`: Check real-time token savings and memory metrics.
- `squeeze_doctor`: Health check the local compression engine.

# Squeeze AI — Enterprise Context Compression Layer

> **Save 60–95% on JSON payloads, 15–35% on AST Code, and optimize LLM token steering automatically.**

Squeeze AI is a lightweight context compression layer designed for AI agents, LLM clients, local proxies, and Claude Code / Antigravity / Cursor / Windsurf desktop plugins.

---

## 🔌 Zero-Friction MCP Server for Claude Code & AI Tools

Squeeze AI includes a full **Model Context Protocol (MCP)** server supporting both **Stdio** and **HTTP/SSE** transports.

### Quick Setup

Run the zero-friction setup command in your project directory:

```bash
squeeze mcp setup
```

This automatically:
1. Generates `.mcp.json` and `.claude/mcp.json` in your project root.
2. Auto-registers Squeeze with **Claude Desktop** config (`claude_desktop_config.json`).
3. Registers Squeeze via `claude mcp add` if the Claude CLI is installed.

---

## 🚀 Hosting & Transport Modes

### 1. Stdio Transport (Default for Claude Code, Cursor, Windsurf, Antigravity)
```bash
squeeze mcp
```
Starts the JSON-RPC Stdio MCP server.

### 2. HTTP / SSE Server Transport
```bash
squeeze mcp serve --port 8788
```
Starts a standalone SSE HTTP server at `http://localhost:8788/mcp/sse`.

### 3. Integrated Proxy MCP Hosting
When you run:
```bash
squeeze deploy
# or
squeeze proxy
```
Squeeze automatically hosts the MCP SSE transport at `http://localhost:8787/mcp/sse` alongside the proxy!

---

## ⚡ MCP Tools Included

* **`squeeze_compress`**: Compress large JSON logs, source code, API responses, or text payloads before feeding to the LLM context.
* **`squeeze_retrieve`**: Fetch full original uncompressed content from local CCR memory using reference keys (`sq_ref_...`).
* **`squeeze_stats`**: View real-time token savings and cost reduction statistics.
* **`squeeze_doctor`**: Perform a health diagnostic check on the local SQUEEZE compression pipeline.

---

## 🔌 Manual MCP Configuration Examples

### `.mcp.json` (Claude Code, Cursor, Windsurf, Antigravity)
```json
{
  "mcpServers": {
    "squeeze": {
      "command": "squeeze",
      "args": ["mcp"]
    }
  }
}
```

### `claude_desktop_config.json` (Claude Desktop)
```json
{
  "mcpServers": {
    "squeeze": {
      "command": "squeeze",
      "args": ["mcp"]
    }
  }
}
```

### Claude CLI
```bash
claude mcp add squeeze squeeze mcp
```

---

## 📄 License
Apache-2.0 © SQUEEZE Team

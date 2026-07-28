# Squeeze AI — Enterprise Context Compression Layer

> **Save 60–95% on JSON payloads, 15–35% on AST Code, and optimize LLM token steering automatically.**

Squeeze AI is a lightweight context compression layer designed for AI agents, LLM clients, local proxies, and Claude / Antigravity desktop plugins.

---

## 🔌 Installing as a Plugin / Marketplace Repository

You can install Squeeze directly inside your AI client (Claude Code, Antigravity, or MCP Client) using the **Add Marketplace** dialog:

1. Push this repository to GitHub (e.g. `your-username/squeeze-ai`).
2. Open the **Add Marketplace** modal in your client.
3. Enter your GitHub repository URL:
   ```text
   your-username/squeeze-ai
   ```
   *or complete URL:*
   ```text
   https://github.com/your-username/squeeze-ai
   ```
4. Click **Sync**.

---

## ⚡ Plugin & MCP Tools Included

Once installed via Marketplace, Squeeze exposes the following tools automatically:

* **`squeeze_compress`**: Compress large JSON logs, source code, API responses, or text payloads before feeding to the LLM.
* **`squeeze_retrieve`**: Fetch full original content from local CCR memory using reference keys (`sq_ref_...`).
* **`squeeze_stats`**: View real-time token savings and cost reduction stats.

---

## 🚀 Local CLI Usage

```bash
# Install globally
npm install -g squeeze-ai

# Start local proxy
squeeze deploy

# Wrap any agent
squeeze wrap claude
```

---

## 📄 License
Apache-2.0 © SQUEEZE Team

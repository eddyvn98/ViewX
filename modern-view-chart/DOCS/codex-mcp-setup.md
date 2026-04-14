# Codex + MCP Setup (Stable Baseline)

## Applied on 2026-04-14

### Global (`~/.codex/config.toml`)
- Added `openaiDeveloperDocs` MCP: `https://developers.openai.com/mcp`
- Reconfigured `gitnexus` MCP to portable stdio command:
  - `command = "npx"`
  - `args = ["-y", "gitnexus", "mcp"]`
- Added MCP timeouts for stability:
  - `playwright`: startup 20s, tool 180s
  - `gitnexus`: startup 25s, tool 180s
  - `openaiDeveloperDocs`: tool 90s
- Default reasoning effort raised to `medium`
- Added profiles:
  - `fast` => low
  - `deep` => high

### Project-level (`.codex/config.toml`)
- `approval_policy = "on-request"`
- `sandbox_mode = "workspace-write"`
- `model = "gpt-5.3-codex"`
- `model_reasoning_effort = "medium"`
- `project_doc_fallback_files = ["AGENTS.md", "CLAUDE.md", "README.md"]`

## Verify commands
```bash
codex mcp list
npx gitnexus status
```

## Optional usage
```bash
codex --profile fast
codex --profile deep
```

## Internet-backed references used
- Codex config reference: https://developers.openai.com/codex/config-reference
- Codex MCP docs: https://developers.openai.com/codex/mcp
- OpenAI Docs MCP quickstart: https://developers.openai.com/learn/docs-mcp
- MCP security best practices: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices

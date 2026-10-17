# Spatial MCP server

Lets Claude Code, Cursor or any MCP client find Spatial XR components (React Three Fiber) and pull them into any project.

## Install

```sh
cd /Users/ek/molten/mcp && npm i
claude mcp add spatial -- node /Users/ek/molten/mcp/server.mjs
```

Against a deployed Spatial site (for `get_layout`; default is `http://localhost:3000`):

```sh
claude mcp add spatial -e SPATIAL_URL=https://<deployed-url> -- node /Users/ek/molten/mcp/server.mjs
```

Add `-s user` to make it available in every project.

Cursor (`.cursor/mcp.json` in the project, or `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "spatial": {
      "command": "node",
      "args": ["/Users/ek/molten/mcp/server.mjs"],
      "env": { "SPATIAL_URL": "http://localhost:3000" }
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `search_components({ query?, category?, includeSoon? })` | Search the registry (all words must match name, title, category, description, tags or aliases). Ready components only unless `includeSoon`. |
| `get_component({ name })` | Registry entry, full `.tsx` source, `npm i` command and a `<Canvas>` usage example. |
| `add_component({ name, projectPath, overwrite? })` | Copies the file to `<projectPath>/components/spatial/<name>.tsx`. Never overwrites unless `overwrite: true`. Returns the `npm i` command. |
| `get_layout({ id? })` | Fetches a saved Studio layout (`latest` or its id) from `SPATIAL_URL/api/layout/<id>`, with steps to rebuild it. |
| `list_categories()` | Categories with ready / coming-soon counts. |

Reads the registry from `../web/registry/index.json` and sources from `../web/` on every call, so new components show up without a restart.

## Test

```sh
cd /Users/ek/molten/mcp && npm test
```

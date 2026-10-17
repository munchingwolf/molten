# molten

## MCP

Claude Code / Cursor / any MCP client can search Spatial components, read their source, copy them into a project and fetch saved Studio layouts:

```sh
cd mcp && npm i
claude mcp add spatial -- node /Users/ek/molten/mcp/server.mjs
```

Tools: `search_components`, `get_component`, `add_component`, `get_layout`, `list_categories`. Details and the Cursor config: [mcp/README.md](mcp/README.md).

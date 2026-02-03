# bunmp

> [!NOTE]
> Supports darwin-arm64 only

Fast markdown preview powered by [Bun](https://bun.sh)'s built-in markdown parser.

- GitHub-flavored Markdown support
- Live reload on file changes

## Usage

```sh
bunx github:hairihou/bunmp README.md
```

### Neovim (lazy.nvim)

```lua
{
  "hairihou/bunmp",
  ft = "markdown",
  keys = {
    { "<leader>mp", function() require("bunmp").toggle() end, desc = "Markdown Preview" },
  },
}
```

## Development

```sh
bun run start  # Run development server
bun run lint   # Run oxlint
bun run fmt    # Format with oxfmt
```

## License

MIT

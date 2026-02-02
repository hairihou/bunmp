# bunmp

Fast markdown preview powered by [Bun](https://bun.sh)'s built-in markdown parser.

- GitHub-flavored Markdown support
- Live reload on file changes

## Installation

### CLI

```sh
mise use -g github:hairihou/bunmp
```

### Neovim (lazy.nvim)

```lua
{
  "hairihou/bunmp",
  ft = "markdown",
  keys = {
    { "<leader>mp", function() require("bunmp").toggle() end, desc = "Markdown Preview" },
  },
  opts = {
    port = 1412,
    auto_open = true,
  },
}
```

## Usage

```sh
bunmp README.md
bunmp README.md --port=4000
bunmp README.md --no-open
```

| Option            | Default | Description                      |
| ----------------- | ------- | -------------------------------- |
| `--port=<number>` | `1412`  | Server port                      |
| `--no-open`       | `false` | Don't open browser automatically |

## Development

```sh
bun run build   # Compile standalone binary
bun run start   # Run development server
bun run lint    # Run oxlint
bun run fmt     # Format with oxfmt
```

## License

MIT

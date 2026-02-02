local M = {}

M.config = {
  auto_open = true,
  port = 1412,
}

local job_id = nil

function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})

  vim.api.nvim_create_user_command("MarkdownPreview", function()
    M.open()
  end, { desc = "Open markdown preview in browser" })

  vim.api.nvim_create_user_command("MarkdownPreviewStop", function()
    M.stop()
  end, { desc = "Stop markdown preview server" })

  vim.api.nvim_create_autocmd("VimLeavePre", {
    callback = function()
      M.stop()
    end,
  })
end

function M.open()
  local file = vim.fn.expand("%:p")
  if file == "" then
    vim.notify("No file to preview", vim.log.levels.ERROR)
    return
  end

  if vim.bo.filetype ~= "markdown" then
    vim.notify("Not a markdown file", vim.log.levels.WARN)
    return
  end

  M.stop()

  local script_path = debug.getinfo(1, "S").source:sub(2)
  local plugin_dir = vim.fn.fnamemodify(script_path, ":h:h:h")
  local bin_path = plugin_dir .. "/index.ts"

  local args = { "bun", bin_path, file, "--port=" .. M.config.port }
  if not M.config.auto_open then
    table.insert(args, "--no-open")
  end

  job_id = vim.fn.jobstart(args, {
    on_exit = function(_, code)
      if code ~= 0 and code ~= 143 then
        vim.notify("Markdown preview server exited with code " .. code, vim.log.levels.ERROR)
      end
      job_id = nil
    end,
  })

  if job_id <= 0 then
    vim.notify("Failed to start markdown preview server", vim.log.levels.ERROR)
    job_id = nil
  end
end

function M.is_open()
  return job_id ~= nil
end

function M.stop()
  if job_id then
    vim.fn.jobstop(job_id)
    job_id = nil
  end
end

function M.toggle()
  if M.is_open() then
    M.stop()
  else
    M.open()
  end
end

return M

local M = {}
local job_id = nil
local bin_path = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h:h:h") .. "/index.ts"

function M.setup()
  vim.api.nvim_create_user_command("MarkdownPreview", M.open, { desc = "Open markdown preview" })
  vim.api.nvim_create_user_command("MarkdownPreviewStop", M.stop, { desc = "Stop markdown preview" })
  vim.api.nvim_create_autocmd("VimLeavePre", { callback = M.stop })
end

function M.open()
  local file = vim.fn.expand("%:p")
  if file == "" then
    return vim.notify("No file to preview", vim.log.levels.ERROR)
  end
  if vim.bo.filetype ~= "markdown" then
    return vim.notify("Not a markdown file", vim.log.levels.WARN)
  end
  M.stop()
  job_id = vim.fn.jobstart({ "bun", bin_path, file }, {
    on_exit = function(_, code)
      if code ~= 0 and code ~= 143 then
        vim.notify("Markdown preview exited with code " .. code, vim.log.levels.ERROR)
      end
      job_id = nil
    end,
  })
  if job_id <= 0 then
    vim.notify("Failed to start markdown preview", vim.log.levels.ERROR)
    job_id = nil
  end
end

function M.stop()
  if job_id then
    vim.fn.jobstop(job_id)
    job_id = nil
  end
end

function M.toggle()
  if job_id then
    M.stop()
  else
    M.open()
  end
end

return M

# GitLab MCP Server

MCP server for GitLab (projects, merge requests, issues, notes, pipelines, repo files) via stdio transport.

## Requirements

- Node.js 18.20+ (or newer)
- GitLab Personal Access Token with API scope

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   ```bash
   copy .env.example .env
   ```

   Set `GITLAB_TOKEN` in `.env`.  
   Optional: set `GITLAB_HOST` for self-hosted GitLab.

## Run locally

```bash
npm run start
```

## Available tools

- `gitlab_list_projects`
- `gitlab_get_project`
- `gitlab_list_merge_requests`
- `gitlab_create_issue`
- `gitlab_create_merge_request`
- `gitlab_edit_merge_request`
- `gitlab_create_issue_note`
- `gitlab_create_merge_request_note`
- `gitlab_list_pipelines`
- `gitlab_get_pipeline`
- `gitlab_remove_pipeline`
- `gitlab_run_pipeline`
- `gitlab_retry_pipeline`
- `gitlab_cancel_pipeline`
- `gitlab_get_file`
- `gitlab_upsert_file`
- `gitlab_approve_merge_request`
- `gitlab_unapprove_merge_request`
- `gitlab_merge_merge_request`
- `gitlab_list_branches`
- `gitlab_create_branch`
- `gitlab_create_commit`
- `gitlab_list_tags`
- `gitlab_create_tag`
- `gitlab_list_releases`
- `gitlab_get_release`
- `gitlab_create_release_evidence`
- `gitlab_create_release`
- `gitlab_update_release`
- `gitlab_show_changelog`
- `gitlab_edit_changelog`
- `gitlab_list_merge_request_discussions`
- `gitlab_create_merge_request_discussion`
- `gitlab_create_merge_request_discussion_note`
- `gitlab_resolve_merge_request_discussion`
- `gitlab_unresolve_merge_request_discussion`
- `gitlab_list_protected_branches`
- `gitlab_protect_branch`
- `gitlab_unprotect_branch`
- `gitlab_list_protected_tags`
- `gitlab_protect_tag`
- `gitlab_unprotect_tag`
- `gitlab_list_release_links`
- `gitlab_create_release_link`
- `gitlab_update_release_link`
- `gitlab_remove_release_link`
- `gitlab_list_project_variables`
- `gitlab_upsert_project_variable`
- `gitlab_remove_project_variable`
- `gitlab_list_jobs`
- `gitlab_get_job`
- `gitlab_get_job_log`
- `gitlab_retry_job`
- `gitlab_play_job`
- `gitlab_cancel_job`
- `gitlab_erase_job`
- `gitlab_download_job_artifacts`
- `gitlab_keep_job_artifacts`
- `gitlab_remove_job_artifacts`
- `gitlab_list_environments`
- `gitlab_create_environment`
- `gitlab_stop_environment`
- `gitlab_remove_environment`
- `gitlab_list_deployments`
- `gitlab_get_deployment`
- `gitlab_create_deployment`
- `gitlab_edit_deployment_status`
- `gitlab_remove_deployment`
- `gitlab_set_deployment_approval`
- `gitlab_get_tools_catalog`

## Cursor MCP config example

Add this to your MCP configuration (adjust path if needed):

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": [
        "tsx",
        "F:/www/mcp/gitlab/src/index.ts"
      ],
      "env": {
        "GITLAB_HOST": "https://gitlab.com",
        "GITLAB_TOKEN": "glpat-xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

For production usage you can run `npm run build` and point MCP command to `node dist/index.js`.

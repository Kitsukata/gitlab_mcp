import { Gitlab } from "@gitbeaker/rest";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type ToolHandler = (args: unknown) => Promise<CallToolResult>;

const host = process.env.GITLAB_HOST ?? "https://gitlab.com";
const token = process.env.GITLAB_TOKEN;

if (!token) {
  throw new Error("Missing GITLAB_TOKEN environment variable.");
}

const gitlab = new Gitlab({
  host,
  token,
});

const server = new Server(
  {
    name: "gitlab-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const listProjectsSchema = z.object({
  search: z.string().min(1).optional(),
  membership: z.boolean().optional().default(true),
  perPage: z.number().int().min(1).max(100).optional().default(20),
});

const getProjectSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
});

const listMergeRequestsSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  state: z.enum(["opened", "closed", "locked", "merged", "all"]).optional().default("opened"),
  perPage: z.number().int().min(1).max(100).optional().default(20),
});

const createIssueSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  title: z.string().min(1),
  description: z.string().optional(),
  labels: z.array(z.string().min(1)).optional(),
  assigneeIds: z.array(z.number().int().positive()).optional(),
});

const createMergeRequestSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  sourceBranch: z.string().min(1),
  targetBranch: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  removeSourceBranch: z.boolean().optional(),
  squash: z.boolean().optional(),
  assigneeId: z.number().int().positive().optional(),
});

const editMergeRequestSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  mergeRequestIid: z.number().int().positive(),
  targetBranch: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assigneeId: z.number().int().positive().optional(),
  assigneeIds: z.array(z.number().int().positive()).optional(),
  reviewerIds: z.array(z.number().int().positive()).optional(),
  labels: z.array(z.string().min(1)).optional(),
  addLabels: z.array(z.string().min(1)).optional(),
  removeLabels: z.array(z.string().min(1)).optional(),
  stateEvent: z.enum(["close", "reopen"]).optional(),
  removeSourceBranch: z.boolean().optional(),
  squash: z.boolean().optional(),
  discussionLocked: z.boolean().optional(),
  allowCollaboration: z.boolean().optional(),
  allowMaintainerToPush: z.boolean().optional(),
  milestoneId: z.number().int().positive().optional(),
});

const createIssueNoteSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  issueIid: z.number().int().positive(),
  body: z.string().min(1),
});

const createMergeRequestNoteSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  mergeRequestIid: z.number().int().positive(),
  body: z.string().min(1),
});

const listPipelinesSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  ref: z.string().min(1).optional(),
  status: z
    .enum([
      "created",
      "waiting_for_resource",
      "preparing",
      "pending",
      "running",
      "success",
      "failed",
      "canceled",
      "skipped",
      "manual",
      "scheduled",
    ])
    .optional(),
  perPage: z.number().int().min(1).max(100).optional().default(20),
});

const getPipelineSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  pipelineId: z.number().int().positive(),
});

const deletePipelineSchema = getPipelineSchema;

const getFileSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  filePath: z.string().min(1),
  ref: z.string().min(1),
});

const upsertFileSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  filePath: z.string().min(1),
  branch: z.string().min(1),
  commitMessage: z.string().min(1),
  content: z.string(),
  encoding: z.enum(["text", "base64"]).optional().default("text"),
});

const pipelineVariableSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  variableType: z.enum(["env_var", "file"]).optional(),
});

const runPipelineSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  ref: z.string().min(1),
  variables: z.array(pipelineVariableSchema).optional(),
});

const pipelineActionSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  pipelineId: z.number().int().positive(),
});

const mergeRequestActionSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  mergeRequestIid: z.number().int().positive(),
});

const mergeMergeRequestSchema = mergeRequestActionSchema.extend({
  mergeCommitMessage: z.string().optional(),
  squashCommitMessage: z.string().optional(),
  squash: z.boolean().optional(),
  shouldRemoveSourceBranch: z.boolean().optional(),
  mergeWhenPipelineSucceeds: z.boolean().optional(),
  autoMerge: z.boolean().optional(),
  sha: z.string().optional(),
});

const listBranchesSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  search: z.string().min(1).optional(),
  perPage: z.number().int().min(1).max(100).optional().default(50),
});

const createBranchSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  branchName: z.string().min(1),
  ref: z.string().min(1),
});

const commitActionSchema = z.object({
  action: z.enum(["create", "delete", "move", "update", "chmod"]),
  filePath: z.string().min(1),
  previousPath: z.string().optional(),
  content: z.string().optional(),
  encoding: z.enum(["text", "base64"]).optional(),
  lastCommitId: z.string().optional(),
  execute_filemode: z.boolean().optional(),
});

const createCommitSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  branch: z.string().min(1),
  commitMessage: z.string().min(1),
  actions: z.array(commitActionSchema).min(1),
  startBranch: z.string().optional(),
  startSha: z.string().optional(),
  force: z.boolean().optional(),
  authorName: z.string().optional(),
  authorEmail: z.string().optional(),
});

const listTagsSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  search: z.string().min(1).optional(),
  perPage: z.number().int().min(1).max(100).optional().default(30),
});

const createTagSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  tagName: z.string().min(1),
  ref: z.string().min(1),
  message: z.string().optional(),
});

const listReleasesSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  perPage: z.number().int().min(1).max(100).optional().default(20),
});

const getReleaseSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  tagName: z.string().min(1),
});

const createReleaseEvidenceSchema = getReleaseSchema;

const createReleaseSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  tagName: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  ref: z.string().optional(),
  releasedAt: z.string().optional(),
});

const updateReleaseSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  tagName: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  releasedAt: z.string().optional(),
});

const showChangelogSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  version: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  date: z.string().optional(),
  trailer: z.string().optional(),
  configFile: z.string().optional(),
});

const editChangelogSchema = showChangelogSchema.extend({
  branch: z.string().optional(),
  file: z.string().optional(),
  message: z.string().optional(),
});

const listMergeRequestDiscussionsSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  mergeRequestIid: z.number().int().positive(),
  perPage: z.number().int().min(1).max(100).optional().default(50),
});

const createMergeRequestDiscussionSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  mergeRequestIid: z.number().int().positive(),
  body: z.string().min(1),
});

const createMergeRequestDiscussionNoteSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  mergeRequestIid: z.number().int().positive(),
  discussionId: z.string().min(1),
  body: z.string().min(1),
});

const resolveMergeRequestDiscussionSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  mergeRequestIid: z.number().int().positive(),
  discussionId: z.string().min(1),
});

const accessLevelSchema = z.union([
  z.number().int().min(0).max(60),
  z.enum(["no_access", "developer", "maintainer", "admin"]),
]);

const protectedBranchAllowEntitySchema = z
  .object({
    userId: z.number().int().positive().optional(),
    groupId: z.number().int().positive().optional(),
    accessLevel: accessLevelSchema.optional(),
  })
  .refine((v) => !!v.userId || !!v.groupId || v.accessLevel !== undefined, {
    message: "Provide one of userId, groupId, or accessLevel.",
  });

const listProtectedBranchesSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  search: z.string().min(1).optional(),
  perPage: z.number().int().min(1).max(100).optional().default(50),
});

const protectBranchSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  branchName: z.string().min(1),
  mergeAccessLevel: accessLevelSchema.optional(),
  pushAccessLevel: accessLevelSchema.optional(),
  unprotectAccessLevel: accessLevelSchema.optional(),
  allowedToMerge: z.array(protectedBranchAllowEntitySchema).optional(),
  allowedToPush: z.array(protectedBranchAllowEntitySchema).optional(),
  allowedToUnprotect: z.array(protectedBranchAllowEntitySchema).optional(),
  allowForcePush: z.boolean().optional(),
  codeOwnerApprovalRequired: z.boolean().optional(),
});

const branchActionSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  branchName: z.string().min(1),
});

const listProtectedTagsSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  perPage: z.number().int().min(1).max(100).optional().default(50),
});

const protectTagSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  tagName: z.string().min(1),
  createAccessLevel: accessLevelSchema.optional(),
  allowedToCreate: z.array(protectedBranchAllowEntitySchema).optional(),
});

const tagActionSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  tagName: z.string().min(1),
});

const listReleaseLinksSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  tagName: z.string().min(1),
  perPage: z.number().int().min(1).max(100).optional().default(50),
});

const createReleaseLinkSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  tagName: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  linkType: z.string().optional(),
  directAssetPath: z.string().optional(),
  filePath: z.string().optional(),
});

const updateReleaseLinkSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  tagName: z.string().min(1),
  linkId: z.number().int().positive(),
  name: z.string().optional(),
  url: z.string().url().optional(),
  linkType: z.string().optional(),
  directAssetPath: z.string().optional(),
  filePath: z.string().optional(),
});

const removeReleaseLinkSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  tagName: z.string().min(1),
  linkId: z.number().int().positive(),
});

const listProjectVariablesSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  perPage: z.number().int().min(1).max(100).optional().default(100),
});

const upsertProjectVariableSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  key: z.string().min(1),
  value: z.string(),
  environmentScope: z.string().optional(),
  variableType: z.enum(["env_var", "file"]).optional(),
  protected: z.boolean().optional(),
  masked: z.boolean().optional(),
  maskedAndHidden: z.boolean().optional(),
  raw: z.boolean().optional(),
  description: z.string().optional(),
});

const removeProjectVariableSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  key: z.string().min(1),
  environmentScope: z.string().optional(),
});

const listJobsSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  pipelineId: z.number().int().positive().optional(),
  scope: z
    .enum([
      "created",
      "pending",
      "running",
      "failed",
      "success",
      "canceled",
      "skipped",
      "manual",
      "waiting_for_resource",
    ])
    .optional(),
  includeRetried: z.boolean().optional(),
  perPage: z.number().int().min(1).max(100).optional().default(50),
});

const jobActionSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  jobId: z.number().int().positive(),
});

const playJobSchema = jobActionSchema.extend({
  jobVariablesAttributes: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.string(),
      }),
    )
    .optional(),
});

const downloadJobArtifactsSchema = z
  .object({
    projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
    jobId: z.number().int().positive().optional(),
    ref: z.string().optional(),
    job: z.string().optional(),
    artifactPath: z.string().optional(),
  })
  .refine((v) => !!v.jobId || (!!v.ref && !!v.job), {
    message: "Provide either jobId or pair of ref + job.",
  });

const listEnvironmentsSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  search: z.string().optional(),
  name: z.string().optional(),
  states: z.enum(["available", "stopping", "stopped"]).optional(),
  perPage: z.number().int().min(1).max(100).optional().default(50),
});

const createEnvironmentSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  name: z.string().min(1),
  externalUrl: z.string().url().optional(),
  tier: z.enum(["production", "staging", "testing", "development", "other"]).optional(),
});

const stopEnvironmentSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  environmentId: z.number().int().positive(),
  force: z.boolean().optional(),
});

const removeEnvironmentSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  environmentId: z.number().int().positive(),
});

const listDeploymentsSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  environment: z.string().optional(),
  status: z.enum(["created", "running", "success", "failed", "canceled", "blocked"]).optional(),
  perPage: z.number().int().min(1).max(100).optional().default(50),
});

const getDeploymentSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  deploymentId: z.number().int().positive(),
});

const createDeploymentSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  environment: z.string().min(1),
  sha: z.string().min(1),
  ref: z.string().min(1),
  tag: z.boolean(),
  status: z.enum(["running", "success", "failed", "canceled"]).optional(),
});

const editDeploymentStatusSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  deploymentId: z.number().int().positive(),
  status: z.enum(["running", "success", "failed", "canceled"]),
});

const setDeploymentApprovalSchema = z.object({
  projectIdOrPath: z.union([z.string().min(1), z.number().int().positive()]),
  deploymentId: z.number().int().positive(),
  status: z.enum(["approved", "rejected"]),
  comment: z.string().optional(),
});

const handlers: Record<string, ToolHandler> = {
  async gitlab_list_projects(args) {
    const parsed = listProjectsSchema.parse(args ?? {});
    const projects = await gitlab.Projects.all({
      search: parsed.search,
      membership: parsed.membership,
      perPage: parsed.perPage,
      simple: true,
    });

    return textResult(
      projects.map((project) => ({
        id: project.id,
        path_with_namespace: project.path_with_namespace,
        web_url: project.web_url,
        visibility: project.visibility,
        default_branch: project.default_branch,
      })),
    );
  },

  async gitlab_get_project(args) {
    const parsed = getProjectSchema.parse(args ?? {});
    const project = await gitlab.Projects.show(parsed.projectIdOrPath);

    return textResult({
      id: project.id,
      name: project.name,
      description: project.description,
      path_with_namespace: project.path_with_namespace,
      web_url: project.web_url,
      default_branch: project.default_branch,
      visibility: project.visibility,
      open_issues_count: project.open_issues_count,
      stars_count: project.star_count,
      forks_count: project.forks_count,
    });
  },

  async gitlab_list_merge_requests(args) {
    const parsed = listMergeRequestsSchema.parse(args ?? {});
    const state = parsed.state === "all" ? undefined : parsed.state;
    const mrs = await gitlab.MergeRequests.all({
      projectId: parsed.projectIdOrPath,
      state,
      perPage: parsed.perPage,
      orderBy: "updated_at",
      sort: "desc",
    });

    return textResult(
      mrs.map((mr) => ({
        iid: mr.iid,
        title: mr.title,
        state: mr.state,
        web_url: mr.web_url,
        author: mr.author?.username,
        source_branch: mr.source_branch,
        target_branch: mr.target_branch,
        updated_at: mr.updated_at,
      })),
    );
  },

  async gitlab_create_issue(args) {
    const parsed = createIssueSchema.parse(args ?? {});
    const issue = await gitlab.Issues.create(parsed.projectIdOrPath, parsed.title, {
      description: parsed.description,
      labels: parsed.labels?.join(","),
      assigneeIds: parsed.assigneeIds,
    });

    return textResult({
      iid: issue.iid,
      title: issue.title,
      state: issue.state,
      web_url: issue.web_url,
    });
  },

  async gitlab_create_merge_request(args) {
    const parsed = createMergeRequestSchema.parse(args ?? {});
    const mr = await gitlab.MergeRequests.create(
      parsed.projectIdOrPath,
      parsed.sourceBranch,
      parsed.targetBranch,
      parsed.title,
      {
        description: parsed.description,
        removeSourceBranch: parsed.removeSourceBranch,
        squash: parsed.squash,
        assigneeId: parsed.assigneeId,
      },
    );

    return textResult({
      iid: mr.iid,
      title: mr.title,
      state: mr.state,
      web_url: mr.web_url,
      source_branch: mr.source_branch,
      target_branch: mr.target_branch,
    });
  },

  async gitlab_edit_merge_request(args) {
    const parsed = editMergeRequestSchema.parse(args ?? {});
    const mr = await gitlab.MergeRequests.edit(parsed.projectIdOrPath, parsed.mergeRequestIid, {
      targetBranch: parsed.targetBranch,
      title: parsed.title,
      description: parsed.description,
      assigneeId: parsed.assigneeId,
      assigneeIds: parsed.assigneeIds,
      reviewerIds: parsed.reviewerIds,
      labels: parsed.labels?.join(","),
      addLabels: parsed.addLabels?.join(","),
      removeLabels: parsed.removeLabels?.join(","),
      stateEvent: parsed.stateEvent,
      removeSourceBranch: parsed.removeSourceBranch,
      squash: parsed.squash,
      discussionLocked: parsed.discussionLocked,
      allowCollaboration: parsed.allowCollaboration,
      allowMaintainerToPush: parsed.allowMaintainerToPush,
      milestoneId: parsed.milestoneId,
    });

    return textResult({
      iid: mr.iid,
      title: mr.title,
      state: mr.state,
      web_url: mr.web_url,
      source_branch: mr.source_branch,
      target_branch: mr.target_branch,
      updated_at: mr.updated_at,
    });
  },

  async gitlab_create_issue_note(args) {
    const parsed = createIssueNoteSchema.parse(args ?? {});
    const note = await gitlab.IssueNotes.create(parsed.projectIdOrPath, parsed.issueIid, parsed.body);

    return textResult({
      id: note.id,
      body: note.body,
      created_at: note.created_at,
      author: note.author?.username,
    });
  },

  async gitlab_create_merge_request_note(args) {
    const parsed = createMergeRequestNoteSchema.parse(args ?? {});
    const note = await gitlab.MergeRequestNotes.create(
      parsed.projectIdOrPath,
      parsed.mergeRequestIid,
      parsed.body,
    );

    return textResult({
      id: note.id,
      body: note.body,
      created_at: note.created_at,
      author: note.author?.username,
    });
  },

  async gitlab_list_pipelines(args) {
    const parsed = listPipelinesSchema.parse(args ?? {});
    const pipelines = await gitlab.Pipelines.all(parsed.projectIdOrPath, {
      ref: parsed.ref,
      status: parsed.status,
      perPage: parsed.perPage,
      orderBy: "updated_at",
      sort: "desc",
    });

    return textResult(
      pipelines.map((pipeline) => ({
        id: pipeline.id,
        iid: pipeline.iid,
        status: pipeline.status,
        ref: pipeline.ref,
        sha: pipeline.sha,
        web_url: pipeline.web_url,
        updated_at: pipeline.updated_at,
      })),
    );
  },

  async gitlab_get_pipeline(args) {
    const parsed = getPipelineSchema.parse(args ?? {});
    const pipeline = await gitlab.Pipelines.show(parsed.projectIdOrPath, parsed.pipelineId);

    return textResult({
      id: pipeline.id,
      iid: pipeline.iid,
      status: pipeline.status,
      ref: pipeline.ref,
      sha: pipeline.sha,
      source: pipeline.source,
      web_url: pipeline.web_url,
      created_at: pipeline.created_at,
      updated_at: pipeline.updated_at,
      finished_at: pipeline.finished_at,
    });
  },

  async gitlab_remove_pipeline(args) {
    const parsed = deletePipelineSchema.parse(args ?? {});
    await gitlab.Pipelines.remove(parsed.projectIdOrPath, parsed.pipelineId);

    return textResult({
      removed: true,
      pipeline_id: parsed.pipelineId,
    });
  },

  async gitlab_get_file(args) {
    const parsed = getFileSchema.parse(args ?? {});
    const file = await gitlab.RepositoryFiles.show(parsed.projectIdOrPath, parsed.filePath, parsed.ref);

    const decodedContent =
      file.encoding === "base64" ? Buffer.from(file.content, "base64").toString("utf8") : file.content;

    return textResult({
      file_path: file.file_path,
      branch: parsed.ref,
      encoding: file.encoding,
      size: file.size,
      content: decodedContent,
      blob_id: file.blob_id,
      commit_id: file.commit_id,
      last_commit_id: file.last_commit_id,
    });
  },

  async gitlab_upsert_file(args) {
    const parsed = upsertFileSchema.parse(args ?? {});

    try {
      const updated = await gitlab.RepositoryFiles.edit(
        parsed.projectIdOrPath,
        parsed.filePath,
        parsed.branch,
        parsed.content,
        parsed.commitMessage,
        {
          encoding: parsed.encoding,
        },
      );

      return textResult({
        action: "updated",
        ...updated,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!message.toLowerCase().includes("404")) {
        throw error;
      }

      const created = await gitlab.RepositoryFiles.create(
        parsed.projectIdOrPath,
        parsed.filePath,
        parsed.branch,
        parsed.content,
        parsed.commitMessage,
        {
          encoding: parsed.encoding,
        },
      );

      return textResult({
        action: "created",
        ...created,
      });
    }
  },

  async gitlab_run_pipeline(args) {
    const parsed = runPipelineSchema.parse(args ?? {});
    const pipeline = await gitlab.Pipelines.create(parsed.projectIdOrPath, parsed.ref, {
      variables: parsed.variables,
    });

    return textResult({
      id: pipeline.id,
      iid: pipeline.iid,
      status: pipeline.status,
      ref: pipeline.ref,
      sha: pipeline.sha,
      web_url: pipeline.web_url,
      created_at: pipeline.created_at,
    });
  },

  async gitlab_retry_pipeline(args) {
    const parsed = pipelineActionSchema.parse(args ?? {});
    const pipeline = await gitlab.Pipelines.retry(parsed.projectIdOrPath, parsed.pipelineId);

    return textResult({
      id: pipeline.id,
      status: pipeline.status,
      ref: pipeline.ref,
      web_url: pipeline.web_url,
      updated_at: pipeline.updated_at,
    });
  },

  async gitlab_cancel_pipeline(args) {
    const parsed = pipelineActionSchema.parse(args ?? {});
    const pipeline = await gitlab.Pipelines.cancel(parsed.projectIdOrPath, parsed.pipelineId);

    return textResult({
      id: pipeline.id,
      status: pipeline.status,
      ref: pipeline.ref,
      web_url: pipeline.web_url,
      updated_at: pipeline.updated_at,
    });
  },

  async gitlab_approve_merge_request(args) {
    const parsed = mergeRequestActionSchema.parse(args ?? {});
    const approval = await gitlab.MergeRequestApprovals.approve(
      parsed.projectIdOrPath,
      parsed.mergeRequestIid,
    );

    return textResult(approval);
  },

  async gitlab_unapprove_merge_request(args) {
    const parsed = mergeRequestActionSchema.parse(args ?? {});
    await gitlab.MergeRequestApprovals.unapprove(parsed.projectIdOrPath, parsed.mergeRequestIid);

    return textResult({
      unapproved: true,
      merge_request_iid: parsed.mergeRequestIid,
    });
  },

  async gitlab_merge_merge_request(args) {
    const parsed = mergeMergeRequestSchema.parse(args ?? {});
    const merged = await gitlab.MergeRequests.merge(parsed.projectIdOrPath, parsed.mergeRequestIid, {
      mergeCommitMessage: parsed.mergeCommitMessage,
      squashCommitMessage: parsed.squashCommitMessage,
      squash: parsed.squash,
      shouldRemoveSourceBranch: parsed.shouldRemoveSourceBranch,
      mergeWhenPipelineSucceeds: parsed.mergeWhenPipelineSucceeds,
      autoMerge: parsed.autoMerge,
      sha: parsed.sha,
    });

    return textResult({
      iid: merged.iid,
      state: merged.state,
      merged_at: merged.merged_at,
      merge_status: merged.merge_status,
      web_url: merged.web_url,
    });
  },

  async gitlab_list_branches(args) {
    const parsed = listBranchesSchema.parse(args ?? {});
    const branches = await gitlab.Branches.all(parsed.projectIdOrPath, {
      search: parsed.search,
      perPage: parsed.perPage,
    });

    return textResult(
      branches.map((branch) => ({
        name: branch.name,
        merged: branch.merged,
        protected: branch.protected,
        default: branch.default,
        web_url: branch.web_url,
        commit: {
          id: branch.commit?.id,
          short_id: branch.commit?.short_id,
          title: branch.commit?.title,
        },
      })),
    );
  },

  async gitlab_create_branch(args) {
    const parsed = createBranchSchema.parse(args ?? {});
    const branch = await gitlab.Branches.create(parsed.projectIdOrPath, parsed.branchName, parsed.ref);

    return textResult({
      name: branch.name,
      protected: branch.protected,
      default: branch.default,
      web_url: branch.web_url,
      ref: parsed.ref,
    });
  },

  async gitlab_create_commit(args) {
    const parsed = createCommitSchema.parse(args ?? {});
    const commit = await gitlab.Commits.create(
      parsed.projectIdOrPath,
      parsed.branch,
      parsed.commitMessage,
      parsed.actions,
      {
        startBranch: parsed.startBranch,
        startSha: parsed.startSha,
        force: parsed.force,
        authorName: parsed.authorName,
        authorEmail: parsed.authorEmail,
      },
    );

    return textResult({
      id: commit.id,
      short_id: commit.short_id,
      title: commit.title,
      message: commit.message,
      web_url: commit.web_url,
      created_at: commit.created_at,
    });
  },

  async gitlab_list_tags(args) {
    const parsed = listTagsSchema.parse(args ?? {});
    const tags = await gitlab.Tags.all(parsed.projectIdOrPath, {
      search: parsed.search,
      perPage: parsed.perPage,
      orderBy: "updated",
      sort: "desc",
    });

    return textResult(
      tags.map((tag) => ({
        name: tag.name,
        message: tag.message,
        target: tag.target,
        commit: {
          id: tag.commit?.id,
          short_id: tag.commit?.short_id,
          title: tag.commit?.title,
        },
        release: tag.release,
      })),
    );
  },

  async gitlab_create_tag(args) {
    const parsed = createTagSchema.parse(args ?? {});
    const tag = await gitlab.Tags.create(parsed.projectIdOrPath, parsed.tagName, parsed.ref, {
      message: parsed.message,
    });

    return textResult({
      name: tag.name,
      message: tag.message,
      target: tag.target,
      commit: {
        id: tag.commit?.id,
        short_id: tag.commit?.short_id,
        title: tag.commit?.title,
      },
    });
  },

  async gitlab_list_releases(args) {
    const parsed = listReleasesSchema.parse(args ?? {});
    const releases = await gitlab.ProjectReleases.all(parsed.projectIdOrPath, {
      perPage: parsed.perPage,
    });

    return textResult(
      releases.map((release) => ({
        name: release.name,
        tag_name: release.tag_name,
        description: release.description,
        upcoming_release: release.upcoming_release,
        created_at: release.created_at,
        released_at: release.released_at,
        author: release.author?.username,
      })),
    );
  },

  async gitlab_get_release(args) {
    const parsed = getReleaseSchema.parse(args ?? {});
    const release = await gitlab.ProjectReleases.show(parsed.projectIdOrPath, parsed.tagName);

    return textResult(release);
  },

  async gitlab_create_release_evidence(args) {
    const parsed = createReleaseEvidenceSchema.parse(args ?? {});
    const evidence = await gitlab.ProjectReleases.createEvidence(parsed.projectIdOrPath, parsed.tagName);

    return textResult({
      evidence_id: evidence,
      tag_name: parsed.tagName,
    });
  },

  async gitlab_create_release(args) {
    const parsed = createReleaseSchema.parse(args ?? {});
    const options: any = {
      tagName: parsed.tagName,
      name: parsed.name,
      description: parsed.description,
      ref: parsed.ref,
      releasedAt: parsed.releasedAt,
    };
    const release = await gitlab.ProjectReleases.create(parsed.projectIdOrPath, options);

    return textResult({
      name: release.name,
      tag_name: release.tag_name,
      description: release.description,
      created_at: release.created_at,
      released_at: release.released_at,
    });
  },

  async gitlab_update_release(args) {
    const parsed = updateReleaseSchema.parse(args ?? {});
    const options: any = {
      name: parsed.name,
      description: parsed.description,
      releasedAt: parsed.releasedAt,
    };
    const release = await gitlab.ProjectReleases.edit(
      parsed.projectIdOrPath,
      parsed.tagName,
      options,
    );

    return textResult({
      name: release.name,
      tag_name: release.tag_name,
      description: release.description,
      released_at: release.released_at,
    });
  },

  async gitlab_show_changelog(args) {
    const parsed = showChangelogSchema.parse(args ?? {});
    const changelog = await gitlab.Repositories.showChangelog(parsed.projectIdOrPath, parsed.version, {
      from: parsed.from,
      to: parsed.to,
      date: parsed.date,
      trailer: parsed.trailer,
      configFile: parsed.configFile,
    });

    return textResult(changelog);
  },

  async gitlab_edit_changelog(args) {
    const parsed = editChangelogSchema.parse(args ?? {});
    const changelog = await gitlab.Repositories.editChangelog(parsed.projectIdOrPath, parsed.version, {
      from: parsed.from,
      to: parsed.to,
      date: parsed.date,
      trailer: parsed.trailer,
      configFile: parsed.configFile,
      branch: parsed.branch,
      file: parsed.file,
      message: parsed.message,
    });

    return textResult(changelog);
  },

  async gitlab_list_merge_request_discussions(args) {
    const parsed = listMergeRequestDiscussionsSchema.parse(args ?? {});
    const discussions = await gitlab.MergeRequestDiscussions.all(
      parsed.projectIdOrPath,
      parsed.mergeRequestIid,
      {
        perPage: parsed.perPage,
      },
    );

    return textResult(
      discussions.map((discussion) => ({
        id: discussion.id,
        individual_note: discussion.individual_note,
        notes: discussion.notes?.map((note) => ({
          id: note.id,
          body: note.body,
          author: note.author?.username,
          resolvable: note.resolvable,
          resolved: note.resolved,
          created_at: note.created_at,
        })),
      })),
    );
  },

  async gitlab_create_merge_request_discussion(args) {
    const parsed = createMergeRequestDiscussionSchema.parse(args ?? {});
    const discussion = await gitlab.MergeRequestDiscussions.create(
      parsed.projectIdOrPath,
      parsed.mergeRequestIid,
      parsed.body,
    );

    return textResult({
      id: discussion.id,
      individual_note: discussion.individual_note,
      notes: discussion.notes?.map((note) => ({
        id: note.id,
        body: note.body,
        author: note.author?.username,
      })),
    });
  },

  async gitlab_create_merge_request_discussion_note(args) {
    const parsed = createMergeRequestDiscussionNoteSchema.parse(args ?? {});
    const note = await gitlab.MergeRequestDiscussions.addNote(
      parsed.projectIdOrPath,
      parsed.mergeRequestIid,
      parsed.discussionId,
      parsed.body,
    );

    return textResult({
      id: note.id,
      body: note.body,
      author: note.author?.username,
      resolved: note.resolved,
      resolvable: note.resolvable,
      created_at: note.created_at,
    });
  },

  async gitlab_resolve_merge_request_discussion(args) {
    const parsed = resolveMergeRequestDiscussionSchema.parse(args ?? {});
    const discussion = await gitlab.MergeRequestDiscussions.resolve(
      parsed.projectIdOrPath,
      parsed.mergeRequestIid,
      parsed.discussionId,
      true,
    );

    return textResult({
      id: discussion.id,
      resolved: true,
      notes: discussion.notes?.map((note) => ({
        id: note.id,
        resolved: note.resolved,
      })),
    });
  },

  async gitlab_unresolve_merge_request_discussion(args) {
    const parsed = resolveMergeRequestDiscussionSchema.parse(args ?? {});
    const discussion = await gitlab.MergeRequestDiscussions.resolve(
      parsed.projectIdOrPath,
      parsed.mergeRequestIid,
      parsed.discussionId,
      false,
    );

    return textResult({
      id: discussion.id,
      resolved: false,
      notes: discussion.notes?.map((note) => ({
        id: note.id,
        resolved: note.resolved,
      })),
    });
  },

  async gitlab_list_protected_branches(args) {
    const parsed = listProtectedBranchesSchema.parse(args ?? {});
    const branches = await gitlab.ProtectedBranches.all(parsed.projectIdOrPath, {
      search: parsed.search,
      perPage: parsed.perPage,
    });

    return textResult(branches);
  },

  async gitlab_protect_branch(args) {
    const parsed = protectBranchSchema.parse(args ?? {});
    const branch = await gitlab.ProtectedBranches.protect(parsed.projectIdOrPath, parsed.branchName, {
      mergeAccessLevel: mapAccessLevel(parsed.mergeAccessLevel),
      pushAccessLevel: mapAccessLevel(parsed.pushAccessLevel),
      unprotectAccessLevel: mapAccessLevel(parsed.unprotectAccessLevel),
      allowedToMerge: parsed.allowedToMerge?.map(mapProtectedBranchAllowEntity) as any,
      allowedToPush: parsed.allowedToPush?.map(mapProtectedBranchAllowEntity) as any,
      allowedToUnprotect: parsed.allowedToUnprotect?.map(mapProtectedBranchAllowEntity) as any,
      allowForcePush: parsed.allowForcePush,
      codeOwnerApprovalRequired: parsed.codeOwnerApprovalRequired,
    });

    return textResult(branch);
  },

  async gitlab_unprotect_branch(args) {
    const parsed = branchActionSchema.parse(args ?? {});
    await gitlab.ProtectedBranches.unprotect(parsed.projectIdOrPath, parsed.branchName);

    return textResult({
      unprotected: true,
      branch_name: parsed.branchName,
    });
  },

  async gitlab_list_protected_tags(args) {
    const parsed = listProtectedTagsSchema.parse(args ?? {});
    const tags = await gitlab.ProtectedTags.all(parsed.projectIdOrPath, {
      perPage: parsed.perPage,
    });

    return textResult(tags);
  },

  async gitlab_protect_tag(args) {
    const parsed = protectTagSchema.parse(args ?? {});
    const tag = await gitlab.ProtectedTags.protect(parsed.projectIdOrPath, parsed.tagName, {
      createAccessLevel: mapAccessLevel(parsed.createAccessLevel),
      allowedToCreate: parsed.allowedToCreate?.map(mapProtectedBranchAllowEntity) as any,
    });

    return textResult(tag);
  },

  async gitlab_unprotect_tag(args) {
    const parsed = tagActionSchema.parse(args ?? {});
    await gitlab.ProtectedTags.unprotect(parsed.projectIdOrPath, parsed.tagName);

    return textResult({
      unprotected: true,
      tag_name: parsed.tagName,
    });
  },

  async gitlab_list_release_links(args) {
    const parsed = listReleaseLinksSchema.parse(args ?? {});
    const links = await gitlab.ReleaseLinks.all(parsed.projectIdOrPath, parsed.tagName, {
      perPage: parsed.perPage,
    });

    return textResult(links);
  },

  async gitlab_create_release_link(args) {
    const parsed = createReleaseLinkSchema.parse(args ?? {});
    const link = await gitlab.ReleaseLinks.create(
      parsed.projectIdOrPath,
      parsed.tagName,
      parsed.name,
      parsed.url,
      {
        linkType: parsed.linkType,
        directAssetPath: parsed.directAssetPath,
        filePath: parsed.filePath,
      },
    );

    return textResult(link);
  },

  async gitlab_update_release_link(args) {
    const parsed = updateReleaseLinkSchema.parse(args ?? {});
    const link = await gitlab.ReleaseLinks.edit(parsed.projectIdOrPath, parsed.tagName, parsed.linkId, {
      name: parsed.name,
      url: parsed.url,
      linkType: parsed.linkType,
      directAssetPath: parsed.directAssetPath,
      filePath: parsed.filePath,
    });

    return textResult(link);
  },

  async gitlab_remove_release_link(args) {
    const parsed = removeReleaseLinkSchema.parse(args ?? {});
    await gitlab.ReleaseLinks.remove(parsed.projectIdOrPath, parsed.tagName, parsed.linkId);

    return textResult({
      removed: true,
      link_id: parsed.linkId,
      tag_name: parsed.tagName,
    });
  },

  async gitlab_list_project_variables(args) {
    const parsed = listProjectVariablesSchema.parse(args ?? {});
    const variables = await gitlab.ProjectVariables.all(parsed.projectIdOrPath, {
      perPage: parsed.perPage,
    });

    return textResult(variables);
  },

  async gitlab_upsert_project_variable(args) {
    const parsed = upsertProjectVariableSchema.parse(args ?? {});

    const editOptions: any = {
      variableType: parsed.variableType,
      protected: parsed.protected,
      masked: parsed.masked,
      masked_and_hidden: parsed.maskedAndHidden,
      raw: parsed.raw,
      description: parsed.description,
      filter: {
        environment_scope: parsed.environmentScope ?? "*",
      },
    };

    try {
      const updated = await gitlab.ProjectVariables.edit(
        parsed.projectIdOrPath,
        parsed.key,
        parsed.value,
        editOptions,
      );
      return textResult({ action: "updated", ...updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!message.toLowerCase().includes("404")) {
        throw error;
      }

      const created = await gitlab.ProjectVariables.create(parsed.projectIdOrPath, parsed.key, parsed.value, {
        variableType: parsed.variableType,
        protected: parsed.protected,
        masked: parsed.masked,
        masked_and_hidden: parsed.maskedAndHidden,
        raw: parsed.raw,
        description: parsed.description,
        environmentScope: parsed.environmentScope,
      });

      return textResult({ action: "created", ...created });
    }
  },

  async gitlab_remove_project_variable(args) {
    const parsed = removeProjectVariableSchema.parse(args ?? {});
    await gitlab.ProjectVariables.remove(parsed.projectIdOrPath, parsed.key, {
      filter: parsed.environmentScope ? { environment_scope: parsed.environmentScope } : undefined,
    });

    return textResult({
      removed: true,
      key: parsed.key,
      environment_scope: parsed.environmentScope,
    });
  },

  async gitlab_list_jobs(args) {
    const parsed = listJobsSchema.parse(args ?? {});
    const jobs = await gitlab.Jobs.all(parsed.projectIdOrPath, {
      pipelineId: parsed.pipelineId,
      scope: parsed.scope,
      includeRetried: parsed.includeRetried,
      perPage: parsed.perPage,
    });

    return textResult(
      jobs.map((job) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        stage: job.stage,
        ref: job.ref,
        web_url: job.web_url,
        created_at: job.created_at,
      })),
    );
  },

  async gitlab_get_job(args) {
    const parsed = jobActionSchema.parse(args ?? {});
    const job = await gitlab.Jobs.show(parsed.projectIdOrPath, parsed.jobId);

    return textResult(job);
  },

  async gitlab_get_job_log(args) {
    const parsed = jobActionSchema.parse(args ?? {});
    const log = await gitlab.Jobs.showLog(parsed.projectIdOrPath, parsed.jobId);

    return textResult({
      job_id: parsed.jobId,
      log,
    });
  },

  async gitlab_retry_job(args) {
    const parsed = jobActionSchema.parse(args ?? {});
    const job = await gitlab.Jobs.retry(parsed.projectIdOrPath, parsed.jobId);

    return textResult(job);
  },

  async gitlab_play_job(args) {
    const parsed = playJobSchema.parse(args ?? {});
    const job = await gitlab.Jobs.play(
      parsed.projectIdOrPath,
      parsed.jobId,
      parsed.jobVariablesAttributes
        ? {
            jobVariablesAttributes: parsed.jobVariablesAttributes,
          }
        : undefined,
    );

    return textResult(job);
  },

  async gitlab_cancel_job(args) {
    const parsed = jobActionSchema.parse(args ?? {});
    const job = await gitlab.Jobs.cancel(parsed.projectIdOrPath, parsed.jobId);

    return textResult(job);
  },

  async gitlab_erase_job(args) {
    const parsed = jobActionSchema.parse(args ?? {});
    const job = await gitlab.Jobs.erase(parsed.projectIdOrPath, parsed.jobId);

    return textResult(job);
  },

  async gitlab_download_job_artifacts(args) {
    const parsed = downloadJobArtifactsSchema.parse(args ?? {});
    const artifactOptions =
      typeof parsed.jobId === "number"
        ? parsed.artifactPath
          ? { jobId: parsed.jobId, artifactPath: parsed.artifactPath }
          : { jobId: parsed.jobId }
        : parsed.artifactPath
          ? { ref: parsed.ref!, job: parsed.job!, artifactPath: parsed.artifactPath }
          : { ref: parsed.ref!, job: parsed.job! };

    const artifactBlob = await gitlab.JobArtifacts.downloadArchive(parsed.projectIdOrPath, artifactOptions);
    const buffer = Buffer.from(await artifactBlob.arrayBuffer());

    return textResult({
      encoding: "base64",
      byteLength: buffer.length,
      content: buffer.toString("base64"),
    });
  },

  async gitlab_keep_job_artifacts(args) {
    const parsed = jobActionSchema.parse(args ?? {});
    const job = await gitlab.JobArtifacts.keep(parsed.projectIdOrPath, parsed.jobId);

    return textResult(job);
  },

  async gitlab_remove_job_artifacts(args) {
    const parsed = jobActionSchema.partial({ jobId: true }).parse(args ?? {});
    await gitlab.JobArtifacts.remove(parsed.projectIdOrPath, {
      jobId: parsed.jobId,
    });

    return textResult({
      removed: true,
      job_id: parsed.jobId,
    });
  },

  async gitlab_list_environments(args) {
    const parsed = listEnvironmentsSchema.parse(args ?? {});
    const environments = parsed.search
      ? await gitlab.Environments.all(parsed.projectIdOrPath, {
          search: parsed.search,
          states: parsed.states,
          perPage: parsed.perPage,
        })
      : parsed.name
        ? await gitlab.Environments.all(parsed.projectIdOrPath, {
            name: parsed.name,
            states: parsed.states,
            perPage: parsed.perPage,
          })
        : await gitlab.Environments.all(parsed.projectIdOrPath, {
            states: parsed.states,
            perPage: parsed.perPage,
          });

    return textResult(environments);
  },

  async gitlab_create_environment(args) {
    const parsed = createEnvironmentSchema.parse(args ?? {});
    const environment = await gitlab.Environments.create(parsed.projectIdOrPath, parsed.name, {
      externalUrl: parsed.externalUrl,
      tier: parsed.tier,
    });

    return textResult(environment);
  },

  async gitlab_stop_environment(args) {
    const parsed = stopEnvironmentSchema.parse(args ?? {});
    const environment = await gitlab.Environments.stop(parsed.projectIdOrPath, parsed.environmentId, {
      force: parsed.force ? "true" : undefined,
    });

    return textResult(environment);
  },

  async gitlab_remove_environment(args) {
    const parsed = removeEnvironmentSchema.parse(args ?? {});
    await gitlab.Environments.remove(parsed.projectIdOrPath, parsed.environmentId);

    return textResult({
      removed: true,
      environment_id: parsed.environmentId,
    });
  },

  async gitlab_list_deployments(args) {
    const parsed = listDeploymentsSchema.parse(args ?? {});
    const deployments = await gitlab.Deployments.all(parsed.projectIdOrPath, {
      environment: parsed.environment,
      status: parsed.status,
      perPage: parsed.perPage,
      orderBy: "created_at",
      sort: "desc",
    });

    return textResult(deployments);
  },

  async gitlab_get_deployment(args) {
    const parsed = getDeploymentSchema.parse(args ?? {});
    const deployment = await gitlab.Deployments.show(parsed.projectIdOrPath, parsed.deploymentId);

    return textResult(deployment);
  },

  async gitlab_create_deployment(args) {
    const parsed = createDeploymentSchema.parse(args ?? {});
    const deployment = await gitlab.Deployments.create(
      parsed.projectIdOrPath,
      parsed.environment,
      parsed.sha,
      parsed.ref,
      parsed.tag,
      {
        status: parsed.status,
      },
    );

    return textResult(deployment);
  },

  async gitlab_edit_deployment_status(args) {
    const parsed = editDeploymentStatusSchema.parse(args ?? {});
    const deployment = await gitlab.Deployments.edit(
      parsed.projectIdOrPath,
      parsed.deploymentId,
      parsed.status,
    );

    return textResult(deployment);
  },

  async gitlab_remove_deployment(args) {
    const parsed = getDeploymentSchema.parse(args ?? {});
    const result = await gitlab.Deployments.remove(parsed.projectIdOrPath, parsed.deploymentId);

    return textResult(result);
  },

  async gitlab_set_deployment_approval(args) {
    const parsed = setDeploymentApprovalSchema.parse(args ?? {});
    const approval = await gitlab.Deployments.setApproval(
      parsed.projectIdOrPath,
      parsed.deploymentId,
      parsed.status,
      {
        comment: parsed.comment,
      },
    );

    return textResult(approval);
  },

  async gitlab_get_tools_catalog() {
    return textResult({
      generated_at: new Date().toISOString(),
      server: "gitlab-mcp-server",
      tools: TOOL_DEFINITIONS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
  },
};

const TOOL_DEFINITIONS = [
      {
        name: "gitlab_list_projects",
        description: "List available GitLab projects for the current token.",
        inputSchema: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description: "Optional project name/path search query.",
            },
            membership: {
              type: "boolean",
              description: "When true, only projects where token user is a member.",
              default: true,
            },
            perPage: {
              type: "number",
              description: "Maximum number of results (1-100).",
              default: 20,
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_get_project",
        description: "Get details for a GitLab project by id or path_with_namespace.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_merge_requests",
        description: "List merge requests for a GitLab project.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            state: {
              type: "string",
              enum: ["opened", "closed", "locked", "merged", "all"],
              default: "opened",
            },
            perPage: {
              type: "number",
              description: "Maximum number of results (1-100).",
              default: 20,
            },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_issue",
        description: "Create a new issue in a GitLab project.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            title: {
              type: "string",
              description: "Issue title.",
            },
            description: {
              type: "string",
              description: "Optional issue description.",
            },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Optional list of labels.",
            },
            assigneeIds: {
              type: "array",
              items: { type: "number" },
              description: "Optional list of assignee user ids.",
            },
          },
          required: ["projectIdOrPath", "title"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_merge_request",
        description: "Create a merge request in a GitLab project.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            sourceBranch: {
              type: "string",
              description: "Source branch name.",
            },
            targetBranch: {
              type: "string",
              description: "Target branch name.",
            },
            title: {
              type: "string",
              description: "Merge request title.",
            },
            description: {
              type: "string",
              description: "Optional merge request description.",
            },
            removeSourceBranch: {
              type: "boolean",
              description: "Remove source branch when merge request is merged.",
            },
            squash: {
              type: "boolean",
              description: "Squash commits on merge.",
            },
            assigneeId: {
              type: "number",
              description: "Optional assignee user id.",
            },
          },
          required: ["projectIdOrPath", "sourceBranch", "targetBranch", "title"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_edit_merge_request",
        description: "Edit an existing merge request in a GitLab project.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            mergeRequestIid: {
              type: "number",
              description: "Merge request IID (internal id in project).",
            },
            targetBranch: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            assigneeId: { type: "number" },
            assigneeIds: { type: "array", items: { type: "number" } },
            reviewerIds: { type: "array", items: { type: "number" } },
            labels: { type: "array", items: { type: "string" } },
            addLabels: { type: "array", items: { type: "string" } },
            removeLabels: { type: "array", items: { type: "string" } },
            stateEvent: { type: "string", enum: ["close", "reopen"] },
            removeSourceBranch: { type: "boolean" },
            squash: { type: "boolean" },
            discussionLocked: { type: "boolean" },
            allowCollaboration: { type: "boolean" },
            allowMaintainerToPush: { type: "boolean" },
            milestoneId: { type: "number" },
          },
          required: ["projectIdOrPath", "mergeRequestIid"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_issue_note",
        description: "Add a note (comment) to an issue.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            issueIid: {
              type: "number",
              description: "Issue IID (internal id in project).",
            },
            body: {
              type: "string",
              description: "Comment text.",
            },
          },
          required: ["projectIdOrPath", "issueIid", "body"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_merge_request_note",
        description: "Add a note (comment) to a merge request.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            mergeRequestIid: {
              type: "number",
              description: "Merge request IID (internal id in project).",
            },
            body: {
              type: "string",
              description: "Comment text.",
            },
          },
          required: ["projectIdOrPath", "mergeRequestIid", "body"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_pipelines",
        description: "List project pipelines.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            ref: {
              type: "string",
              description: "Optional branch/tag filter.",
            },
            status: {
              type: "string",
              enum: [
                "created",
                "waiting_for_resource",
                "preparing",
                "pending",
                "running",
                "success",
                "failed",
                "canceled",
                "skipped",
                "manual",
                "scheduled",
              ],
            },
            perPage: {
              type: "number",
              description: "Maximum number of results (1-100).",
              default: 20,
            },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_get_pipeline",
        description: "Get details of a project pipeline.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            pipelineId: {
              type: "number",
              description: "Pipeline id.",
            },
          },
          required: ["projectIdOrPath", "pipelineId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_remove_pipeline",
        description: "Delete a pipeline.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            pipelineId: { type: "number" },
          },
          required: ["projectIdOrPath", "pipelineId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_get_file",
        description: "Read a file from repository at a specific ref.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            filePath: {
              type: "string",
              description: "Repository file path.",
            },
            ref: {
              type: "string",
              description: "Branch, tag, or commit SHA.",
            },
          },
          required: ["projectIdOrPath", "filePath", "ref"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_upsert_file",
        description: "Create file if missing, otherwise update existing file.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            filePath: {
              type: "string",
              description: "Repository file path.",
            },
            branch: {
              type: "string",
              description: "Target branch name.",
            },
            commitMessage: {
              type: "string",
              description: "Commit message.",
            },
            content: {
              type: "string",
              description: "File content (text or base64 by encoding).",
            },
            encoding: {
              type: "string",
              enum: ["text", "base64"],
              default: "text",
            },
          },
          required: ["projectIdOrPath", "filePath", "branch", "commitMessage", "content"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_run_pipeline",
        description: "Run a pipeline for a specific ref.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            ref: {
              type: "string",
              description: "Branch or tag to run pipeline for.",
            },
            variables: {
              type: "array",
              description: "Optional pipeline variables.",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  value: { type: "string" },
                  variableType: { type: "string", enum: ["env_var", "file"] },
                },
                required: ["key", "value"],
                additionalProperties: false,
              },
            },
          },
          required: ["projectIdOrPath", "ref"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_retry_pipeline",
        description: "Retry a failed/canceled pipeline.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            pipelineId: {
              type: "number",
              description: "Pipeline id.",
            },
          },
          required: ["projectIdOrPath", "pipelineId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_cancel_pipeline",
        description: "Cancel a running pipeline.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            pipelineId: {
              type: "number",
              description: "Pipeline id.",
            },
          },
          required: ["projectIdOrPath", "pipelineId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_approve_merge_request",
        description: "Approve a merge request.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            mergeRequestIid: {
              type: "number",
              description: "Merge request IID.",
            },
          },
          required: ["projectIdOrPath", "mergeRequestIid"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_unapprove_merge_request",
        description: "Remove approval from a merge request.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            mergeRequestIid: {
              type: "number",
              description: "Merge request IID.",
            },
          },
          required: ["projectIdOrPath", "mergeRequestIid"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_merge_merge_request",
        description: "Merge an existing merge request.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            mergeRequestIid: {
              type: "number",
              description: "Merge request IID.",
            },
            mergeCommitMessage: {
              type: "string",
            },
            squashCommitMessage: {
              type: "string",
            },
            squash: {
              type: "boolean",
            },
            shouldRemoveSourceBranch: {
              type: "boolean",
            },
            mergeWhenPipelineSucceeds: {
              type: "boolean",
            },
            autoMerge: {
              type: "boolean",
            },
            sha: {
              type: "string",
              description: "Optional source branch SHA for optimistic lock.",
            },
          },
          required: ["projectIdOrPath", "mergeRequestIid"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_branches",
        description: "List repository branches.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            search: {
              type: "string",
              description: "Optional branch name search.",
            },
            perPage: {
              type: "number",
              default: 50,
            },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_branch",
        description: "Create a new branch from a ref.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            branchName: {
              type: "string",
              description: "New branch name.",
            },
            ref: {
              type: "string",
              description: "Existing branch/tag/SHA to branch from.",
            },
          },
          required: ["projectIdOrPath", "branchName", "ref"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_commit",
        description: "Create a commit with multiple file actions in one call.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            branch: {
              type: "string",
            },
            commitMessage: {
              type: "string",
            },
            actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["create", "delete", "move", "update", "chmod"] },
                  filePath: { type: "string" },
                  previousPath: { type: "string" },
                  content: { type: "string" },
                  encoding: { type: "string", enum: ["text", "base64"] },
                  lastCommitId: { type: "string" },
                  execute_filemode: { type: "boolean" },
                },
                required: ["action", "filePath"],
                additionalProperties: false,
              },
            },
            startBranch: { type: "string" },
            startSha: { type: "string" },
            force: { type: "boolean" },
            authorName: { type: "string" },
            authorEmail: { type: "string" },
          },
          required: ["projectIdOrPath", "branch", "commitMessage", "actions"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_tags",
        description: "List project tags.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            search: { type: "string" },
            perPage: { type: "number", default: 30 },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_tag",
        description: "Create a git tag from a ref.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            tagName: { type: "string" },
            ref: { type: "string" },
            message: { type: "string" },
          },
          required: ["projectIdOrPath", "tagName", "ref"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_releases",
        description: "List project releases.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            perPage: { type: "number", default: 20 },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_get_release",
        description: "Get release details by tag name.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            tagName: { type: "string" },
          },
          required: ["projectIdOrPath", "tagName"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_release_evidence",
        description: "Create release evidence for tag.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            tagName: { type: "string" },
          },
          required: ["projectIdOrPath", "tagName"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_release",
        description: "Create a release for a tag.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            tagName: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            ref: { type: "string" },
            releasedAt: { type: "string", description: "ISO8601 datetime." },
          },
          required: ["projectIdOrPath", "tagName"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_update_release",
        description: "Update release fields by tag name.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            tagName: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            releasedAt: { type: "string", description: "ISO8601 datetime." },
          },
          required: ["projectIdOrPath", "tagName"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_show_changelog",
        description: "Generate changelog preview for a version.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            version: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
            date: { type: "string" },
            trailer: { type: "string" },
            configFile: { type: "string" },
          },
          required: ["projectIdOrPath", "version"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_edit_changelog",
        description: "Generate and commit changelog update.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            version: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
            date: { type: "string" },
            trailer: { type: "string" },
            configFile: { type: "string" },
            branch: { type: "string" },
            file: { type: "string" },
            message: { type: "string" },
          },
          required: ["projectIdOrPath", "version"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_merge_request_discussions",
        description: "List discussions for a merge request.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            mergeRequestIid: { type: "number" },
            perPage: { type: "number", default: 50 },
          },
          required: ["projectIdOrPath", "mergeRequestIid"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_merge_request_discussion",
        description: "Create a new discussion in a merge request.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            mergeRequestIid: { type: "number" },
            body: { type: "string" },
          },
          required: ["projectIdOrPath", "mergeRequestIid", "body"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_merge_request_discussion_note",
        description: "Reply in an existing merge request discussion.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            mergeRequestIid: { type: "number" },
            discussionId: { type: "string" },
            body: { type: "string" },
          },
          required: ["projectIdOrPath", "mergeRequestIid", "discussionId", "body"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_resolve_merge_request_discussion",
        description: "Resolve a merge request discussion thread.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            mergeRequestIid: { type: "number" },
            discussionId: { type: "string" },
          },
          required: ["projectIdOrPath", "mergeRequestIid", "discussionId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_unresolve_merge_request_discussion",
        description: "Re-open a resolved merge request discussion thread.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: {
              oneOf: [{ type: "string" }, { type: "number" }],
              description: "Project numeric id or path like group/project.",
            },
            mergeRequestIid: { type: "number" },
            discussionId: { type: "string" },
          },
          required: ["projectIdOrPath", "mergeRequestIid", "discussionId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_protected_branches",
        description: "List protected branches of project.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            search: { type: "string" },
            perPage: { type: "number", default: 50 },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_protect_branch",
        description: "Protect a branch with selected access levels.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            branchName: { type: "string" },
            mergeAccessLevel: { oneOf: [{ type: "number" }, { type: "string" }] },
            pushAccessLevel: { oneOf: [{ type: "number" }, { type: "string" }] },
            unprotectAccessLevel: { oneOf: [{ type: "number" }, { type: "string" }] },
            allowedToMerge: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  userId: { type: "number" },
                  groupId: { type: "number" },
                  accessLevel: { oneOf: [{ type: "number" }, { type: "string" }] },
                },
                additionalProperties: false,
              },
            },
            allowedToPush: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  userId: { type: "number" },
                  groupId: { type: "number" },
                  accessLevel: { oneOf: [{ type: "number" }, { type: "string" }] },
                },
                additionalProperties: false,
              },
            },
            allowedToUnprotect: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  userId: { type: "number" },
                  groupId: { type: "number" },
                  accessLevel: { oneOf: [{ type: "number" }, { type: "string" }] },
                },
                additionalProperties: false,
              },
            },
            allowForcePush: { type: "boolean" },
            codeOwnerApprovalRequired: { type: "boolean" },
          },
          required: ["projectIdOrPath", "branchName"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_unprotect_branch",
        description: "Remove branch protection.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            branchName: { type: "string" },
          },
          required: ["projectIdOrPath", "branchName"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_protected_tags",
        description: "List protected tags of project.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            perPage: { type: "number", default: 50 },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_protect_tag",
        description: "Protect a tag pattern with access level.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            tagName: { type: "string" },
            createAccessLevel: { oneOf: [{ type: "number" }, { type: "string" }] },
            allowedToCreate: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  userId: { type: "number" },
                  groupId: { type: "number" },
                  accessLevel: { oneOf: [{ type: "number" }, { type: "string" }] },
                },
                additionalProperties: false,
              },
            },
          },
          required: ["projectIdOrPath", "tagName"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_unprotect_tag",
        description: "Remove tag protection.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            tagName: { type: "string" },
          },
          required: ["projectIdOrPath", "tagName"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_release_links",
        description: "List release links/assets for tag.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            tagName: { type: "string" },
            perPage: { type: "number", default: 50 },
          },
          required: ["projectIdOrPath", "tagName"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_release_link",
        description: "Create release link/asset.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            tagName: { type: "string" },
            name: { type: "string" },
            url: { type: "string" },
            linkType: { type: "string" },
            directAssetPath: { type: "string" },
            filePath: { type: "string" },
          },
          required: ["projectIdOrPath", "tagName", "name", "url"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_update_release_link",
        description: "Update release link/asset.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            tagName: { type: "string" },
            linkId: { type: "number" },
            name: { type: "string" },
            url: { type: "string" },
            linkType: { type: "string" },
            directAssetPath: { type: "string" },
            filePath: { type: "string" },
          },
          required: ["projectIdOrPath", "tagName", "linkId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_remove_release_link",
        description: "Remove release link/asset.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            tagName: { type: "string" },
            linkId: { type: "number" },
          },
          required: ["projectIdOrPath", "tagName", "linkId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_project_variables",
        description: "List project CI/CD variables.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            perPage: { type: "number", default: 100 },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_upsert_project_variable",
        description: "Create or update project variable.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            key: { type: "string" },
            value: { type: "string" },
            environmentScope: { type: "string" },
            variableType: { type: "string", enum: ["env_var", "file"] },
            protected: { type: "boolean" },
            masked: { type: "boolean" },
            maskedAndHidden: { type: "boolean" },
            raw: { type: "boolean" },
            description: { type: "string" },
          },
          required: ["projectIdOrPath", "key", "value"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_remove_project_variable",
        description: "Remove project variable by key.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            key: { type: "string" },
            environmentScope: { type: "string" },
          },
          required: ["projectIdOrPath", "key"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_jobs",
        description: "List CI jobs for project/pipeline.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            pipelineId: { type: "number" },
            scope: { type: "string" },
            includeRetried: { type: "boolean" },
            perPage: { type: "number", default: 50 },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_get_job",
        description: "Get job details.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            jobId: { type: "number" },
          },
          required: ["projectIdOrPath", "jobId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_get_job_log",
        description: "Get raw job trace log.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            jobId: { type: "number" },
          },
          required: ["projectIdOrPath", "jobId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_retry_job",
        description: "Retry CI job.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            jobId: { type: "number" },
          },
          required: ["projectIdOrPath", "jobId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_play_job",
        description: "Play manual CI job.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            jobId: { type: "number" },
            jobVariablesAttributes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  value: { type: "string" },
                },
                required: ["key", "value"],
                additionalProperties: false,
              },
            },
          },
          required: ["projectIdOrPath", "jobId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_cancel_job",
        description: "Cancel running CI job.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            jobId: { type: "number" },
          },
          required: ["projectIdOrPath", "jobId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_erase_job",
        description: "Erase CI job log and artifacts.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            jobId: { type: "number" },
          },
          required: ["projectIdOrPath", "jobId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_download_job_artifacts",
        description: "Download job artifacts as base64 zip/blob.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            jobId: { type: "number" },
            ref: { type: "string" },
            job: { type: "string" },
            artifactPath: { type: "string" },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_keep_job_artifacts",
        description: "Mark job artifacts to be kept.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            jobId: { type: "number" },
          },
          required: ["projectIdOrPath", "jobId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_remove_job_artifacts",
        description: "Delete artifacts for one job or entire project.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            jobId: { type: "number" },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_environments",
        description: "List project environments.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            search: { type: "string" },
            name: { type: "string" },
            states: { type: "string" },
            perPage: { type: "number", default: 50 },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_environment",
        description: "Create project environment.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            name: { type: "string" },
            externalUrl: { type: "string" },
            tier: { type: "string" },
          },
          required: ["projectIdOrPath", "name"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_stop_environment",
        description: "Stop project environment.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            environmentId: { type: "number" },
            force: { type: "boolean" },
          },
          required: ["projectIdOrPath", "environmentId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_remove_environment",
        description: "Remove project environment.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            environmentId: { type: "number" },
          },
          required: ["projectIdOrPath", "environmentId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_list_deployments",
        description: "List project deployments.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            environment: { type: "string" },
            status: { type: "string" },
            perPage: { type: "number", default: 50 },
          },
          required: ["projectIdOrPath"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_get_deployment",
        description: "Get deployment details.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            deploymentId: { type: "number" },
          },
          required: ["projectIdOrPath", "deploymentId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_create_deployment",
        description: "Create deployment record.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            environment: { type: "string" },
            sha: { type: "string" },
            ref: { type: "string" },
            tag: { type: "boolean" },
            status: { type: "string", enum: ["running", "success", "failed", "canceled"] },
          },
          required: ["projectIdOrPath", "environment", "sha", "ref", "tag"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_edit_deployment_status",
        description: "Edit deployment status.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            deploymentId: { type: "number" },
            status: { type: "string", enum: ["running", "success", "failed", "canceled"] },
          },
          required: ["projectIdOrPath", "deploymentId", "status"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_remove_deployment",
        description: "Remove deployment record.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            deploymentId: { type: "number" },
          },
          required: ["projectIdOrPath", "deploymentId"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_set_deployment_approval",
        description: "Approve or reject deployment approval gate.",
        inputSchema: {
          type: "object",
          properties: {
            projectIdOrPath: { oneOf: [{ type: "string" }, { type: "number" }] },
            deploymentId: { type: "number" },
            status: { type: "string", enum: ["approved", "rejected"] },
            comment: { type: "string" },
          },
          required: ["projectIdOrPath", "deploymentId", "status"],
          additionalProperties: false,
        },
      },
      {
        name: "gitlab_get_tools_catalog",
        description: "Export catalog of all MCP tools and schemas.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOL_DEFINITIONS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const handler = handlers[request.params.name];

  if (!handler) {
    return errorResult(`Unknown tool: ${request.params.name}`);
  }

  try {
    return await handler(request.params.arguments);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(message);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Fatal error: ${message}\n`);
  process.exit(1);
});

function mapAccessLevel(
  value: number | "no_access" | "developer" | "maintainer" | "admin" | undefined,
): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (!value) {
    return undefined;
  }

  const mapping: Record<"no_access" | "developer" | "maintainer" | "admin", number> = {
    no_access: 0,
    developer: 30,
    maintainer: 40,
    admin: 60,
  };

  return mapping[value];
}

function mapProtectedBranchAllowEntity(value: {
  userId?: number;
  groupId?: number;
  accessLevel?: number | "no_access" | "developer" | "maintainer" | "admin";
}): { userId: number } | { groupId: number } | { accessLevel: number } {
  if (value.userId) {
    return { userId: value.userId };
  }
  if (value.groupId) {
    return { groupId: value.groupId };
  }
  return {
    accessLevel: mapAccessLevel(value.accessLevel)!,
  };
}

function textResult(payload: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function errorResult(message: string): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message,
      },
    ],
  };
}

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STALE_DAYS = 30;
const TODAY = new Date().toISOString().slice(0, 10);
const ENV_EXCLUDES = [":!*.env", ":!*.env.*", ":!**/.env", ":!**/.env.*"];
const IGNORE_DIRS = new Set([".git", "node_modules", ".pi", ".next", "dist", "build", "target", "vendor"]);

type RepoResult = {
	path: string;
	status: "skipped" | "pushed" | "empty-paused" | "initialized" | "deleted" | "error";
	reason?: string;
	remote?: string;
	remoteName?: string;
	branch?: string;
};

type CleanupParams = {
	root?: string;
	staleDays?: number;
	dryRun?: boolean;
	includeRecentlyOpened?: boolean;
};

type Target = { path: string; kind: "git" | "non-git" | "bitbucket"; reason?: string };

function run(cmd: string, args: string[], cwd: string): string {
	return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function tryRun(cmd: string, args: string[], cwd: string): { ok: boolean; out: string } {
	const res = spawnSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	return { ok: res.status === 0, out: `${res.stdout ?? ""}${res.stderr ?? ""}`.trim() };
}

function isBitbucketPath(path: string): boolean {
	return path.split(/[\\/]+/).includes("bitbucket");
}

function isGitRepo(path: string): boolean {
	return tryRun("git", ["rev-parse", "--is-inside-work-tree"], path).ok;
}

function findTargets(root: string): Target[] {
	const targets: Target[] = [];
	function walk(dir: string) {
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		const hasGitMarker = entries.some((entry) => entry.name === ".git");
		if (hasGitMarker) {
			if (isBitbucketPath(dir)) targets.push({ path: dir, kind: "bitbucket" });
			else if (isGitRepo(dir)) targets.push({ path: dir, kind: "git" });
			else targets.push({ path: dir, kind: "non-git", reason: "contains an invalid/incomplete .git directory" });
			return;
		}
		for (const entry of entries) {
			if (!entry.isDirectory() || IGNORE_DIRS.has(entry.name)) continue;
			walk(join(dir, entry.name));
		}
	}
	walk(root);
	return targets.sort((a, b) => a.path.localeCompare(b.path));
}

function macLastOpened(path: string): number | undefined {
	const res = tryRun("mdls", ["-raw", "-name", "kMDItemLastUsedDate", path], process.cwd());
	if (!res.ok || !res.out || res.out === "(null)") return undefined;
	const time = Date.parse(res.out);
	return Number.isNaN(time) ? undefined : time;
}

function newestMeaningfulMtime(path: string): number {
	let newest = 0;
	function walk(dir: string) {
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.name === ".DS_Store" || entry.name.endsWith(".env") || entry.name.includes(".env.")) continue;
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!IGNORE_DIRS.has(entry.name)) walk(full);
				continue;
			}
			try {
				newest = Math.max(newest, statSync(full).mtimeMs);
			} catch {
				// ignore disappearing files
			}
		}
	}
	walk(path);
	return newest;
}

function lastActivity(path: string): number {
	const opened = macLastOpened(path);
	const commit = tryRun("git", ["log", "-1", "--format=%ct"], path);
	const commitMs = commit.ok && commit.out ? Number(commit.out) * 1000 : 0;
	return Math.max(opened ?? 0, commitMs, newestMeaningfulMtime(path));
}

function isMeaningfullyEmpty(path: string): boolean {
	function walk(dir: string): boolean {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name === ".git" || entry.name === ".DS_Store" || entry.name.endsWith(".env") || entry.name.includes(".env.")) continue;
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!walk(full)) return false;
			} else {
				return false;
			}
		}
		return true;
	}
	return walk(path);
}

function repoNameFor(path: string): string {
	return basename(path).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "archived-project";
}

function parseGithubRepo(url: string): { owner: string; repo: string } | undefined {
	const cleaned = url.replace(/\.git$/, "");
	const ssh = cleaned.match(/github\.com[:/]([^/]+)\/([^/]+)$/i);
	if (!ssh) return undefined;
	return { owner: ssh[1], repo: ssh[2] };
}

function currentGithubUser(path: string): string {
	return run("gh", ["api", "user", "-q", ".login"], path);
}

function addOrSetRemote(path: string, name: string, url: string) {
	const existing = tryRun("git", ["remote", "get-url", name], path);
	if (existing.ok) run("git", ["remote", "set-url", name, url], path);
	else run("git", ["remote", "add", name, url], path);
}

function ensurePrivateGithubRemote(path: string): { remoteName: string; remoteUrl: string } {
	const existing = tryRun("git", ["remote", "get-url", "origin"], path);
	if (existing.ok && existing.out) return { remoteName: "origin", remoteUrl: existing.out };

	const owner = currentGithubUser(path);
	const repo = repoNameFor(path);
	const full = `${owner}/${repo}`;
	const view = tryRun("gh", ["repo", "view", full, "--json", "url", "-q", ".url"], path);
	if (view.ok && view.out) {
		const gitUrl = `${view.out}.git`;
		addOrSetRemote(path, "origin", gitUrl);
		return { remoteName: "origin", remoteUrl: gitUrl };
	}

	run("gh", ["repo", "create", full, "--private", "--source=.", "--remote=origin"], path);
	const remoteUrl = tryRun("git", ["remote", "get-url", "origin"], path).out || `git@github.com:${full}.git`;
	return { remoteName: "origin", remoteUrl };
}

function ensureForkRemote(path: string, originUrl: string): { remoteName: string; remoteUrl: string } | undefined {
	const parsed = parseGithubRepo(originUrl);
	if (!parsed) return undefined;
	const user = currentGithubUser(path);
	if (parsed.owner.toLowerCase() === user.toLowerCase()) return { remoteName: "origin", remoteUrl: originUrl };

	const forkFull = `${user}/${parsed.repo}`;
	let forkWebUrl = tryRun("gh", ["repo", "view", forkFull, "--json", "url", "-q", ".url"], path).out;
	if (!forkWebUrl) {
		tryRun("gh", ["repo", "fork", `${parsed.owner}/${parsed.repo}`, "--clone=false"], path);
		forkWebUrl = run("gh", ["repo", "view", forkFull, "--json", "url", "-q", ".url"], path);
	}
	const forkUrl = `${forkWebUrl}.git`;
	addOrSetRemote(path, "cleanup-fork", forkUrl);
	return { remoteName: "cleanup-fork", remoteUrl: forkUrl };
}

function ensureWritableRemote(path: string): { remoteName: string; remoteUrl: string } {
	const origin = tryRun("git", ["remote", "get-url", "origin"], path);
	if (!origin.ok || !origin.out) return ensurePrivateGithubRemote(path);
	return ensureForkRemote(path, origin.out) ?? { remoteName: "origin", remoteUrl: origin.out };
}

function protectEnvFromAccidentalAdds(path: string) {
	const info = join(path, ".git", "info");
	mkdirSync(info, { recursive: true });
	const excludePath = join(info, "exclude");
	const block = "\n# Added by pi repo-cleanup-agent: never archive local env files\n.env\n.env.*\n*.env\n*.env.*\n";
	const current = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";
	if (!current.includes("repo-cleanup-agent")) writeFileSync(excludePath, current + block);
}

function pushCleanupBranch(repo: string, remoteName: string, branch: string): { ok: boolean; out: string } {
	let push = tryRun("git", ["push", "--force-with-lease", "-u", remoteName, branch], repo);
	if (!push.ok && /stale info|fetch first|non-fast-forward/i.test(push.out)) {
		tryRun("git", ["fetch", remoteName, `${branch}:refs/remotes/${remoteName}/${branch}`], repo);
		push = tryRun("git", ["push", "--force-with-lease", "-u", remoteName, branch], repo);
	}
	return push;
}

async function maybeWriteReadmeForEmptyProject(repo: string, params: Required<CleanupParams>, ctx: any): Promise<RepoResult | undefined> {
	if (!isMeaningfullyEmpty(repo)) return undefined;
	if (params.dryRun) return { path: repo, status: "empty-paused", reason: "empty project; would ask for README context" };
	if (!ctx.hasUI) return { path: repo, status: "empty-paused", reason: "empty project; no UI available for context prompt" };
	const context = await ctx.ui.input(
		`Empty project found: ${relative(params.root, repo) || repo}`,
		"What should this project become? I will put this in README.md instead of deleting it."
	);
	if (!context?.trim()) return { path: repo, status: "empty-paused", reason: "empty project; user did not provide context" };
	writeFileSync(join(repo, "README.md"), `# ${basename(repo)}\n\n${context.trim()}\n`);
	return undefined;
}

async function processNonGitProject(repo: string, reason: string | undefined, params: Required<CleanupParams>, ctx: any): Promise<RepoResult> {
	const cutoff = Date.now() - params.staleDays * DAY_MS;
	const activity = lastActivity(repo);
	if (!params.includeRecentlyOpened && activity > cutoff) {
		return { path: repo, status: "skipped", reason: `non-git project ${reason ? `(${reason}) ` : ""}opened/changed within ${params.staleDays} days` };
	}
	if (params.dryRun) return { path: repo, status: "skipped", reason: `dry-run: would ask whether to initialize git${reason ? ` (${reason})` : ""}` };
	if (!ctx.hasUI) return { path: repo, status: "skipped", reason: `non-git project needs confirmation before git init${reason ? ` (${reason})` : ""}` };
	const ok = await ctx.ui.confirm(
		`Initialize git for ${relative(params.root, repo) || repo}?`,
		`${reason ?? "This folder is not currently a valid git repository."}\n\nInitialize git, commit non-.env code, create/use a private GitHub repo, and push cleanup/${TODAY}?`
	);
	if (!ok) {
		const deleteInstead = await ctx.ui.confirm(
			`Delete skipped non-git project ${relative(params.root, repo) || repo}?`,
			"You declined git initialization. Delete this local skipped project folder instead?"
		);
		if (!deleteInstead) return { path: repo, status: "skipped", reason: "user declined git initialization and deletion" };
		rmSync(repo, { recursive: true, force: true });
		return { path: repo, status: "deleted", reason: "deleted skipped non-git project after user confirmation" };
	}
	const emptyResult = await maybeWriteReadmeForEmptyProject(repo, params, ctx);
	if (emptyResult) return emptyResult;
	run("git", ["init"], repo);
	const pushed = await processRepo(repo, params, ctx);
	return { ...pushed, status: pushed.status === "pushed" ? "initialized" : pushed.status };
}

async function processBitbucketProject(repo: string, params: Required<CleanupParams>, ctx: any): Promise<RepoResult> {
	const cutoff = Date.now() - params.staleDays * DAY_MS;
	const activity = lastActivity(repo);
	if (!params.includeRecentlyOpened && activity > cutoff) return { path: repo, status: "skipped", reason: `bitbucket repo opened/changed within ${params.staleDays} days` };
	if (params.dryRun) return { path: repo, status: "deleted", reason: `dry-run: would delete ${params.includeRecentlyOpened ? "included" : "stale"} bitbucket repo` };
	if (!ctx.hasUI) return { path: repo, status: "skipped", reason: "stale bitbucket repo needs deletion confirmation; no UI available" };
	const ok = await ctx.ui.confirm(
		`Delete stale bitbucket repo ${relative(params.root, repo) || repo}?`,
		`This bitbucket repo appears unused for ${params.staleDays}+ days. Delete this local folder permanently?`
	);
	if (!ok) return { path: repo, status: "skipped", reason: "user declined stale bitbucket repo deletion" };
	rmSync(repo, { recursive: true, force: true });
	return { path: repo, status: "deleted", reason: "deleted stale bitbucket repo" };
}

function hasGitMarkers(path: string): boolean {
	if (!existsSync(path)) return false;
	let entries;
	try {
		entries = readdirSync(path, { withFileTypes: true });
	} catch {
		return false;
	}
	if (entries.some((entry) => entry.name === ".git")) return true;
	return entries.some((entry) => entry.isDirectory() && !IGNORE_DIRS.has(entry.name) && hasGitMarkers(join(path, entry.name)));
}

async function maybeDeleteBitbucketRoot(root: string, params: Required<CleanupParams>, ctx: any): Promise<RepoResult | undefined> {
	const bitbucketRoot = join(root, "bitbucket");
	if (!existsSync(bitbucketRoot) || hasGitMarkers(bitbucketRoot)) return undefined;
	if (params.dryRun) return { path: bitbucketRoot, status: "deleted", reason: "dry-run: would delete bitbucket/ because no bitbucket repos remain" };
	if (!ctx.hasUI) return { path: bitbucketRoot, status: "skipped", reason: "bitbucket/ has no repos left but needs deletion confirmation; no UI available" };
	const ok = await ctx.ui.confirm("Delete empty bitbucket/ workspace folder?", "All detected bitbucket repos are gone. Delete the bitbucket/ folder too?");
	if (!ok) return { path: bitbucketRoot, status: "skipped", reason: "user declined bitbucket/ deletion" };
	rmSync(bitbucketRoot, { recursive: true, force: true });
	return { path: bitbucketRoot, status: "deleted", reason: "deleted bitbucket/ because no repos remain" };
}

async function processRepo(repo: string, params: Required<CleanupParams>, ctx: any): Promise<RepoResult> {
	const cutoff = Date.now() - params.staleDays * DAY_MS;
	const activity = lastActivity(repo);
	if (!params.includeRecentlyOpened && activity > cutoff) {
		return { path: repo, status: "skipped", reason: `opened/changed within ${params.staleDays} days` };
	}

	const emptyResult = await maybeWriteReadmeForEmptyProject(repo, params, ctx);
	if (emptyResult) return emptyResult;

	const branch = `cleanup/${TODAY}`;
	if (params.dryRun) return { path: repo, status: "pushed", branch, reason: "dry-run: would create private remote or fork upstream, commit, and push" };

	protectEnvFromAccidentalAdds(repo);
	const remote = ensureWritableRemote(repo);
	tryRun("git", ["checkout", "-B", branch], repo);
	run("git", ["add", "-A", "--", ".", ...ENV_EXCLUDES], repo);
	const diff = tryRun("git", ["diff", "--cached", "--quiet"], repo);
	if (!diff.ok) run("git", ["commit", "-m", `Archive stale project cleanup ${TODAY}`], repo);
	let push = pushCleanupBranch(repo, remote.remoteName, branch);
	if (!push.ok && remote.remoteName === "origin") {
		const originUrl = tryRun("git", ["remote", "get-url", "origin"], repo).out;
		const fork = ensureForkRemote(repo, originUrl);
		if (fork) {
			push = pushCleanupBranch(repo, fork.remoteName, branch);
			if (push.ok) return { path: repo, status: "pushed", remote: fork.remoteUrl, remoteName: fork.remoteName, branch };
		}
	}
	if (!push.ok) throw new Error(push.out);
	return { path: repo, status: "pushed", remote: remote.remoteUrl, remoteName: remote.remoteName, branch };
}

export default function repoCleanupAgent(pi: ExtensionAPI) {
	async function executeCleanup(params: CleanupParams, ctx: any) {
		const root = params.root || process.cwd();
		const fullParams: Required<CleanupParams> = {
			root,
			staleDays: params.staleDays ?? DEFAULT_STALE_DAYS,
			dryRun: params.dryRun ?? false,
			includeRecentlyOpened: params.includeRecentlyOpened ?? false,
		};
		const targets = findTargets(root);
		const results: RepoResult[] = [];
		for (const target of targets) {
			try {
				if (target.kind === "git") results.push(await processRepo(target.path, fullParams, ctx));
				else if (target.kind === "bitbucket") results.push(await processBitbucketProject(target.path, fullParams, ctx));
				else results.push(await processNonGitProject(target.path, target.reason, fullParams, ctx));
			} catch (error) {
				results.push({ path: target.path, status: "error", reason: error instanceof Error ? error.message : String(error) });
			}
		}
		const bitbucketRootResult = await maybeDeleteBitbucketRoot(root, fullParams, ctx);
		if (bitbucketRootResult) results.push(bitbucketRootResult);
		return { root, targetsScanned: targets.length, results };
	}

	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify("repo-cleanup-agent loaded. Run /repo-cleanup or call the repo_cleanup_agent tool.", "info");
	});

	pi.registerCommand("repo-cleanup", {
		description: "Archive stale GitHub/local repos, fork upstreams when needed, exclude .env files, and delete stale bitbucket repos",
		handler: async (args, ctx) => {
			const dryRun = args.includes("--dry-run");
			const includeRecentlyOpened = args.includes("--all");
			const staleMatch = args.match(/--days\s+(\d+)/);
			const result = await executeCleanup({ dryRun, includeRecentlyOpened, staleDays: staleMatch ? Number(staleMatch[1]) : undefined }, ctx);
			ctx.ui.notify(JSON.stringify(result, null, 2), "info");
		},
	});

	pi.registerTool({
		name: "repo_cleanup_agent",
		label: "Repo Cleanup Agent",
		description:
			"Scan repos under a root. For inactive repos, create/use a private GitHub repo or fork upstream repos, checkout cleanup/YYYY-MM-DD, commit all non-.env code, and push. Stale bitbucket repos are deleted after confirmation.",
		parameters: Type.Object({
			root: Type.Optional(Type.String({ description: "Workspace root to scan. Defaults to the current pi working directory." })),
			staleDays: Type.Optional(Type.Number({ description: "Minimum inactivity days. Defaults to 30." })),
			dryRun: Type.Optional(Type.Boolean({ description: "Report what would happen without changing repos." })),
			includeRecentlyOpened: Type.Optional(Type.Boolean({ description: "Process all repos regardless of last-opened/activity time." })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const result = await executeCleanup(params as CleanupParams, ctx);
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: result };
		},
	});
}

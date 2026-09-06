import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	cpSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative, sep } from "node:path";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const REPO_URL = "https://github.com/Rachit-Gandhi/terminal.git";
const DEFAULT_CONFIG_REPO = join(homedir(), "workspace", "github.com", "Rachit-Gandhi", "terminal");
const PI_AGENT_DIR = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const repoMarkerPath = join(PI_AGENT_DIR, ".terminal-config-repo");
const syncMarkerPath = join(PI_AGENT_DIR, ".terminal-config-autosync-last");
const trackedFiles = [
	"settings.json",
	"models.json",
	"keybindings.json",
	"AGENTS.md",
	"SYSTEM.md",
	"APPEND_SYSTEM.md",
];
const trackedDirs = [
	"extensions",
	"extensions.disabled",
	"skills",
	"agents",
	"prompts",
	"themes",
	"research",
	"bin",
];
const excludedNames = new Set([".git", "node_modules", ".DS_Store"]);

function configuredRepo(): string {
	if (process.env.TERMINAL_CONFIG_REPO) return process.env.TERMINAL_CONFIG_REPO;
	if (existsSync(repoMarkerPath)) {
		const marked = readFileSync(repoMarkerPath, "utf8").trim();
		if (marked) return marked;
	}
	return DEFAULT_CONFIG_REPO;
}

function git(repo: string, args: string[]): string {
	return execFileSync("git", args, {
		cwd: repo,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

function lastSyncMs(): number {
	if (!existsSync(syncMarkerPath)) return 0;
	const value = Number(readFileSync(syncMarkerPath, "utf8"));
	return Number.isFinite(value) ? value : 0;
}

function markSynced() {
	writeFileSync(syncMarkerPath, String(Date.now()));
}

function shouldSync(): boolean {
	return Date.now() - lastSyncMs() >= SIX_HOURS_MS;
}

function removeIfExists(path: string) {
	if (existsSync(path)) rmSync(path, { recursive: true, force: true });
}

function shouldCopy(sourceRoot: string, source: string): boolean {
	if (excludedNames.has(basename(source)) || basename(source).includes(".backup-")) return false;
	const rel = relative(sourceRoot, source).split(sep).join("/");
	if (rel === "extensions/herdr-agent-state.ts") return false;
	if (rel === "skills/matt-pocock" || rel.startsWith("skills/matt-pocock/")) return false;
	return true;
}

function copyConfigFromPiToRepo(repo: string) {
	const agentRepoDir = join(repo, "pi", "agent");
	mkdirSync(agentRepoDir, { recursive: true });

	for (const file of trackedFiles) {
		const source = join(PI_AGENT_DIR, file);
		const target = join(agentRepoDir, file);
		if (existsSync(source)) cpSync(source, target, { force: true });
		else removeIfExists(target);
	}

	for (const dir of trackedDirs) {
		const source = join(PI_AGENT_DIR, dir);
		const target = join(agentRepoDir, dir);
		removeIfExists(target);
		if (existsSync(source)) {
			cpSync(source, target, {
				recursive: true,
				force: true,
				filter: (path) => shouldCopy(PI_AGENT_DIR, path),
			});
		}
	}
}

function setupCommands(): string {
	return [
		"Restore the complete macOS terminal setup:",
		"",
		`  curl -fsSL https://raw.githubusercontent.com/Rachit-Gandhi/terminal/main/install.sh | bash`,
		"",
		"Or clone it manually:",
		`  git clone ${REPO_URL} ${DEFAULT_CONFIG_REPO}`,
		`  ${join(DEFAULT_CONFIG_REPO, "install.sh")}`,
		"",
		"Credentials are intentionally not synchronized. Run /login on a new machine.",
	].join("\n");
}

function syncPiConfig(): string {
	const repo = configuredRepo();
	if (!existsSync(join(repo, ".git"))) throw new Error(`terminal config repo not found: ${repo}`);

	copyConfigFromPiToRepo(repo);
	const status = git(repo, ["status", "--porcelain", "--", "pi/agent"]);
	if (!status) {
		markSynced();
		return "No pi config changes to sync.";
	}

	git(repo, ["add", "--", "pi/agent"]);
	const timestamp = new Date().toISOString();
	git(repo, ["commit", "-m", `Sync pi config ${timestamp}`, "--", "pi/agent"]);
	try {
		git(repo, ["pull", "--rebase", "--autostash", "origin", "main"]);
	} catch {
		// Keep the local commit if the network is temporarily unavailable.
	}
	git(repo, ["push", "origin", "main"]);
	markSynced();
	return `Synced pi config at ${timestamp}.`;
}

export default function piConfigAutosync(pi: ExtensionAPI) {
	let timer: NodeJS.Timeout | undefined;
	let running = false;

	async function runIfDue(ctx: any, force = false) {
		if (running || (!force && !shouldSync())) return;
		running = true;
		try {
			ctx.ui.notify(syncPiConfig(), "info");
		} catch (error) {
			ctx.ui.notify(`Terminal config auto-sync failed: ${error instanceof Error ? error.message : String(error)}`, "error");
		} finally {
			running = false;
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		void runIfDue(ctx);
		if (!timer) {
			timer = setInterval(() => void runIfDue(ctx, true), SIX_HOURS_MS);
			timer.unref?.();
		}
	});

	pi.on("session_shutdown", async () => {
		if (timer) clearInterval(timer);
		timer = undefined;
	});

	pi.registerCommand("pi-config-sync", {
		description: "Sync non-secret pi customizations into the terminal config repository; use `setup` for restore commands",
		handler: async (args, ctx) => {
			if (["setup", "install", "restore", "commands"].includes(args.trim().toLowerCase())) {
				pi.sendMessage({ customType: "pi-config-sync", content: setupCommands(), display: true });
				return;
			}
			await runIfDue(ctx, true);
		},
	});

	pi.registerCommand("pi-config-setup", {
		description: "Show the command that restores the complete terminal and pi setup",
		handler: async () => {
			pi.sendMessage({ customType: "pi-config-sync", content: setupCommands(), display: true });
		},
	});
}

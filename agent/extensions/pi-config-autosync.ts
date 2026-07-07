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
import { homedir, platform } from "node:os";
import { basename, join } from "node:path";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const REPO_URL = "https://github.com/Rachit-Gandhi/pi-configs.git";
const DEFAULT_CONFIG_REPO = join(homedir(), "workspace", "github.com", "Rachit-Gandhi", "pi-configs");
const PI_AGENT_DIR = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const configRepo = process.env.PI_CONFIG_REPO || DEFAULT_CONFIG_REPO;
const markerPath = join(PI_AGENT_DIR, ".pi-config-autosync-last");
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

function git(args: string[]): string {
	return execFileSync("git", args, {
		cwd: configRepo,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

function lastSyncMs(): number {
	if (!existsSync(markerPath)) return 0;
	const value = Number(readFileSync(markerPath, "utf8"));
	return Number.isFinite(value) ? value : 0;
}

function markSynced() {
	writeFileSync(markerPath, String(Date.now()));
}

function shouldSync(): boolean {
	return Date.now() - lastSyncMs() >= SIX_HOURS_MS;
}

function removeIfExists(path: string) {
	if (existsSync(path)) rmSync(path, { recursive: true, force: true });
}

function shouldCopy(src: string): boolean {
	return !excludedNames.has(basename(src));
}

function copyConfigFromPiToRepo() {
	const agentRepoDir = join(configRepo, "agent");
	mkdirSync(agentRepoDir, { recursive: true });

	for (const file of trackedFiles) {
		const source = join(PI_AGENT_DIR, file);
		const target = join(agentRepoDir, file);
		if (existsSync(source)) {
			mkdirSync(agentRepoDir, { recursive: true });
			cpSync(source, target, { force: true });
		} else {
			removeIfExists(target);
		}
	}

	for (const dir of trackedDirs) {
		const source = join(PI_AGENT_DIR, dir);
		const target = join(agentRepoDir, dir);
		removeIfExists(target);
		if (existsSync(source)) {
			cpSync(source, target, {
				recursive: true,
				force: true,
				filter: shouldCopy,
			});
		}
	}
}

function setupCommands(): string {
	return [
		"Set up pi config from the synced repo:",
		"",
		"macOS / Linux:",
		"  curl -fsSL https://raw.githubusercontent.com/Rachit-Gandhi/pi-configs/main/install.sh | bash",
		"",
		"Windows PowerShell:",
		"  iwr -UseB https://raw.githubusercontent.com/Rachit-Gandhi/pi-configs/main/install.ps1 | iex",
		"",
		"Manual clone on any OS:",
		`  git clone ${REPO_URL} ${configRepo}`,
		platform() === "win32" ? `  powershell -ExecutionPolicy Bypass -File ${join(configRepo, "install.ps1")}` : `  ${join(configRepo, "install.sh")}`,
		"",
		"Override locations with PI_CONFIG_REPO and PI_CODING_AGENT_DIR if needed.",
	].join("\n");
}

function syncPiConfig(): string {
	if (!existsSync(configRepo)) throw new Error(`pi config repo not found: ${configRepo}`);

	copyConfigFromPiToRepo();
	const status = git(["status", "--porcelain"]);
	if (!status) {
		markSynced();
		return "No pi config changes to sync.";
	}

	git(["add", "."]);
	const timestamp = new Date().toISOString();
	git(["commit", "-m", `Auto-sync pi config ${timestamp}`]);
	try {
		git(["pull", "--rebase", "--autostash", "origin", "main"]);
	} catch {
		// Keep local sync useful even if the network or remote is temporarily unavailable.
	}
	git(["push", "origin", "main"]);
	markSynced();
	return `Synced pi config changes at ${timestamp}.`;
}

export default function piConfigAutosync(pi: ExtensionAPI) {
	let timer: NodeJS.Timeout | undefined;
	let running = false;

	async function runIfDue(ctx: any, force = false) {
		if (running || (!force && !shouldSync())) return;
		running = true;
		try {
			const message = syncPiConfig();
			ctx.ui.notify(message, "info");
		} catch (error) {
			ctx.ui.notify(`Pi config auto-sync failed: ${error instanceof Error ? error.message : String(error)}`, "error");
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
		description: "Force sync non-secret ~/.pi/agent customizations to the pi-configs GitHub repo. Use `setup` for restore commands.",
		handler: async (args, ctx) => {
			const command = args.trim().toLowerCase();
			if (["setup", "install", "restore", "commands"].includes(command)) {
				pi.sendMessage({
					customType: "pi-config-sync",
					content: setupCommands(),
					display: true,
				});
				return;
			}
			await runIfDue(ctx, true);
		},
	});

	pi.registerCommand("pi-config-setup", {
		description: "Show macOS, Linux, and Windows commands to restore pi config from sync",
		handler: async () => {
			pi.sendMessage({
				customType: "pi-config-sync",
				content: setupCommands(),
				display: true,
			});
		},
	});
}

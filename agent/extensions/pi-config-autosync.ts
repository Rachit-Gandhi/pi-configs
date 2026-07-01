import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const DEFAULT_CONFIG_REPO = "/Users/rachitgandhi/workspace/github.com/Rachit-Gandhi/pi-configs";
const configRepo = process.env.PI_CONFIG_REPO || DEFAULT_CONFIG_REPO;
const markerPath = join(process.env.PI_CODING_AGENT_DIR || `${process.env.HOME}/.pi/agent`, ".pi-config-autosync-last");

function sh(command: string): string {
	return execFileSync(command, {
		cwd: configRepo,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		shell: "/bin/bash",
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

function syncPiConfig(): string {
	if (!existsSync(configRepo)) throw new Error(`pi config repo not found: ${configRepo}`);

	sh("./sync-from-pi.sh");
	const status = sh("git status --porcelain");
	if (!status) {
		markSynced();
		return "No pi config changes to sync.";
	}

	sh("git add .");
	const timestamp = new Date().toISOString();
	sh(`git commit -m ${JSON.stringify(`Auto-sync pi config ${timestamp}`)}`);
	sh("git pull --rebase --autostash origin main || true");
	sh("git push origin main");
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

	pi.on("session_end", async () => {
		if (timer) clearInterval(timer);
		timer = undefined;
	});

	pi.registerCommand("pi-config-sync", {
		description: "Force sync non-secret ~/.pi/agent customizations to the pi-configs GitHub repo",
		handler: async (_args, ctx) => {
			await runIfDue(ctx, true);
		},
	});
}

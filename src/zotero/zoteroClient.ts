import * as http from "http";
import { Buffer } from "buffer";
import { requestUrl, RequestUrlResponse } from "obsidian";
import { ZoteroItem } from "zotero/zoteroTypes";

const WEB_API_BASE = "https://api.zotero.org";
const LOCAL_PORT = 23119;
const LOCAL_TIMEOUT_MS = 2000;
const MAX_WEB_RETRIES = 3;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTTP request to localhost for loopback addresses.
 */
function nodeHttpGet(path: string, timeoutMs: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{ hostname: "localhost", port: LOCAL_PORT, path, timeout: timeoutMs },
			(res) => {
				let body = "";
				res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
				res.on("end", () => {
					if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
						resolve(body);
					} else if (body.includes("Local API is not enabled")) {
						reject(new Error("Local Zotero API is disabled. Enable it in Zotero → Edit → Settings → Advanced → Allow other applications on this computer to communicate with Zotero."));
					} else {
						reject(new Error(`Local Zotero error: HTTP ${res.statusCode}`));
					}
				});
			},
		);
		req.on("error", reject);
		req.on("timeout", () => { req.destroy(); reject(new Error("Local Zotero timed out")); });
		req.end();
	});
}

export class ZoteroClient {
	private userId: string;
	private apiKey: string;

	constructor(userId: string, apiKey: string) {
		this.userId = userId;
		this.apiKey = apiKey;
	}

	/**
	 * Search Zotero for items with matching titles.
	 * Tries local Zotero desktop app first with fallback to web API.
	 * Automatically resolves attachment items to their parent library entries.
	 */
	async searchByTitle(title: string): Promise<ZoteroItem[]> {
		try {
			const raw = await this.searchLocal(title);
			return await this.resolveItems(raw, true);
		} catch (err) {
			console.warn(`[Zotero] Local unavailable, falling back to web API: ${err instanceof Error ? err.message : String(err)}`);
		}

		if (!this.apiKey) {
			throw new Error("Local Zotero is not running and no API key is configured.");
		}
		const raw = await this.searchWeb(title);
		return this.resolveItems(raw, false);
	}

	/**
	 * For regular items: pass through.
	 * For attachments with a parentItem key: fetch the parent and use that instead.
	 * For standalone attachments (no parent): keep as-is.
	 * Notes are always discarded.
	 */
	private async resolveItems(items: ZoteroItem[], useLocal: boolean): Promise<ZoteroItem[]> {
		const withoutNotes = items.filter((item) => item.data.itemType !== "note");
		const regular = withoutNotes.filter((item) => item.data.itemType !== "attachment");
		const attachments = withoutNotes.filter((item) => item.data.itemType === "attachment");

		const resolved = [...regular];
		const resolvedKeys = new Set(regular.map((i) => i.key));

		for (const att of attachments) {
			const parentKey = att.data.parentItem;
			if (parentKey && !resolvedKeys.has(parentKey)) {
				try {
					const parent = useLocal
						? await this.fetchItemLocal(parentKey)
						: await this.fetchItemWeb(parentKey);
					if (parent.data.itemType !== "note" && parent.data.itemType !== "attachment") {
						resolved.push(parent);
						resolvedKeys.add(parentKey);
					}
				} catch (err) {
					console.warn(`[Zotero] Could not fetch parent ${parentKey}: ${err instanceof Error ? err.message : String(err)}`);
				}
			} else if (!parentKey && !resolvedKeys.has(att.key)) {
				resolved.push(att);
				resolvedKeys.add(att.key);
			}
		}

		return resolved;
	}

	private async searchLocal(title: string): Promise<ZoteroItem[]> {
		const path = `/api/users/${encodeURIComponent(this.userId)}/items?q=${encodeURIComponent(title)}&limit=10&format=json`;
		const body = await nodeHttpGet(path, LOCAL_TIMEOUT_MS);
		return JSON.parse(body) as ZoteroItem[];
	}

	private async fetchItemLocal(key: string): Promise<ZoteroItem> {
		const path = `/api/users/${encodeURIComponent(this.userId)}/items/${key}`;
		const body = await nodeHttpGet(path, LOCAL_TIMEOUT_MS);
		return JSON.parse(body) as ZoteroItem;
	}

	private async searchWeb(title: string): Promise<ZoteroItem[]> {
		const url = `${WEB_API_BASE}/users/${encodeURIComponent(this.userId)}/items?q=${encodeURIComponent(title)}&limit=10&format=json`;
		const headers = { Authorization: `Bearer ${this.apiKey}`, "Zotero-API-Version": "3" };

		for (let attempt = 0; attempt < MAX_WEB_RETRIES; attempt++) {
			let response: RequestUrlResponse;
			try {
				response = await requestUrl({ url, headers, throw: false });
			} catch (err) {
				throw new Error(`Zotero network error: ${err instanceof Error ? err.message : String(err)}`);
			}

			if (response.status === 429) {
				if (attempt < MAX_WEB_RETRIES - 1) {
					const retryAfter = parseInt(response.headers["retry-after"] ?? "0", 10);
					const delay = retryAfter > 0 ? retryAfter * 1000 : 1000 * Math.pow(2, attempt + 1);
					await sleep(delay);
					continue;
				}
				throw new Error("Zotero rate limit reached after multiple retries.");
			}

			if (response.status === 401) throw new Error("Zotero authentication failed. Check your API key in settings.");
			if (response.status === 403) throw new Error("Zotero access denied. Ensure your API key has read permissions.");
			if (response.status < 200 || response.status >= 300) throw new Error(`Zotero API error: HTTP ${response.status}`);

			return response.json as ZoteroItem[];
		}

		throw new Error("Zotero web search failed after retries.");
	}

	private async fetchItemWeb(key: string): Promise<ZoteroItem> {
		const response = await requestUrl({
			url: `${WEB_API_BASE}/users/${encodeURIComponent(this.userId)}/items/${key}`,
			headers: { Authorization: `Bearer ${this.apiKey}`, "Zotero-API-Version": "3" },
			throw: false,
		});
		if (response.status < 200 || response.status >= 300) throw new Error(`Zotero item fetch error: HTTP ${response.status}`);
		return response.json as ZoteroItem;
	}
}

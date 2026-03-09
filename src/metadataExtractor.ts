import { TFile } from "obsidian";
import { ExtractionResult } from "types";
import { withFallbackMetadata } from "utils/fallbacks";

// ---------------------------------------------------------------------------
// Zotero integration (not yet implemented)
//
// When ready, implement fetchZoteroMetadata() to look up metadata via the
// Zotero API (https://www.zotero.org/support/dev/web_api/v3/basics) and
// return a Partial<BookMetadata>. Plug it in below before the filename
// fallback, e.g.:
//
//   const zoteroResult = await fetchZoteroMetadata(file);
//   if (zoteroResult) {
//     return { metadata: withFallbackMetadata(zoteroResult, file.path), warnings };
//   }
// ---------------------------------------------------------------------------

export async function extractMetadataFromFile(file: TFile, _binary: ArrayBuffer): Promise<ExtractionResult> {
	// Derive all metadata from the filename until a richer source (e.g. Zotero) is wired in.
	return {
		metadata: withFallbackMetadata({}, file.path),
		warnings: [],
	};
}

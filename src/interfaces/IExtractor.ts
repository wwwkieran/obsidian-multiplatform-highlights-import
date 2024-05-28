import {KoboHighlightsImporterSettings} from "../settings/Settings";
import {IBookWithHighlights} from "./IBook";

export interface IExtractor {
	// eslint-disable-next-line @typescript-eslint/no-misused-new,no-unused-vars
	extractHighlights(settings: KoboHighlightsImporterSettings): Promise<IBookWithHighlights[]>;
}


import {IExtractor} from "../interfaces/IExtractor";
import {KoboHighlightsImporterSettings} from "../settings/Settings";
import {IBookWithHighlights} from "../interfaces/IBook";
import SqlJs from "sql.js";
import {binary} from "../binaries/sql-wasm";
import fs from "fs";
import {Repository} from "../database/repository";

export class KoboExtractor implements IExtractor {

	async extractHighlights(settings: KoboHighlightsImporterSettings): Promise<IBookWithHighlights[]> {
		const SQLEngine =  await SqlJs({
			wasmBinary: binary
		})
		const fileBuffer = fs.readFileSync(settings.storageFolder)
		const db = new SQLEngine.Database(fileBuffer)
		const repo =  new Repository(db)


		
		return [];
	}

}


import {IExtractor} from "../interfaces/IExtractor";
import {KoboHighlightsImporterSettings} from "../settings/Settings";
import {IBookWithHighlights} from "../interfaces/IBook";
import SqlJs from "sql.js";
import {binary} from "../binaries/sql-wasm";
import fs from "fs";
import os from "os";

export class AppleBooksExtractor implements IExtractor {
	async extractHighlights(settings: KoboHighlightsImporterSettings): Promise<IBookWithHighlights[]> {
		const SQLEngine = await SqlJs({
			wasmBinary: binary
		})

		const books = await this.getBooks(SQLEngine)
		const highlights = await this.getHighlights(SQLEngine)

		const out: IBookWithHighlights[] = []
		for (const book of books) {
			const currentBookHighlights = highlights.filter(highlight => highlight.ZANNOTATIONASSETID === book.ZASSETID);

			if (currentBookHighlights.length > 0) {
				delete book['ZASSETID']
				out.push({
					book: book,
					highlights: currentBookHighlights.map(highlight => {
						delete highlight['ZANNOTATIONASSETID']
						return highlight
					})
				})
			}
		}

		return out
	}

	private async getBooks(SQLEngine: SqlJs.SqlJsStatic) {
		const fileBuffer = fs.readFileSync(os.homedir() + '/Library/Containers/com.apple.iBooksX/Data/Documents/BKLibrary/BKLibrary-1-091020131601.sqlite')
		const db = new SQLEngine.Database(fileBuffer)
		const statement = db.prepare(
			`SELECT ZASSETID, ZTITLE, ZAUTHOR, ZLASTOPENDATE, ZEPUBID, ZREADINGPROGRESS  FROM ZBKLIBRARYASSET WHERE ZPURCHASEDATE IS NOT NULL`
		)
		const books= []
		while (statement.step()) {
			const row = statement.get();
			books.push({
				title: row[1]?.toString() ?? "Unknown title",
				author: row[2]?.toString() ?? "Unknown author",
				dateLastRead:  new Date(parseInt(row[3]?.toString() ?? "0")),
				isbn: row[4]?.toString(),
				percentRead: parseFloat(row[5]?.toString() ?? "0")* 100,
				ZASSETID: row[0]?.toString()
			})
		}
		statement.free()
		return books
	}

	private async getHighlights(SQLEngine: SqlJs.SqlJsStatic) {
		const fileBuffer = fs.readFileSync(os.homedir() + '/Library/Containers/com.apple.iBooksX/Data/Documents/AEAnnotation/AEAnnotation_v10312011_1727_local.sqlite')
		const db = new SQLEngine.Database(fileBuffer)
		const statement = db.prepare(
			`SELECT ZANNOTATIONASSETID, ZFUTUREPROOFING5, ZANNOTATIONSELECTEDTEXT, ZANNOTATIONNOTE, ZANNOTATIONCREATIONDATE, Z_PK FROM ZAEANNOTATION WHERE ZANNOTATIONSELECTEDTEXT IS NOT NULL AND ZANNOTATIONDELETED IS 0`
		)
		const highlights = []
		while (statement.step()) {
			const row = statement.get();
			highlights.push({
				bookmarkId: "IBOOK_" + row[5]?.toString(),
				chapterTitle: row[1]?.toString() ?? "Unknown title",
				dateCreated: new Date(parseInt(row[4]?.toString() ?? "0")),
				note: row[3]?.toString(),
				text: row[2]?.toString() ?? "",
				ZANNOTATIONASSETID: row[0]?.toString()
			})
		}
		statement.free()
		return highlights
	}
}

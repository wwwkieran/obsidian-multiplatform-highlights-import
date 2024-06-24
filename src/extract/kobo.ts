import {IExtractor} from "../interfaces/IExtractor";
import {KoboHighlightsImporterSettings} from "../settings/Settings";
import {IBook, IBookWithHighlights} from "../interfaces/IBook";
import SqlJs, {Database, Statement} from "sql.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import uint8array from '../binaries/sql-wasm.wasm';
import fs from "fs";
import {IHighlight} from "../interfaces/IHighlight";

export class KoboExtractor implements IExtractor {

	unkonwnBookTitle = 'Unknown Title'
	unknownAuthor = 'Unknown Author'

	async extractHighlights(settings: KoboHighlightsImporterSettings): Promise<IBookWithHighlights[]> {
		const SQLEngine =  await SqlJs({
			wasmBinary: uint8array.buffer
		})
		const fileBuffer = fs.readFileSync(settings.koboSqlitePath)
		const db = new SQLEngine.Database(fileBuffer)
		const repo =  new Repository(db)
		const bookmarks = await repo.getAllBookmark()
		const titleToHighlights = new Map<string, IHighlight[]>()
		for (const bookmark of bookmarks) {
			const highlight = await this.createHighlightFromBookmark(bookmark, repo)

			const highlightsForBook = titleToHighlights.get(highlight.content.bookTitle!) ?? []
			highlightsForBook.push({
				bookmarkId: highlight.bookmark.bookmarkId,
				text: highlight.bookmark.text,
				chapterTitle: highlight.content.title,
				note: bookmark.note,
				dateCreated: highlight.bookmark.dateCreated,
			})
			titleToHighlights.set(highlight.content.bookTitle!, highlightsForBook)
		}

		const out: IBookWithHighlights[] = []
		for (const bookTitle of titleToHighlights.keys()) {
			const details = await repo.getBookDetailsByBookTitle(bookTitle)
			if (details == null) {
				continue
			}
			out.push(<IBookWithHighlights>{
				book: details,
				highlights: titleToHighlights.get(bookTitle)
			})
		}

		return out;
	}

	// The following functions were lifted from the obsidian-kobo-highlights plugin.
	// Not totally sure what's going on but I figured it would be more complicated to try to rewrite.

	private async createHighlightFromBookmark(bookmark: Bookmark, repo: Repository): Promise<Highlight> {
		let content = await repo.getContentByContentId(bookmark.contentId)

		if (content == null) {
			content = await repo.getContentLikeContentId(bookmark.contentId)
			if (content == null) {
				console.warn(`bookmark seems to link to a non existing content: ${bookmark.contentId}`)
				return {
					bookmark: bookmark,
					content: {
						title: this.unkonwnBookTitle,
						contentId: bookmark.contentId,
						chapterIdBookmarked: 'false',
						bookTitle: this.unkonwnBookTitle,
					}
				}
			}
		}

		if (content.chapterIdBookmarked == null) {
			return {
				bookmark: bookmark,
				content: await this.findRightContentForBookmark(bookmark, content, repo)
			}
		}

		return {
			bookmark: bookmark,
			content: content
		}
	}

	private async findRightContentForBookmark(bookmark: Bookmark, originalContent: Content, repo: Repository): Promise<Content> {
		if (!originalContent.bookTitle) {
			throw new Error("bookTitle field must be set")
		}

		const contents = await repo.getAllContentByBookTitleOrderedByContentId(originalContent.bookTitle)
		const potential = await repo.getFirstContentLikeContentIdWithBookmarkIdNotNull(originalContent.contentId)
		if (potential) {
			return potential
		}

		let foundContent: Content | null = null

		for (const c of contents) {
			if (c.chapterIdBookmarked) {
				foundContent = c
			}

			if (c.contentId === bookmark.contentId && foundContent) {
				return foundContent
			}
		}

		if (foundContent) {
			console.warn(`was not able to find chapterIdBookmarked for book ${originalContent.bookTitle}`)
		}

		return originalContent
	}
}

// This is also lifted from the kobo-highlights-import plugin. Not gonna refactor it...
export class Repository {
	db: Database

	constructor(db: Database) {
		this.db = db
	}

	async getAllBookmark(sortByChapterProgress?: boolean): Promise<Bookmark[]> {
		let res
		if (sortByChapterProgress) {
			res = this.db.exec(`select BookmarkID, Text, ContentID, annotation, DateCreated, ChapterProgress from Bookmark where Text is not null order by ChapterProgress ASC, DateCreated ASC;`)
		} else {
			res = this.db.exec(`select BookmarkID, Text, ContentID, annotation, DateCreated, ChapterProgress from Bookmark where Text is not null order by DateCreated ASC;`)
		}
		const bookmarks: Bookmark[] = []

		if (res[0].values == undefined) {
			console.warn("Bookmarks table returned no results, do you have any annotations created?")

			return bookmarks
		}

		res[0].values.forEach(row => {
			if (!(row[0] && row[1] && row[2] && row[4])) {
				console.warn(
					"Skipping bookmark with invalid values",
					row[0],
					row[1],
					row[2],
					row[3],
					row[4],
				)

				return
			}

			bookmarks.push({
				bookmarkId: row[0].toString(),
				text: row[1].toString().replace(/\s+/g, ' ').trim(),
				contentId: row[2].toString(),
				note: row[3]?.toString(),
				dateCreated: new Date(row[4].toString())
			})
		});

		return bookmarks
	}

	async getTotalBookmark(): Promise<number> {
		const res = this.db.exec(`select count(*) from Bookmark where Text is not null;`)

		return +res[0].values[0].toString()
	}

	async getBookmarkById(id: string): Promise<Bookmark | null> {
		const statement = this.db.prepare(
			`select BookmarkID, Text, ContentID, annotation, DateCreated from Bookmark where BookmarkID = $id;`,
			{
				$id: id
			}
		)

		if (!statement.step()) {
			return null
		}

		const row = statement.get()

		if (!(row[0] && row[1] && row[2] && row[4])) {
			throw new Error("Bookmark column returned unexpected null")
		}

		return {
			bookmarkId: row[0].toString(),
			text: row[1].toString().replace(/\s+/g, ' ').trim(),
			contentId: row[2].toString(),
			note: row[3]?.toString(),
			dateCreated: new Date(row[4].toString())
		}
	}

	async getContentByContentId(contentId: string): Promise<Content | null> {
		const statement = this.db.prepare(
			`select 
                Title, ContentID, ChapterIDBookmarked, BookTitle from content
                where ContentID = $id;`,
			{ $id: contentId },
		)
		const contents = this.parseContentStatement(statement)
		statement.free()

		if (contents.length > 1) {
			throw new Error("filtering by contentId yielded more then 1 result")
		}

		return contents.pop() || null
	}

	async getContentLikeContentId(contentId: string): Promise<Content | null> {
		const statement = this.db.prepare(
			`select 
                Title, ContentID, ChapterIDBookmarked, BookTitle from content
                where ContentID like $id;`,
			{ $id: `%${contentId}%` },
		)
		const contents = this.parseContentStatement(statement)
		statement.free()

		if (contents.length > 1) {
			console.warn(`filtering by contentId yielded more then 1 result: ${contentId}, using the first result.`)
		}

		return contents.shift() || null
	}

	async getFirstContentLikeContentIdWithBookmarkIdNotNull(contentId: string) {
		const statement = this.db.prepare(
			`select 
                Title, ContentID, ChapterIDBookmarked, BookTitle from "content" 
                where "ContentID" like $id and "ChapterIDBookmarked" not NULL limit 1`,
			{ $id: `${contentId}%` },
		)
		const contents = this.parseContentStatement(statement)
		statement.free()

		return contents.pop() || null
	}

	async getAllContent(limit = 100): Promise<Content[]> {
		const statement = this.db.prepare(
			`select Title, ContentID, ChapterIDBookmarked, BookTitle from content limit $limit`,
			{ $limit: limit },
		)

		const contents = this.parseContentStatement(statement)
		statement.free()

		return contents
	}

	async getAllContentByBookTitle(bookTitle: string): Promise<Content[]> {
		const statement = this.db.prepare(
			`select Title, ContentID, ChapterIDBookmarked, BookTitle  from "content" where BookTitle = $bookTitle`,
			{ $bookTitle: bookTitle },
		)

		const contents = this.parseContentStatement(statement)
		statement.free()

		return contents
	}

	async getAllContentByBookTitleOrderedByContentId(bookTitle: string): Promise<Content[]> {
		const statement = this.db.prepare(
			`select Title, ContentID, ChapterIDBookmarked, BookTitle  from "content" where BookTitle = $bookTitle order by "ContentID"`,
			{ $bookTitle: bookTitle },
		)

		const contents = this.parseContentStatement(statement)
		statement.free()

		return contents
	}

	async getBookDetailsByBookTitle(bookTitle: string): Promise<IBook | null> {
		const statement = this.db.prepare(
			`select Attribution, Description, Publisher, DateLastRead, ReadStatus, ___PercentRead, ISBN, Series, SeriesNumber, TimeSpentReading from content where Title = $title limit 1;`,
			{
				$title: bookTitle
			}
		)

		if (!statement.step()) {
			return null
		}

		const row = statement.get()

		if (row.length == 0 || row[0] == null) {
			console.debug("Used query: select Attribution, Description, Publisher, DateLastRead, ReadStatus, ___PercentRead, ISBN, Series, SeriesNumber, TimeSpentReading from content where Title = $title limit 2;", { $title: bookTitle, result: row })
			console.warn("Could not find book details in database")

			return null
		}

		return {
			title: bookTitle,
			author: row[0].toString(),
			description: row[1]?.toString(),
			publisher: row[2]?.toString(),
			dateLastRead: row[3] ? new Date(row[3].toString()) : undefined,
			readStatus: row[4] ? +row[4].toString() : 0,
			percentRead: row[5] ? +row[5].toString() : 0,
			isbn: row[6]?.toString(),
			series: row[7]?.toString(),
			seriesNumber: row[8] ? +row[8].toString() : undefined,
			timeSpentReading: row[9] ? +row[9].toString() : 0,
		}
	}

	private parseContentStatement(statement: Statement): Content[] {
		const contents: Content[] = []

		while (statement.step()) {
			const row = statement.get();
			contents.push({
				title: row[0]?.toString() ?? "",
				contentId: row[1]?.toString() ?? "",
				chapterIdBookmarked: row[2]?.toString(),
				bookTitle: row[3]?.toString()
			})
		}

		return contents
	}
}

export interface Bookmark {
	bookmarkId: string,
	text: string;
	contentId: string;
	note?: string;
	dateCreated: Date
}

export interface Content {
	title: string;
	contentId: string;
	chapterIdBookmarked?: string;
	bookTitle?: string;
}

export interface Highlight {
	bookmark: Bookmark;
	content: Content;
}

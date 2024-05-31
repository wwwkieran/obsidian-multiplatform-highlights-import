import {IBook, IBookWithHighlights} from "./interfaces/IBook";
import {IHighlight} from "./interfaces/IHighlight";
import moment from "moment/moment";
import {KoboHighlightsImporterSettings} from "./settings/Settings";
import {sanitize} from "sanitize-filename-ts";
import {App, normalizePath} from "obsidian";
import {applyTemplateTransformations} from "./template/template";
import {getTemplateContents} from "./template/templateContents";

export const typeWhateverYouWantPlaceholder = `%% Here you can type whatever you want, it will not be overwritten by the plugin. %%`

export class Aggregator {
	bookMap = new Map<string, IBookWithHighlights>()


	// -- MARK -- Logic for producing Md from a populated map

	async outputMarkdown(settings: KoboHighlightsImporterSettings, app: App) {
		const sortFn = this.sortByDate // In future this could be controlled by settings

		for (const book of this.bookMap.values()) {
			// Group by chapter and sort everything
			const chapterMap = this.groupByChapter(book.highlights)
			const chapterList: IHighlight[][] = []
			for (const chapter of chapterMap.values()) {
				chapterList.push(chapter.sort(sortFn))
			}
			chapterList.sort((a, b) => {
				return sortFn(a[0], b[0])
			})

			// Check if file already exists
			const sanitizedBookName = sanitize(book.book.title)
			const fileName = normalizePath(`${settings.storageFolder}/${sanitizedBookName}.md`)
			// Check if file already exists
			let existingFile;
			try {
				existingFile = await app.vault.adapter.read(fileName)
			} catch (error) {
				console.warn("Attempted to read file, but it does not already exist.")
			}

			// Generate the markdown for the highlights
			let mdForAllChapters = "";
			for (const chapterHighlights of chapterList) {
				mdForAllChapters += this.mdForChapter(chapterHighlights, settings, existingFile)
			}

			// Put the md in the template and write file
			const template = await getTemplateContents(app, settings.templatePath)
			await app.vault.adapter.write(
				fileName,
				applyTemplateTransformations(template, mdForAllChapters, book.book)
			)
		}
	}

	sortByDate(a: IHighlight, b: IHighlight) {
		return a.dateCreated.getTime() - b.dateCreated.getTime()
	}

	mdForChapter(highlights: IHighlight[], settings: KoboHighlightsImporterSettings, existingFileContents?: string): string {
		let markdown = ""
		markdown += `## ${highlights[0].chapterTitle.trim()}\n\n`

		markdown += highlights.map((highlight) => {
			const highlightMarkdown = this.mdForExtractedHighlight(highlight, settings)
			if (existingFileContents?.includes(highlight.bookmarkId)) {
				return this.extractExistingHighlight(highlight.bookmarkId, highlightMarkdown.highlightContent, existingFileContents)
			} else {
				return highlightMarkdown.fullContent
			}
		}).join('\n\n').trim()

		markdown += `\n\n`
		return markdown
	}

	mdForExtractedHighlight(highlight: IHighlight, settings: KoboHighlightsImporterSettings): {fullContent: string, highlightContent: string} {
		let text = `%%START-${highlight.bookmarkId}%%\n\n`;
		text += `${typeWhateverYouWantPlaceholder}\n\n`
		text += `%%START-EXTRACTED-HIGHLIGHT-${highlight.bookmarkId}%%\n`

		let highlightContent = ""

		if (settings.includeCallouts) {
			highlightContent += `> [!` + settings.highlightCallout + `]\n`
		}

		highlightContent += `> ${highlight.text}`

		if (highlight.note) {
			highlightContent += `\n`

			if (settings.includeCallouts) {
				highlightContent += `>> [!` + settings.annotationCallout + `]`
				highlightContent += `\n> ${highlight.note}`;
			} else {
				highlightContent += `\n${highlight.note}`;
			}
		}

		if (settings.includeCreatedDate) {
			highlightContent += ` — [[${moment(highlight.dateCreated).format(settings.dateFormat)}]]`
		}

		text += highlightContent

		// End annotation marker
		text += `\n%%END-EXTRACTED-HIGHLIGHT-${highlight.bookmarkId}%%\n\n`
		text += `${typeWhateverYouWantPlaceholder}\n\n`
		text += `%%END-${highlight.bookmarkId}%%\n`;

		return {
			fullContent: text,
			highlightContent: highlightContent
		}
	}

	extractExistingHighlight(bookmarkId: string, highlightContent: string, existingContent: string): string {
		// Define search terms
		const startSearch = `%%START-${bookmarkId}%%`
		const endSearch = `%%END-${bookmarkId}%%`
		// Find substring indices
		const start = existingContent.indexOf(startSearch)
		const end = existingContent.indexOf(endSearch) + endSearch.length + 1 // Add length of search term to include it in substring extraction
		// Return the extracted substring
		return this.updateHighlightFromExtractedFile(bookmarkId, highlightContent, existingContent.substring(start, end))
	}

	updateHighlightFromExtractedFile(bookmarkId: string, highlightContent: string, existingContent: string): string {
		const startSearch = `%%START-EXTRACTED-HIGHLIGHT-${bookmarkId}%%`
		const endSearch = `%%END-EXTRACTED-HIGHLIGHT-${bookmarkId}%%`

		const start = existingContent.indexOf(startSearch) + startSearch.length + 1
		const end = existingContent.indexOf(endSearch) - 1 // Add length of search term to include it in substring extraction

		return existingContent.replace(existingContent.substring(start, end), highlightContent)
	}

	groupByChapter(highlights: IHighlight[]): Map<string, IHighlight[]> {
		const out = new Map<string, IHighlight[]>
		for (const highlight of highlights) {
			const existing = out.get(highlight.chapterTitle) ?? []
			existing.push(highlight)
			out.set(highlight.chapterTitle, existing)
		}
		return out
	}

	// -- MARK -- Logic for populating the book map

	addBooks(books: IBookWithHighlights[]) {
		for (const bookWithHighlights of books) {
			const bookID = this.fetchBookIdentifier(bookWithHighlights)
			if (this.bookMap.has(bookID)) {
				const merged = this.mergeBooksWithHighlights(<IBookWithHighlights>this.bookMap.get(bookID), bookWithHighlights)
				this.bookMap.set(bookID, merged)
			} else {
				this.bookMap.set(bookID, bookWithHighlights)
			}
		}
	}

	fetchBookIdentifier(book: IBookWithHighlights): string {
		return book.book.isbn ?? book.book.title
	}

	mergeBooksWithHighlights(old: IBookWithHighlights, New: IBookWithHighlights): IBookWithHighlights {
		const book = <IBook>{
				title: old.book.title,
				author: old.book.author,
				description:  old.book.description ?? New.book.description,
				publisher:  old.book.publisher ??  New.book.publisher,
				dateLastRead:  old.book.dateLastRead ?? New.book.dateLastRead,
				readStatus:  old.book.readStatus ?? New.book.readStatus,
				percentRead:  old.book.percentRead ?? New.book.percentRead,
				isbn: old.book.isbn,
				series:  old.book.series ?? New.book.series,
				seriesNumber:  old.book.seriesNumber ?? New.book.seriesNumber,
				timeSpentReading:  old.book.timeSpentReading ?? New.book.timeSpentReading,
		}

		// We don't care about highlight sort order in the map.
		// We'll just have to sort properly before we export markdown...
		const highlights = old.highlights
		highlights.push(...New.highlights)

		return {
			book: book,
			highlights: highlights
		}
	}

}

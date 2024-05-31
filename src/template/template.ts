import { BookDetails, ReadStatus } from "../database/interfaces"
import {IBook} from "../interfaces/IBook";
import {sanitize} from "sanitize-filename-ts";

export const defaultTemplate = `
---
title: {{Title}}
author: {{Author}}
publisher: {{Publisher}}
dateLastRead: {{DateLastRead}}
readStatus: {{ReadStatus}}
percentRead: {{PercentRead}}
isbn: {{ISBN}}
series: {{Series}}
seriesNumber: {{SeriesNumber}}
timeSpentReading: {{TimeSpentReading}}
---

### Description

{{Description}}

### Highlights

{{highlights}}
`

export function applyTemplateTransformations(
	rawTemplate: string,
	highlights: string,
	bookDetails: IBook,
): string {
	return rawTemplate
		.replace(
			/{{\s*Title\s*}}/gi,
			sanitize(bookDetails.title),
		)
		.replace(
			/{{\s*Author\s*}}/gi,
			sanitize(bookDetails.author),
		)
		.replace(
			/{{\s*Publisher\s*}}/gi,
			sanitize(bookDetails.publisher ?? ''),
		)
		.replace(
			/{{\s*DateLastRead\s*}}/gi,
			bookDetails.dateLastRead?.toISOString() ?? '',
		)
		.replace(
			/{{\s*ReadStatus\s*}}/gi,
			ReadStatus[bookDetails.readStatus ?? ReadStatus.Unknown],
		)
		.replace(
			/{{\s*PercentRead\s*}}/gi,
			bookDetails.percentRead?.toString() ?? '',
		)
		.replace(
			/{{\s*ISBN\s*}}/gi,
			sanitize(bookDetails.isbn ?? ''),
		)
		.replace(
			/{{\s*Series\s*}}/gi,
			sanitize(bookDetails.series ?? ''),
		)
		.replace(
			/{{\s*SeriesNumber\s*}}/gi,
			bookDetails.seriesNumber?.toString() ?? '',
		)
		.replace(
			/{{\s*TimeSpentReading\s*}}/gi,
			forHumans(bookDetails.timeSpentReading ?? 0),
		)
		.replace(
			/{{\s*Description\s*}}/gi,
			bookDetails.description ?? '',
		)
		.replace(
			/{{\s*highlights\s*}}/gi,
			highlights,
		)
		.trim()
}

/**
 * Translates seconds into human readable format of seconds, minutes, hours, days, and years
 *
 * stolen from https://stackoverflow.com/questions/8211744/convert-time-interval-given-in-seconds-into-more-human-readable-form
 *
 * @param  {number} seconds The number of seconds to be processed
 * @return {string}         The phrase describing the amount of time
 */
function forHumans ( seconds: number ) {
	const levels = [
		[Math.floor(seconds / 31536000), 'years'],
		[Math.floor((seconds % 31536000) / 86400), 'days'],
		[Math.floor(((seconds % 31536000) % 86400) / 3600), 'hours'],
		[Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'minutes'],
		[(((seconds % 31536000) % 86400) % 3600) % 60, 'seconds'],
	];
	let returntext = '';

	for (let i = 0, max = levels.length; i < max; i++) {
		if ( levels[i][0] === 0 ) continue;
		returntext += ' ' + levels[i][0] + ' ' +  levels[i][1];
	}
	return returntext.trim();
}

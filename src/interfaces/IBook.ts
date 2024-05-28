/* eslint-disable no-unused-vars */
import {IHighlight} from "./IHighlight";

export interface IBook {
	title: string;
	author: string;
	description?: string;
	publisher?: string;
	dateLastRead?: Date;
	readStatus?: IBookReadStatus;
	percentRead?: number;
	isbn?: string;
	series?: string;
	seriesNumber?: number;
	timeSpentReading?: number;
}

export enum IBookReadStatus {
	Unknown = -1,
	Unopened = 0,
	Reading = 1,
	Read = 2
}

export interface IBookWithHighlights {
	book: IBook;
	highlights: IHighlight[];
}

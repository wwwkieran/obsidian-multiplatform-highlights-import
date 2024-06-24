// Credits go to Liam's Periodic Notes Plugin: https://github.com/liamcain/obsidian-periodic-notes

import {AbstractInputSuggest, TAbstractFile, TFolder} from "obsidian";

export class FolderSuggestor extends AbstractInputSuggest<TFolder> {
    getSuggestions(inputStr: string): TFolder[] {
        const abstractFiles = this.app.vault.getAllLoadedFiles();
        const folders: TFolder[] = [];
        const lowerCaseInputStr = inputStr.toLowerCase();

        abstractFiles.forEach((folder: TAbstractFile) => {
            if (
                folder instanceof TFolder &&
                folder.path.toLowerCase().contains(lowerCaseInputStr)
            ) {
                folders.push(folder);
            }
        });

        return folders;
    }

    renderSuggestion(file: TFolder, el: HTMLElement): void {
        el.setText(file.path);
    }

    selectSuggestion(file: TFolder): void {
        this.setValue(file.path);
        this.close();
    }
}

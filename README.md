# Obsidian Multi-Platform Book Highlight Importer

This plugin pulls your highlights and annotations from various different reading sources into Obsidian. This plugin reconciles books based on ISBN or title, so if you read the same book on different devices this plugin will only create one note (per book) with all the highlights. 

### Currently supported data sources
- [x] Kobo
- [x] Apple books
- [ ] Kindle
- [ ] Any other service you can suggest

### Why would I use this instead of kobo-highlights-importer / apple-books-highlights-plugin etc.?
1. **Highlights/annotations of the same book made using different services will be reconciled and consolidated into one note.**
2. **Note format is standardized regardless of reading platform.** Even if you do not read the same book across multiple services, you might read different books on different services. This plugin can still help you by getting all your annotations into one standard note format. 

## How to use
1. Install the plugin, either from the Obsidian plugin library or by cloning this repo to `/your/vault/.obsidian/plugins/`.
2. Enable the plugin on the `Community plugins` page. 
3. Configure the plugin on the `Multiplatform Highlights Importer` page. Here you can enable the reading services you would like to extract from. Note that some extractor require additional configuration (see below).
4. Trigger extraction by clicking the eBook icon in the sidebar or by using the `Import multiplatform highlights` command in the command palette.

### Extractor specific configuration
#### Kobo
You need to specify the path to your `KoboReader.sqlite` database. It is located in the `/.kobo` folder on your Kobo when you plug it in to your computer. On a Mac, this would be `/Volumes/KOBOeReader/.kobo/KoboReader.sqlite`.

#### Apple Books (macOS only)
No additional configuration is necessary beyond enabling the extractor on the `Multiplatform Highlights Importer` settings page. Note that this extractor only works on macOS.

## Contributing
I would really appreciate contributions, either to develop connections to new services or to improve the note generation process (or anything else you can think of)!.

### Architecture
The modular architecture of this plugin is really what distinguishes this plugin from others in the space. 
The highlight extraction logic 

In pseudocode, the main extraction loop looks something like this: 
```
for (extractor of extractors) {
	booksWithHighlights = extractor.extractHighlights()
	aggregator.addBooks(booksWithHighlights)
}
aggregator.outputMarkdown()


```

### Why you should contribute to this plugin instead of writing your own

### Future work
- Support for article services (Pocket, Zotero)
- Specify different destination folders for different services (reconcile at the folder level)
- Specify destination folders based on tags
- More customization of note format

## Acknowledgements
I built this plugin by forking [obsidian-kobo-highlights-import](https://github.com/OGKevin/obsidian-kobo-highlights-import) because I wanted Kobo support and I liked how their output notes grouped annotations by chapter. 
I also looked at the code for [obsidian-apple-books-highlight-plugin](https://github.com/bandantonio/obsidian-apple-books-highlights-plugin) to build the Apple Books plugin. Thank you to the creators of those plugins. 

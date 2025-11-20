import type { ZoteroItem, ItemType, Creator, Tag, Note, Attachment } from './types';

/**
 * Zotero Item class for collecting metadata
 */
export class Item implements ZoteroItem {
  itemType: ItemType;
  title?: string;
  creators: Creator[] = [];
  abstractNote?: string;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  date?: string;
  series?: string;
  seriesTitle?: string;
  seriesText?: string;
  journalAbbreviation?: string;
  language?: string;
  DOI?: string;
  ISBN?: string;
  ISSN?: string;
  url?: string;
  accessDate?: string;
  archive?: string;
  archiveLocation?: string;
  libraryCatalog?: string;
  callNumber?: string;
  rights?: string;
  extra?: string;
  tags: Tag[] = [];
  collections: string[] = [];
  relations: Record<string, any> = {};
  notes: Note[] = [];
  attachments: Attachment[] = [];

  // Additional fields
  publisher?: string;
  place?: string;
  edition?: string;
  numPages?: string;
  studio?: string;
  runningTime?: string;
  medium?: string;
  university?: string;
  thesisType?: string;
  court?: string;
  reporter?: string;
  caseNumber?: string;

  private completed = false;
  private _onComplete?: (item: ZoteroItem) => void;

  constructor(itemType: ItemType) {
    this.itemType = itemType;
  }

  /**
   * Mark the item as complete and trigger callback
   */
  complete() {
    if (this.completed) {
      return;
    }
    this.completed = true;

    // Set access date if not provided
    if (!this.accessDate && this.url) {
      this.accessDate = new Date().toISOString().split('T')[0];
    }

    if (this._onComplete) {
      this._onComplete(this.toJSON());
    }
  }

  /**
   * Set completion callback
   */
  setComplete(callback: (item: ZoteroItem) => void) {
    this._onComplete = callback;
  }

  /**
   * Convert to plain object
   */
  toJSON(): ZoteroItem {
    const obj: any = {
      itemType: this.itemType,
    };

    // Copy all defined properties
    const keys = Object.keys(this) as (keyof Item)[];
    for (const key of keys) {
      if (
        key !== 'completed' &&
        key !== '_onComplete' &&
        this[key] !== undefined &&
        this[key] !== null
      ) {
        obj[key] = this[key];
      }
    }

    return obj as ZoteroItem;
  }

  /**
   * Add a note
   */
  addNote(note: string | Note) {
    if (typeof note === 'string') {
      this.notes.push({ note });
    } else {
      this.notes.push(note);
    }
  }

  /**
   * Add an attachment
   */
  addAttachment(attachment: Attachment) {
    this.attachments.push(attachment);
  }

  /**
   * Add a tag
   */
  addTag(tag: string | Tag) {
    if (typeof tag === 'string') {
      this.tags.push({ tag });
    } else {
      this.tags.push(tag);
    }
  }

  /**
   * Add a creator
   */
  addCreator(creator: Creator) {
    this.creators.push(creator);
  }
}

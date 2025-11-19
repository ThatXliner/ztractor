/**
 * Zotero Item Types
 */
export type ItemType =
  | 'journalArticle'
  | 'book'
  | 'bookSection'
  | 'magazineArticle'
  | 'newspaperArticle'
  | 'webpage'
  | 'blogPost'
  | 'thesis'
  | 'report'
  | 'patent'
  | 'artwork'
  | 'audioRecording'
  | 'videoRecording'
  | 'podcast'
  | 'presentation'
  | 'conferencePaper'
  | 'document'
  | 'letter'
  | 'manuscript'
  | 'interview'
  | 'film'
  | 'tvBroadcast'
  | 'radioBroadcast'
  | 'map'
  | 'statute'
  | 'case'
  | 'bill'
  | 'hearing'
  | 'email'
  | 'instantMessage'
  | 'forumPost'
  | 'encyclopediaArticle'
  | 'dictionaryEntry'
  | 'software'
  | 'computerProgram'
  | 'multiple';

/**
 * Zotero Creator Type
 */
export type CreatorType =
  | 'author'
  | 'contributor'
  | 'editor'
  | 'translator'
  | 'seriesEditor'
  | 'interviewee'
  | 'interviewer'
  | 'director'
  | 'scriptwriter'
  | 'producer'
  | 'castMember'
  | 'sponsor'
  | 'counsel'
  | 'inventor'
  | 'attorneyAgent'
  | 'recipient'
  | 'performer'
  | 'composer'
  | 'wordsBy'
  | 'cartographer'
  | 'programmer'
  | 'artist'
  | 'commenter'
  | 'presenter'
  | 'guest'
  | 'podcaster'
  | 'reviewedAuthor'
  | 'cosponsor'
  | 'bookAuthor';

/**
 * Creator object
 */
export interface Creator {
  firstName?: string;
  lastName?: string;
  name?: string; // For single-field names
  creatorType: CreatorType;
  fieldMode?: number;
}

/**
 * Tag object
 */
export interface Tag {
  tag: string;
  type?: number;
}

/**
 * Note object
 */
export interface Note {
  note: string;
  tags?: Tag[];
}

/**
 * Attachment object
 */
export interface Attachment {
  title?: string;
  url?: string;
  path?: string;
  mimeType?: string;
  snapshot?: boolean;
}

/**
 * Complete metadata item
 */
export interface ZoteroItem {
  itemType: ItemType;
  title?: string;
  creators?: Creator[];
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
  tags?: Tag[];
  collections?: string[];
  relations?: Record<string, any>;
  notes?: Note[];
  attachments?: Attachment[];

  // Book-specific
  publisher?: string;
  place?: string;
  edition?: string;
  numPages?: string;

  // Video/Audio specific
  studio?: string;
  runningTime?: string;
  medium?: string;

  // Thesis specific
  university?: string;
  thesisType?: string;

  // Legal specific
  court?: string;
  reporter?: string;
  caseNumber?: string;

  // Additional fields
  [key: string]: any;
}

/**
 * Translator metadata
 */
export interface TranslatorMetadata {
  translatorID: string;
  label: string;
  creator: string;
  target: string;
  minVersion: string;
  maxVersion: string;
  priority: number;
  inRepository: boolean;
  translatorType: number;
  browserSupport: string;
  lastUpdated: string;
}

/**
 * Translator with code
 */
export interface Translator {
  metadata: TranslatorMetadata;
  code: string;
  detectWeb?: (doc: Document, url: string) => ItemType | false | null;
  doWeb?: (doc: Document, url: string) => void;
}

/**
 * Extract metadata options
 */
export interface ExtractMetadataOptions {
  /**
   * The URL to extract metadata from
   */
  url: string;

  /**
   * Optional HTML content. If not provided, will be fetched.
   */
  html?: string;

  /**
   * Optional HTTP headers for fetching
   */
  headers?: Record<string, string>;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Result of metadata extraction
 */
export interface ExtractMetadataResult {
  success: boolean;
  items?: ZoteroItem[];
  error?: string;
  translator?: string;
}

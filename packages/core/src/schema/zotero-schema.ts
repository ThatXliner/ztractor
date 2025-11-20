/**
 * Zotero Item Type Schema
 * Defines valid fields and creator types for each item type
 * Based on Zotero's official schema
 */

import type { ItemType, CreatorType } from '../types';

export interface ItemTypeSchema {
  fields: string[];
  creatorTypes: CreatorType[];
}

/**
 * Common fields used across many item types
 */
const COMMON_FIELDS = [
  'title',
  'abstractNote',
  'date',
  'accessDate',
  'url',
  'language',
  'rights',
  'extra',
  'tags',
  'collections',
  'relations'
];

/**
 * Schema mapping of item types to their valid fields and creator types
 */
export const ITEM_TYPE_SCHEMA: Record<ItemType, ItemTypeSchema> = {
  artwork: {
    fields: [...COMMON_FIELDS, 'artworkMedium', 'artworkSize', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['artist', 'contributor']
  },
  audioRecording: {
    fields: [...COMMON_FIELDS, 'label', 'seriesTitle', 'volume', 'numberOfVolumes', 'place', 'runningTime', 'ISBN', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['performer', 'composer', 'contributor', 'wordsBy']
  },
  bill: {
    fields: [...COMMON_FIELDS, 'billNumber', 'code', 'codeVolume', 'section', 'codePages', 'legislativeBody', 'session', 'history', 'shortTitle'],
    creatorTypes: ['sponsor', 'contributor', 'cosponsor']
  },
  blogPost: {
    fields: [...COMMON_FIELDS, 'blogTitle', 'publicationTitle', 'websiteType', 'shortTitle'],
    creatorTypes: ['author', 'commenter', 'contributor']
  },
  book: {
    fields: [...COMMON_FIELDS, 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'place', 'publisher', 'numPages', 'ISBN', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'editor', 'seriesEditor', 'translator']
  },
  bookSection: {
    fields: [...COMMON_FIELDS, 'bookTitle', 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'place', 'publisher', 'pages', 'ISBN', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['author', 'bookAuthor', 'contributor', 'editor', 'seriesEditor', 'translator']
  },
  case: {
    fields: [...COMMON_FIELDS, 'caseName', 'court', 'dateDecided', 'docketNumber', 'reporter', 'reporterVolume', 'firstPage', 'history', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'counsel']
  },
  computerProgram: {
    fields: [...COMMON_FIELDS, 'seriesTitle', 'versionNumber', 'company', 'place', 'programmingLanguage', 'system', 'ISBN', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['programmer', 'contributor']
  },
  conferencePaper: {
    fields: [...COMMON_FIELDS, 'proceedingsTitle', 'conferenceName', 'place', 'publisher', 'volume', 'pages', 'series', 'DOI', 'ISBN', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'editor', 'seriesEditor', 'translator']
  },
  dataset: {
    fields: [...COMMON_FIELDS, 'versionNumber', 'repository', 'archiveLocation', 'format', 'DOI', 'shortTitle'],
    creatorTypes: ['contributor']
  },
  dictionaryEntry: {
    fields: [...COMMON_FIELDS, 'dictionaryTitle', 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'place', 'publisher', 'pages', 'ISBN', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'editor', 'seriesEditor', 'translator']
  },
  document: {
    fields: [...COMMON_FIELDS, 'publisher', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'editor', 'reviewedAuthor', 'translator']
  },
  email: {
    fields: [...COMMON_FIELDS, 'subject', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'recipient']
  },
  encyclopediaArticle: {
    fields: [...COMMON_FIELDS, 'encyclopediaTitle', 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'place', 'publisher', 'pages', 'ISBN', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'editor', 'seriesEditor', 'translator']
  },
  film: {
    fields: [...COMMON_FIELDS, 'distributor', 'genre', 'videoRecordingFormat', 'runningTime', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['director', 'contributor', 'producer', 'scriptwriter', 'castMember']
  },
  forumPost: {
    fields: [...COMMON_FIELDS, 'forumTitle', 'postType', 'shortTitle'],
    creatorTypes: ['author', 'contributor']
  },
  hearing: {
    fields: [...COMMON_FIELDS, 'committee', 'place', 'publisher', 'numberOfVolumes', 'documentNumber', 'pages', 'legislativeBody', 'session', 'history', 'shortTitle'],
    creatorTypes: ['contributor']
  },
  instantMessage: {
    fields: [...COMMON_FIELDS, 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'recipient']
  },
  interview: {
    fields: [...COMMON_FIELDS, 'medium', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['interviewee', 'contributor', 'interviewer', 'translator']
  },
  journalArticle: {
    fields: [...COMMON_FIELDS, 'publicationTitle', 'volume', 'issue', 'pages', 'series', 'seriesTitle', 'seriesText', 'journalAbbreviation', 'DOI', 'ISSN', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'editor', 'reviewedAuthor', 'translator']
  },
  letter: {
    fields: [...COMMON_FIELDS, 'letterType', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'recipient']
  },
  magazineArticle: {
    fields: [...COMMON_FIELDS, 'publicationTitle', 'volume', 'issue', 'pages', 'ISSN', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'reviewedAuthor', 'translator']
  },
  manuscript: {
    fields: [...COMMON_FIELDS, 'manuscriptType', 'place', 'numPages', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'translator']
  },
  map: {
    fields: [...COMMON_FIELDS, 'mapType', 'scale', 'seriesTitle', 'edition', 'place', 'publisher', 'ISBN', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['cartographer', 'contributor', 'seriesEditor']
  },
  newspaperArticle: {
    fields: [...COMMON_FIELDS, 'publicationTitle', 'place', 'edition', 'pages', 'ISSN', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'reviewedAuthor', 'translator']
  },
  patent: {
    fields: [...COMMON_FIELDS, 'country', 'assignee', 'issuingAuthority', 'patentNumber', 'filingDate', 'pages', 'applicationNumber', 'priorityNumbers', 'issueDate', 'references', 'legalStatus', 'shortTitle'],
    creatorTypes: ['inventor', 'attorneyAgent', 'contributor']
  },
  podcast: {
    fields: [...COMMON_FIELDS, 'seriesTitle', 'episodeNumber', 'audioFileType', 'runningTime', 'shortTitle'],
    creatorTypes: ['podcaster', 'contributor', 'guest']
  },
  preprint: {
    fields: [...COMMON_FIELDS, 'repository', 'archiveID', 'citationKey', 'DOI', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'editor', 'reviewedAuthor', 'translator']
  },
  presentation: {
    fields: [...COMMON_FIELDS, 'presentationType', 'meetingName', 'place', 'shortTitle'],
    creatorTypes: ['presenter', 'contributor']
  },
  radioBroadcast: {
    fields: [...COMMON_FIELDS, 'programTitle', 'episodeNumber', 'audioRecordingFormat', 'place', 'network', 'runningTime', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['director', 'castMember', 'contributor', 'guest', 'producer', 'scriptwriter']
  },
  report: {
    fields: [...COMMON_FIELDS, 'reportNumber', 'reportType', 'seriesTitle', 'place', 'institution', 'pages', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'seriesEditor', 'translator']
  },
  software: {
    fields: [...COMMON_FIELDS, 'company', 'programmingLanguage', 'versionNumber', 'system', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['programmer', 'contributor']
  },
  statute: {
    fields: [...COMMON_FIELDS, 'nameOfAct', 'code', 'codeNumber', 'publicLawNumber', 'dateEnacted', 'pages', 'section', 'session', 'history', 'shortTitle'],
    creatorTypes: ['author', 'contributor']
  },
  thesis: {
    fields: [...COMMON_FIELDS, 'thesisType', 'university', 'place', 'numPages', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['author', 'contributor']
  },
  tvBroadcast: {
    fields: [...COMMON_FIELDS, 'programTitle', 'episodeNumber', 'videoRecordingFormat', 'place', 'network', 'runningTime', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['director', 'castMember', 'contributor', 'guest', 'producer', 'scriptWriter']
  },
  videoRecording: {
    fields: [...COMMON_FIELDS, 'videoRecordingFormat', 'seriesTitle', 'volume', 'numberOfVolumes', 'place', 'studio', 'runningTime', 'ISBN', 'archive', 'archiveLocation', 'callNumber', 'shortTitle'],
    creatorTypes: ['director', 'castMember', 'contributor', 'producer', 'scriptwriter']
  },
  webpage: {
    fields: [...COMMON_FIELDS, 'websiteTitle', 'websiteType', 'shortTitle'],
    creatorTypes: ['author', 'contributor', 'translator']
  },
  attachment: {
    fields: ['title', 'accessDate', 'url'],
    creatorTypes: []
  },
  note: {
    fields: ['note'],
    creatorTypes: []
  },
  annotation: {
    fields: ['annotationText', 'annotationComment', 'annotationColor', 'annotationPageLabel', 'annotationType'],
    creatorTypes: []
  }
};

/**
 * All valid creator types across all item types
 */
export const CREATOR_TYPES: CreatorType[] = [
  'artist',
  'attorneyAgent',
  'author',
  'bookAuthor',
  'cartographer',
  'castMember',
  'commenter',
  'composer',
  'contributor',
  'cosponsor',
  'counsel',
  'director',
  'editor',
  'guest',
  'interviewee',
  'interviewer',
  'inventor',
  'performer',
  'podcaster',
  'presenter',
  'producer',
  'programmer',
  'recipient',
  'reviewedAuthor',
  'scriptwriter',
  'seriesEditor',
  'sponsor',
  'translator',
  'wordsBy'
];

/**
 * Initialize the schema cache
 */
let schemaInitialized = false;
const schemaCache: Record<string, Set<string>> = {};

export function initializeSchema() {
  if (schemaInitialized) return;

  // Build cache for fast lookups
  for (const [itemType, schema] of Object.entries(ITEM_TYPE_SCHEMA)) {
    schemaCache[itemType] = new Set(schema.fields);
  }

  schemaInitialized = true;
}

/**
 * Check if a field is valid for an item type
 */
export function fieldIsValidForType(field: string, itemType: ItemType): boolean {
  if (!schemaInitialized) initializeSchema();

  const validFields = schemaCache[itemType];
  return validFields ? validFields.has(field) : false;
}

/**
 * Get valid creator types for an item type
 */
export function getCreatorsForType(itemType: ItemType): CreatorType[] {
  const schema = ITEM_TYPE_SCHEMA[itemType];
  return schema ? schema.creatorTypes : [];
}

/**
 * Check if an item type exists
 */
export function itemTypeExists(itemType: string): boolean {
  return itemType in ITEM_TYPE_SCHEMA;
}

/**
 * Get all item types
 */
export function getAllItemTypes(): ItemType[] {
  return Object.keys(ITEM_TYPE_SCHEMA) as ItemType[];
}

/**
 * Get all valid fields for an item type
 */
export function getFieldsForType(itemType: ItemType): string[] {
  const schema = ITEM_TYPE_SCHEMA[itemType];
  return schema ? schema.fields : [];
}

/**
 * Parser for S3 ListObjectsV2 XML responses.
 *
 * @module
 */

import { XMLParser } from 'fast-xml-parser';

export interface ListV2Entry {
  key: string;
  size: number;
  lastModified: string;
}

export interface ListV2Response {
  contents: ListV2Entry[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,             // keep all values as strings; we cast Size manually
  trimValues: true,
});

export function parseListV2Response(xml: string): ListV2Response {
  const obj = parser.parse(xml) as { ListBucketResult?: Record<string, unknown> };
  const root = obj.ListBucketResult;
  if (root === undefined) {
    throw new Error('Malformed ListBucketResult XML: missing root element');
  }
  const rawContents = root.Contents;
  const contentsArr: Array<Record<string, unknown>> = rawContents === undefined
    ? []
    : Array.isArray(rawContents)
      ? (rawContents as Array<Record<string, unknown>>)
      : [rawContents as Record<string, unknown>];

  const contents: ListV2Entry[] = contentsArr.map((c) => ({
    key: String(c.Key),
    size: Number(c.Size),
    lastModified: String(c.LastModified),
  }));
  const isTruncated = String(root.IsTruncated) === 'true';
  return {
    contents,
    isTruncated,
    ...(root.NextContinuationToken !== undefined && {
      nextContinuationToken: String(root.NextContinuationToken),
    }),
  };
}

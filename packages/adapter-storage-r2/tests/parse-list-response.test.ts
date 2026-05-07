import { describe, it, expect } from 'vitest';
import { parseListV2Response } from '../src/parse-list-response.js';

const PAGE_1 = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Name>b</Name>
  <Prefix>pfx/</Prefix>
  <KeyCount>2</KeyCount>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>tok-2</NextContinuationToken>
  <Contents>
    <Key>pfx/a</Key>
    <Size>11</Size>
    <LastModified>2026-05-01T12:00:00.000Z</LastModified>
    <ETag>"x"</ETag>
  </Contents>
  <Contents>
    <Key>pfx/b</Key>
    <Size>22</Size>
    <LastModified>2026-05-02T12:00:00.000Z</LastModified>
    <ETag>"y"</ETag>
  </Contents>
</ListBucketResult>`;

const EMPTY = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Name>b</Name>
  <KeyCount>0</KeyCount>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;

const SINGLE = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Name>b</Name>
  <KeyCount>1</KeyCount>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>only.txt</Key>
    <Size>5</Size>
    <LastModified>2026-05-01T12:00:00.000Z</LastModified>
    <ETag>"z"</ETag>
  </Contents>
</ListBucketResult>`;

describe('parseListV2Response', () => {
  it('parses a multi-content truncated page', () => {
    const r = parseListV2Response(PAGE_1);
    expect(r.contents).toHaveLength(2);
    expect(r.contents[0]).toEqual({
      key: 'pfx/a',
      size: 11,
      lastModified: '2026-05-01T12:00:00.000Z',
    });
    expect(r.isTruncated).toBe(true);
    expect(r.nextContinuationToken).toBe('tok-2');
  });

  it('parses a single-content page (fast-xml-parser collapses single arrays)', () => {
    const r = parseListV2Response(SINGLE);
    expect(r.contents).toHaveLength(1);
    expect(r.contents[0]?.key).toBe('only.txt');
    expect(r.isTruncated).toBe(false);
  });

  it('parses an empty page', () => {
    const r = parseListV2Response(EMPTY);
    expect(r.contents).toEqual([]);
    expect(r.isTruncated).toBe(false);
  });

  it('throws on malformed XML', () => {
    expect(() => parseListV2Response('not xml')).toThrow();
  });
});

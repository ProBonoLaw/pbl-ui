'use client';

import type { Timeline } from '@/lib/types';
import { FileSpreadsheetIcon, FileTextIcon } from 'lucide-react';
import { useState } from 'react';

type ExportFormat = 'docx' | 'xlsx';

function formatDateRange(
  startDate: string | null,
  endDate: string | null,
): string {
  if (!startDate && !endDate) {
    return 'Undated';
  }
  if (!startDate) {
    return `Through ${endDate}`;
  }
  if (!endDate || startDate === endDate) {
    return startDate;
  }
  return `${startDate} – ${endDate}`;
}

function downloadFilename(timeline: Timeline, format: ExportFormat): string {
  const accountId = timeline.accountId.replace(/[^a-z0-9-_]/gi, '-');
  return `timeline-${accountId}.${format}`;
}

async function saveFile(blob: Blob, filename: string): Promise<void> {
  const { saveAs } = await import('file-saver');
  saveAs(blob, filename);
}

async function exportDocx(timeline: Timeline): Promise<void> {
  const {
    BorderStyle,
    Document,
    ExternalHyperlink,
    HeadingLevel,
    Packer,
    Paragraph,
    TextRun,
    UnderlineType,
  } = await import('docx');
  const sourceParagraph = (entry: Timeline['entries'][number]) =>
    new Paragraph({
      children: [
        new TextRun({ text: 'Sources: ', bold: true }),
        ...entry.applicableSources.flatMap((source, sourceIndex) => [
          ...(sourceIndex > 0 ? [new TextRun({ break: 1 })] : []),
          new ExternalHyperlink({
            link: source.url,
            children: [
              new TextRun({
                text:
                  source.pages.length > 0
                    ? `Page${source.pages.length === 1 ? '' : 's'} ${source.pages.join(', ')}`
                    : `Source ${sourceIndex + 1}`,
                color: '0563C1',
                underline: { type: UnderlineType.SINGLE },
              }),
            ],
          }),
        ]),
      ],
    });
  const divider = () =>
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, color: 'D9D9D9', size: 6 },
      },
    });
  const entryParagraphs = timeline.entries.flatMap((entry, entryIndex) => [
    new Paragraph({
      text: formatDateRange(entry.dateRange.startDate, entry.dateRange.endDate),
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Event type: ', bold: true }),
        new TextRun(entry.eventType),
      ],
    }),
    new Paragraph(entry.summary),
    ...(entry.applicableSources.length > 0 ? [sourceParagraph(entry)] : []),
    ...(entryIndex < timeline.entries.length - 1 ? [divider()] : []),
  ]);
  const footnoteParagraphs = timeline.footnotes.flatMap((entry) => [
    new Paragraph({ text: entry.eventType, heading: HeadingLevel.HEADING_2 }),
    new Paragraph(entry.summary),
    ...(entry.applicableSources.length > 0 ? [sourceParagraph(entry)] : []),
  ]);

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: 'Timeline', heading: HeadingLevel.TITLE }),
          ...(timeline.timeRange
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Timeline range: ${formatDateRange(
                        timeline.timeRange.startDate,
                        timeline.timeRange.endDate,
                      )}`,
                      bold: true,
                      size: 28,
                    }),
                  ],
                }),
              ]
            : []),
          ...(timeline.summary ? [new Paragraph(timeline.summary)] : []),
          ...(timeline.summary ? [divider()] : []),
          new Paragraph({ text: 'Timeline entries', heading: HeadingLevel.HEADING_1 }),
          ...entryParagraphs,
          ...(timeline.footnotes.length > 0
            ? [
                new Paragraph({
                  text: 'Additional notes',
                  heading: HeadingLevel.HEADING_1,
                }),
                ...footnoteParagraphs,
              ]
            : []),
        ],
      },
    ],
  });

  await saveFile(await Packer.toBlob(document), downloadFilename(timeline, 'docx'));
}

async function exportXlsx(timeline: Timeline): Promise<void> {
  const headers = [
    'Section',
    'Start date',
    'End date',
    'Event type',
    'Summary',
    'Source URL',
    'Page number',
  ];
  const timelineRows = [
    ...timeline.entries.map((entry) => ({ entry, section: 'Timeline entry' })),
    ...timeline.footnotes.map((entry) => ({
      entry,
      section: 'Additional note',
    })),
  ];
  const rows: Array<Array<string | null>> = [headers];
  const mergeRanges: string[] = [];

  for (const { entry, section } of timelineRows) {
    const sourceRows =
      entry.applicableSources.length > 0 ? entry.applicableSources : [null];
    const firstRow = rows.length + 1;

    sourceRows.forEach((source, sourceIndex) => {
      const isFirstSource = sourceIndex === 0;
      rows.push([
        isFirstSource ? section : null,
        isFirstSource ? (entry.dateRange.startDate ?? '') : null,
        isFirstSource ? (entry.dateRange.endDate ?? '') : null,
        isFirstSource ? entry.eventType : null,
        isFirstSource ? entry.summary : null,
        source?.url ?? '',
        source?.pages.join(', ') ?? '',
      ]);
    });

    if (sourceRows.length > 1) {
      const lastRow = firstRow + sourceRows.length - 1;
      for (let columnIndex = 0; columnIndex < 5; columnIndex += 1) {
        const column = String.fromCharCode(65 + columnIndex);
        mergeRanges.push(`${column}${firstRow}:${column}${lastRow}`);
      }
    }
  }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Timeline" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );
  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="2"><xf xfId="0"/><xf xfId="0" applyFont="1" fontId="1"/></cellXfs>
</styleSheet>`,
  );

  const columnWidths = [18, 14, 14, 32, 80, 80, 14]
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join('');
  const sheetRows = rows
    .map((values, rowIndex) => {
      const cells = values
        .map((value, columnIndex) => {
          if (value === null) {
            return '';
          }
          const reference = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`;
          const style = rowIndex === 0 ? ' s="1"' : '';
          const text = String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
          return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${text}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${columnWidths}</cols>
  <sheetData>${sheetRows}</sheetData>
  ${mergeRanges.length > 0 ? `<mergeCells count="${mergeRanges.length}">${mergeRanges.map((range) => `<mergeCell ref="${range}"/>`).join('')}</mergeCells>` : ''}
</worksheet>`,
  );

  await saveFile(
    await zip.generateAsync({
      type: 'blob',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    downloadFilename(timeline, 'xlsx'),
  );
}

export default function TimelineExportActions({
  timeline,
}: Readonly<{ timeline: Timeline }>) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: ExportFormat): Promise<void> {
    setExporting(format);
    setError(null);

    try {
      if (format === 'docx') {
        await exportDocx(timeline);
      } else {
        await exportXlsx(timeline);
      }
    } catch {
      setError(`Unable to export the timeline as ${format.toUpperCase()}.`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void handleExport('docx')}
        disabled={exporting !== null}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
        <FileTextIcon aria-hidden="true" className="size-4" />
        {exporting === 'docx' ? 'Exporting…' : 'Export DOCX'}
      </button>
      <button
        type="button"
        onClick={() => void handleExport('xlsx')}
        disabled={exporting !== null}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
        <FileSpreadsheetIcon aria-hidden="true" className="size-4" />
        {exporting === 'xlsx' ? 'Exporting…' : 'Export XLSX'}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

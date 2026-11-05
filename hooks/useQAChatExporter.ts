import { logger } from "@/lib/logger";
import {
  AlignmentType,
  Document,
  Header,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  UnderlineType,
  HeadingLevel,
  FileChild,
} from 'docx';
import { saveAs } from 'file-saver';
import { useState } from 'react';

export interface QaInteraction {
  question: string;
  date: Date;
  swapRoles: boolean;
  responses: Array<{
    date: Date;
    document: string;
    exhibits: { doc: { sourceUrl: string; pages: number[] } }[];
  }>;
}

export function useQAChatExporter() {
  const [chatData, setChatData] = useState<QaInteraction[]>([]);
  const addChatData = (data: QaInteraction) => {
    setChatData((prevData) => [...prevData, data]);
  };

  const clearChatData = () => {
    setChatData([]);
  };

  const exportChatAsDocx = (fileName: string) => {
    const children: FileChild[] = [];
    chatData.forEach((interaction) => {
      children.push(
        new Paragraph({
          text: `Question: ${interaction.question}`,
          spacing: {
            after: 120,
          },
          style: HeadingLevel.HEADING_1,
        }),
      );
      const convertedResponses = convertFromMarkdownToDocx(
        interaction.responses.map((response) => response.document).join('\n\n'),
      );
      convertedResponses.forEach((para) => children.push(para));
      children.push(new Paragraph({ children: [new PageBreak()] }));
    });

    const doc = new Document({
      styles: {
        default: {
          heading1: {
            run: {
              font: 'Calibri',
              size: 52,
              bold: true,
              color: '000000',
              underline: {
                type: UnderlineType.SINGLE,
                color: '000000',
              },
            },
            paragraph: {
              alignment: AlignmentType.LEFT,
              spacing: { line: 340 },
            },
          },
          heading2: {
            run: {
              font: 'Calibri',
              size: 48,
              bold: true,
            },
            paragraph: {
              spacing: { line: 340 },
            },
          },
          heading3: {
            run: {
              font: 'Calibri',
              size: 36,
              bold: true,
            },
            paragraph: {
              spacing: { line: 276 },
            },
          },
          heading4: {
            run: {
              font: 'Calibri',
              size: 32,
              bold: true,
            },
            paragraph: {
              alignment: AlignmentType.JUSTIFIED,
            },
          },
          heading5: {
            run: {
              font: 'Calibri',
              size: 24,
              bold: true,
            },
            paragraph: {
              alignment: AlignmentType.JUSTIFIED,
            },
          },
          heading6: {
            run: {
              font: 'Calibri',
              size: 20,
              bold: true,
            },
            paragraph: {
              alignment: AlignmentType.JUSTIFIED,
            },
          },
        },
      },
      sections: [
        {
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'Pro Bono Law - QA Chat Export',
                    }),
                  ],
                }),
              ],
            }),
          },
          children: children,
        },
      ],
    });
    Packer.toBlob(doc)
      .then((blob) => {
        saveAs(blob, fileName + '.docx');
      })
      .catch((error) => {
        logger.error('Failed to export QA chat as DOCX:', error);
      });
  };
  return { chatData, clearChatData, addChatData, exportChatAsDocx };
}

function convertFromMarkdownToDocx(text: string): Paragraph[] {
  const lines = text.split('\n');
  const paragraphs: Paragraph[] = lines.flatMap((line) => {
    const parts = splitHyperlinks(line);
    if (
      parts.length > 1 ||
      (parts.length === 1 && typeof parts[0] !== 'string')
    ) {
      const textRuns = parts
        .map((part) => {
          if (typeof part === 'string') {
            return splitStyledText(part);
          } else {
            return new ExternalHyperlink({
              children: [new TextRun({ text: part.text, style: 'Hyperlink' })],
              link: part.hyperlink,
            });
          }
        })
        .flat();
      return new Paragraph({ children: textRuns });
    }
    const options = getStyleForHeading(line);
    const style = options.style;
    return [
      new Paragraph({
        style: style,
        bullet: options.bullet,
        children: [
          new TextRun({
            text: options.text,
            bold: isBold(line),
            italics: isItalic(line),
          }),
        ],
      }),
    ];
  });

  return paragraphs;
}

function getStyleForHeading(line: string): {
  text: string;
  style?: string;
  bullet?: { level: number };
} {
  const headingMatch = line.match(/^(#{1,6})\s+/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const adjustedLine = line.replace(/^(#{1,6})\s+/, '');
    let heading;
    switch (level) {
      case 1:
        heading = HeadingLevel.HEADING_1;
        break;
      case 2:
        heading = HeadingLevel.HEADING_2;
        break;
      case 3:
        heading = HeadingLevel.HEADING_3;
        break;
      case 4:
        heading = HeadingLevel.HEADING_4;
        break;
      case 5:
        heading = HeadingLevel.HEADING_5;
        break;
      case 6:
        heading = HeadingLevel.HEADING_6;
        break;
      default:
        heading = undefined;
    }

    return { text: adjustedLine, style: heading }; // e.g., 'heading1', 'heading2', etc.
  }
  const bulletMatch = line.match(/^[-*+]\s+/);
  if (bulletMatch) {
    const adjustedLine = removeMarkdownSyntax(line);
    return {
      text: adjustedLine,
      bullet: {
        level: 0,
      },
    }; // Bullet list style
  }
  return { text: removeMarkdownSyntax(line), style: undefined }; // Default style for normal paragraphs
}

function isBold(text: string): boolean {
  const boldRegex = /(\*\*\*|___)(.*?)\1|(\*\*|__)(.*?)\3/;
  return boldRegex.test(text);
}
function isItalic(text: string): boolean {
  // Match bold+italic (***) or italic (* / _), but not ** / __ alone
  const italicRegex = /(\*\*\*|___)(.*?)\1|(\*|_)(.*?)\3/;
  return italicRegex.test(text);
}

function removeMarkdownSyntax(text: string): string {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // Bold + Italic
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/__(.*?)__/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1') // Italic
    .replace(/_(.*?)_/g, '$1') // Italic
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
    .replace(/^[-*+]\s+/, ''); // Bullet points
}

function splitStyledText(text: string): Array<TextRun> {
  const result: Array<TextRun> = [];
  const remainingText = text;

  const regex = /(\*\*\*|___)(.*?)\1|(\*\*|__)(.*?)\3|(\*|_)(.*?)\5/g; // Matches bold+italic, bold, and italic

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(remainingText)) !== null) {
    if (match.index > lastIndex) {
      result.push(
        new TextRun({
          text: remainingText.substring(lastIndex, match.index),
        }),
      );
    }

    if (match[1]) {
      // Bold + Italic
      result.push(new TextRun({ text: match[2], bold: true, italics: true }));
    } else if (match[3]) {
      // Bold
      result.push(new TextRun({ text: match[4], bold: true }));
    } else if (match[5]) {
      // Italic
      result.push(
        new TextRun({
          text: match[6],
          italics: true,
        }),
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < remainingText.length) {
    result.push(
      new TextRun({
        text: remainingText.substring(lastIndex),
      }),
    );
  }

  return result;
}

function splitHyperlinks(
  text: string,
): (string | { hyperlink: string; text: string })[] {
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const result: (string | { hyperlink: string; text: string })[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }
    result.push({ text: match[1], hyperlink: match[2] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result;
}

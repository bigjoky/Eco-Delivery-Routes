<?php

declare(strict_types=1);

namespace App\Support\Pdf;

final class BrandedPdfDocument
{
    /**
     * @param array<int, string> $lines
     */
    public static function renderListDocument(string $title, string $subtitle, array $lines, string $orientation = 'portrait'): string
    {
        $isLandscape = $orientation === 'landscape';
        $pageWidth = $isLandscape ? 842 : 595;
        $pageHeight = $isLandscape ? 595 : 842;
        $left = 36;
        $right = $pageWidth - 36;
        $topBandY = $pageHeight - 60;
        $startY = $pageHeight - 120;
        $bottomY = 38;
        $lineHeight = 16;
        $maxChars = $isLandscape ? 110 : 78;
        $logoPath = public_path('logo-print-header.jpg');
        $logoData = is_file($logoPath) ? file_get_contents($logoPath) : false;

        $wrapped = [];
        foreach ($lines as $line) {
            $segments = self::wrapText($line, $maxChars);
            foreach ($segments as $segment) {
                $wrapped[] = $segment;
            }
        }

        $commands = [];
        $pages = [];
        $pageNumber = 1;
        $cursorY = self::appendHeader(
            commands: $commands,
            pageNumber: $pageNumber,
            pageWidth: $pageWidth,
            pageHeight: $pageHeight,
            left: $left,
            right: $right,
            topBandY: $topBandY,
            title: $title,
            subtitle: $subtitle,
            logoData: $logoData
        );

        foreach ($wrapped as $line) {
            if ($cursorY < $bottomY + $lineHeight) {
                $commands[] = self::drawText($left, 20, 8, 'Documento corporativo · Eco Delivery Routes');
                $pages[] = implode("\n", $commands) . "\n";
                $commands = [];
                $pageNumber++;
                $cursorY = self::appendHeader(
                    commands: $commands,
                    pageNumber: $pageNumber,
                    pageWidth: $pageWidth,
                    pageHeight: $pageHeight,
                    left: $left,
                    right: $right,
                    topBandY: $topBandY,
                    title: $title,
                    subtitle: $subtitle,
                    logoData: $logoData
                );
            }

            $commands[] = self::drawText($left, $cursorY, 11, $line);
            $cursorY -= $lineHeight;
        }

        $commands[] = self::drawText($left, 20, 8, 'Documento corporativo · Eco Delivery Routes');
        $pages[] = implode("\n", $commands) . "\n";

        return self::compilePdf(
            pages: $pages,
            pageWidth: $pageWidth,
            pageHeight: $pageHeight,
            logoData: is_string($logoData) ? $logoData : null
        );
    }

    /**
     * @param array<int, array{label:string,value:string}> $summaryBoxes
     * @param array<int, array{label:string,value:string,ratio?:float,detail?:string,color?:string}> $series
     * @param array<int, string> $details
     */
    public static function renderAnalyticsDocument(
        string $title,
        string $subtitle,
        array $summaryBoxes,
        array $series,
        array $details = [],
        string $orientation = 'landscape'
    ): string {
        $isLandscape = $orientation === 'landscape';
        $pageWidth = $isLandscape ? 842 : 595;
        $pageHeight = $isLandscape ? 595 : 842;
        $left = 28;
        $right = $pageWidth - 28;
        $topBandY = $pageHeight - 60;
        $bottomY = 34;
        $logoPath = public_path('logo-print-header.jpg');
        $logoData = is_file($logoPath) ? file_get_contents($logoPath) : false;

        $pages = [];
        $commands = [];
        $pageNumber = 1;
        $cursorY = self::appendHeader(
            commands: $commands,
            pageNumber: $pageNumber,
            pageWidth: $pageWidth,
            pageHeight: $pageHeight,
            left: $left,
            right: $right,
            topBandY: $topBandY,
            title: $title,
            subtitle: $subtitle,
            logoData: $logoData
        );

        $boxCount = max(1, count($summaryBoxes));
        $boxGap = 8;
        $boxWidth = min(120, (($right - $left) - (($boxCount - 1) * $boxGap)) / $boxCount);
        $boxHeight = 44;
        $boxX = $left;
        foreach ($summaryBoxes as $box) {
            $commands[] = self::drawFill($boxX, $cursorY - $boxHeight, $boxWidth, $boxHeight, '0.97 0.98 0.99');
            $commands[] = self::drawStroke($boxX, $cursorY - $boxHeight, $boxWidth, $boxHeight, '0.85 0.89 0.94');
            $commands[] = self::drawText($boxX + 8, $cursorY - 16, 8, $box['label']);
            $commands[] = self::drawText($boxX + 8, $cursorY - 31, 12, $box['value']);
            $boxX += $boxWidth + $boxGap;
        }
        $cursorY -= 62;

        if ($series !== []) {
            $commands[] = self::drawText($left, $cursorY, 11, 'Resumen visual');
            $cursorY -= 18;
            foreach ($series as $row) {
                if ($cursorY < $bottomY + 80) {
                    $commands[] = self::drawText($left, 20, 8, 'Documento corporativo · Eco Delivery Routes');
                    $pages[] = implode("\n", $commands) . "\n";
                    $commands = [];
                    $pageNumber++;
                    $cursorY = self::appendHeader(
                        commands: $commands,
                        pageNumber: $pageNumber,
                        pageWidth: $pageWidth,
                        pageHeight: $pageHeight,
                        left: $left,
                        right: $right,
                        topBandY: $topBandY,
                        title: $title,
                        subtitle: $subtitle,
                        logoData: $logoData
                    );
                }

                $ratio = max(0.0, min(100.0, (float) ($row['ratio'] ?? 0.0)));
                $barY = $cursorY - 10;
                $barWidth = $isLandscape ? 360 : 220;
                $barColor = $row['color'] ?? ($ratio >= 95 ? '0.10 0.45 0.24' : ($ratio >= 85 ? '0.72 0.39 0.05' : '0.73 0.17 0.17'));
                $commands[] = self::drawText($left, $cursorY, 10, $row['label']);
                $commands[] = self::drawText($left + $barWidth + 22, $cursorY, 10, $row['value']);
                if (($row['detail'] ?? '') !== '') {
                    $commands[] = self::drawText($left + $barWidth + 120, $cursorY, 9, (string) $row['detail'], '0.35 0.41 0.47');
                }
                $commands[] = self::drawFill($left, $barY - 6, $barWidth, 8, '0.90 0.92 0.95');
                $commands[] = self::drawFill($left, $barY - 6, ($barWidth * $ratio) / 100, 8, $barColor);
                $cursorY -= 24;
            }
            $cursorY -= 6;
        }

        if ($details !== []) {
            $commands[] = self::drawText($left, $cursorY, 11, 'Detalle');
            $cursorY -= 18;
            foreach ($details as $line) {
                $wrapped = self::wrapText($line, $isLandscape ? 118 : 78);
                foreach ($wrapped as $segment) {
                    if ($cursorY < $bottomY + 16) {
                        $commands[] = self::drawText($left, 20, 8, 'Documento corporativo · Eco Delivery Routes');
                        $pages[] = implode("\n", $commands) . "\n";
                        $commands = [];
                        $pageNumber++;
                        $cursorY = self::appendHeader(
                            commands: $commands,
                            pageNumber: $pageNumber,
                            pageWidth: $pageWidth,
                            pageHeight: $pageHeight,
                            left: $left,
                            right: $right,
                            topBandY: $topBandY,
                            title: $title,
                            subtitle: $subtitle,
                            logoData: $logoData
                        );
                    }
                    $commands[] = self::drawText($left, $cursorY, 10, $segment);
                    $cursorY -= 14;
                }
            }
        }

        $commands[] = self::drawText($left, 20, 8, 'Documento corporativo · Eco Delivery Routes');
        $pages[] = implode("\n", $commands) . "\n";

        return self::compilePdf(
            pages: $pages,
            pageWidth: $pageWidth,
            pageHeight: $pageHeight,
            logoData: is_string($logoData) ? $logoData : null
        );
    }

    /**
     * @param array<int, string> &$commands
     */
    private static function appendHeader(
        array &$commands,
        int $pageNumber,
        int $pageWidth,
        int $pageHeight,
        int $left,
        int $right,
        int $topBandY,
        string $title,
        string $subtitle,
        string|false $logoData
    ): float {
        $commands[] = self::drawFill(0, 0, $pageWidth, $pageHeight, '1 1 1');
        $commands[] = self::drawFill(0, $topBandY, $pageWidth, 60, '0.06 0.11 0.18');
        if ($logoData !== false) {
            $commands[] = 'q 24 0 0 24 32 ' . ($topBandY + 13) . ' cm /Im1 Do Q';
        }
        $commands[] = self::drawText(64, $topBandY + 29, 20, $title, '1 1 1');
        $commands[] = self::drawText(64, $topBandY + 12, 10, $subtitle, '0.86 0.90 0.95');
        $commands[] = self::drawText($right - 46, $topBandY + 12, 9, 'Página ' . $pageNumber, '0.86 0.90 0.95');
        $commands[] = self::drawStroke($left, $topBandY - 10, $right - $left, 1, '0.85 0.89 0.94');

        return $pageHeight - 95;
    }

    private static function drawText(float $x, float $y, int $size, string $text, string $rgb = '0.10 0.14 0.20'): string
    {
        return sprintf('%s rg BT /F1 %d Tf %.2F %.2F Td (%s) Tj ET', $rgb, $size, $x, $y, self::escapeText($text));
    }

    private static function drawFill(float $x, float $y, float $w, float $h, string $rgb): string
    {
        return sprintf('%s rg %.2F %.2F %.2F %.2F re f', $rgb, $x, $y, $w, $h);
    }

    private static function drawStroke(float $x, float $y, float $w, float $h, string $rgb): string
    {
        return sprintf('%s RG %.2F %.2F %.2F %.2F re S', $rgb, $x, $y, $w, $h);
    }

    private static function escapeText(string $value): string
    {
        $encoded = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $value);
        if ($encoded === false) {
            $encoded = $value;
        }
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $encoded);
    }

    /**
     * @return array<int, string>
     */
    private static function wrapText(string $value, int $maxChars): array
    {
        $clean = trim($value);
        if ($clean === '') {
            return [''];
        }

        $words = preg_split('/\s+/', $clean) ?: [$clean];
        $lines = [];
        $current = '';
        foreach ($words as $word) {
            $candidate = $current === '' ? $word : $current . ' ' . $word;
            if (mb_strlen($candidate) <= $maxChars) {
                $current = $candidate;
                continue;
            }
            if ($current !== '') {
                $lines[] = $current;
            }
            $current = $word;
        }
        if ($current !== '') {
            $lines[] = $current;
        }

        return $lines === [] ? [$clean] : $lines;
    }

    /**
     * @param array<int, string> $pages
     */
    private static function compilePdf(array $pages, int $pageWidth, int $pageHeight, ?string $logoData): string
    {
        $objects = [];
        $objects[] = '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj';

        $pageCount = count($pages);
        $pageObjectStart = 3;
        $contentObjectStart = $pageObjectStart + $pageCount;
        $fontObjectNum = $contentObjectStart + $pageCount;
        $imageObjectNum = $fontObjectNum + 1;

        $kids = [];
        for ($index = 0; $index < $pageCount; $index++) {
            $kids[] = ($pageObjectStart + $index) . ' 0 R';
        }
        $objects[] = '2 0 obj << /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . $pageCount . ' >> endobj';

        for ($index = 0; $index < $pageCount; $index++) {
            $pageObjectNum = $pageObjectStart + $index;
            $contentObjectNum = $contentObjectStart + $index;
            $resources = '<< /Font << /F1 ' . $fontObjectNum . ' 0 R >>';
            if ($logoData !== null) {
                $resources .= ' /XObject << /Im1 ' . $imageObjectNum . ' 0 R >>';
            }
            $resources .= ' >>';
            $objects[] = sprintf(
                '%d 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Contents %d 0 R /Resources %s >> endobj',
                $pageObjectNum,
                $pageWidth,
                $pageHeight,
                $contentObjectNum,
                $resources
            );
        }

        foreach ($pages as $index => $content) {
            $contentObjectNum = $contentObjectStart + $index;
            $objects[] = sprintf(
                "%d 0 obj << /Length %d >> stream\n%sendstream endobj",
                $contentObjectNum,
                strlen($content),
                $content
            );
        }

        $objects[] = $fontObjectNum . ' 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj';
        if ($logoData !== null) {
            $objects[] = $imageObjectNum . ' 0 obj << /Type /XObject /Subtype /Image /Width 980 /Height 1024 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen($logoData) . " >> stream\n" . $logoData . "\nendstream endobj";
        }

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $object) {
            $offsets[] = strlen($pdf);
            $pdf .= $object . "\n";
        }

        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n";
        $pdf .= '0 ' . (count($objects) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf('%010d 00000 n ', $offset) . "\n";
        }
        $pdf .= "trailer << /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
        $pdf .= "startxref\n{$xrefOffset}\n%%EOF";

        return $pdf;
    }
}

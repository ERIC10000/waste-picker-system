"""Export the generated DOCX to the public PDF with Microsoft Word.

Word is used because it preserves the document's pagination, captions, tables,
headers and image quality more faithfully than an ad-hoc converter. A separate
Word instance is always created and closed in ``finally`` so report generation
does not leave another orphaned automation process.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pythoncom
from win32com.client import DispatchEx


DOCX_NAME = "Waste Picker System - Detailed System Report.docx"
PDF_NAME = "Waste Picker System - System Documentation.pdf"


def export_pdf(source: Path, target: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"Generated report not found: {source}")

    source = source.resolve()
    target = target.resolve()
    target.parent.mkdir(parents=True, exist_ok=True)

    pythoncom.CoInitialize()
    word = None
    document = None
    try:
        word = DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0
        word.AutomationSecurity = 3
        document = word.Documents.Open(
            str(source),
            ConfirmConversions=False,
            ReadOnly=True,
            AddToRecentFiles=False,
        )
        document.ExportAsFixedFormat(
            OutputFileName=str(target),
            ExportFormat=17,
            OpenAfterExport=False,
            OptimizeFor=0,
            Range=0,
            Item=0,
            IncludeDocProps=True,
            KeepIRM=True,
            CreateBookmarks=1,
            DocStructureTags=True,
            BitmapMissingFonts=True,
            UseISO19005_1=False,
        )
    finally:
        if document is not None:
            try:
                document.Close(SaveChanges=False)
            except Exception:
                # Word may already have closed the read-only document after a
                # successful fixed-format export.
                pass
        if word is not None:
            try:
                word.Application.Quit(0)
            except Exception:
                # A disconnected COM object means the dedicated Word process
                # has already exited; cleanup should not mask a valid export.
                pass
        pythoncom.CoUninitialize()


def parse_args() -> argparse.Namespace:
    report_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=report_dir / DOCX_NAME)
    parser.add_argument("--output", type=Path, default=report_dir / PDF_NAME)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    export_pdf(args.input, args.output)
    print(f"Exported {args.output.resolve()}")

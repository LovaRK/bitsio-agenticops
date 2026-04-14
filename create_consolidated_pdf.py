#!/usr/bin/env python3
"""
Create consolidated PDF from 5 documentation files.
Usage: python create_consolidated_pdf.py
Output: docs/BitsIO_AgenticOps_Phase8_Complete_Package.pdf
"""

from datetime import datetime
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)


def markdown_to_paragraphs(md_text: str, styles: dict) -> list:
    """Convert markdown text to Platypus paragraphs."""
    paragraphs = []

    for line in md_text.split("\n"):
        line = line.rstrip()

        if not line:
            paragraphs.append(Spacer(1, 0.2 * inch))
        elif line.startswith("# "):
            # H1
            text = line[2:].strip()
            paragraphs.append(Paragraph(text, styles["Heading1"]))
            paragraphs.append(Spacer(1, 0.2 * inch))
        elif line.startswith("## "):
            # H2
            text = line[3:].strip()
            paragraphs.append(Paragraph(text, styles["Heading2"]))
            paragraphs.append(Spacer(1, 0.15 * inch))
        elif line.startswith("### "):
            # H3
            text = line[4:].strip()
            paragraphs.append(Paragraph(text, styles["Heading3"]))
            paragraphs.append(Spacer(1, 0.1 * inch))
        elif line.startswith("> "):
            # Blockquote
            text = line[2:].strip()
            paragraphs.append(Paragraph(f"<i>{text}</i>", styles["Normal"]))
        elif line.startswith("- "):
            # Bullet point
            text = line[2:].strip()
            paragraphs.append(Paragraph(f"• {text}", styles["Normal"]))
        elif line.startswith("```"):
            # Code block (skip markers)
            continue
        else:
            # Regular paragraph
            if line.strip():
                paragraphs.append(Paragraph(line, styles["Normal"]))

    return paragraphs


def create_cover_page(styles: dict) -> list:
    """Create professional cover page."""
    elements = []

    # Title
    elements.append(Spacer(1, 1.5 * inch))
    title = Paragraph(
        "BitsIO AgenticOps",
        ParagraphStyle(
            "cover_title",
            parent=styles["Heading1"],
            fontSize=48,
            textColor=HexColor("#2E86AB"),
            spaceAfter=0.3 * inch,
            alignment=TA_CENTER,
            fontName="Helvetica-Bold",
        ),
    )
    elements.append(title)

    # Subtitle
    subtitle = Paragraph(
        "Phase 8 Complete Documentation Package",
        ParagraphStyle(
            "cover_subtitle",
            parent=styles["Normal"],
            fontSize=24,
            textColor=HexColor("#A23B72"),
            spaceAfter=0.5 * inch,
            alignment=TA_CENTER,
            fontName="Helvetica",
        ),
    )
    elements.append(subtitle)

    # Description
    elements.append(Spacer(1, 0.3 * inch))
    desc = Paragraph(
        "Live Splunk Integration | RBAC Security | Load Testing Results<br/>"
        "Operator Handbook | Demo Readiness Guide",
        ParagraphStyle(
            "cover_desc",
            parent=styles["Normal"],
            fontSize=12,
            textColor=HexColor("#555555"),
            alignment=TA_CENTER,
            spaceAfter=1.5 * inch,
        ),
    )
    elements.append(desc)

    # Footer info
    elements.append(Spacer(1, 1.0 * inch))
    footer_style = ParagraphStyle(
        "cover_footer",
        parent=styles["Normal"],
        fontSize=10,
        textColor=HexColor("#888888"),
        alignment=TA_CENTER,
    )
    elements.append(Paragraph(f"Date: {datetime.now().strftime('%B %d, %Y')}", footer_style))
    elements.append(Paragraph("Version: 1.0", footer_style))
    elements.append(Paragraph("Status: Production Ready", footer_style))

    elements.append(PageBreak())
    return elements


def create_toc(styles: dict) -> list:
    """Create table of contents."""
    elements = []

    elements.append(Paragraph("Table of Contents", styles["Heading1"]))
    elements.append(Spacer(1, 0.3 * inch))

    toc_items = [
        ("1. Phase 8 Complete Summary", "3"),
        ("2. Operator Handbook", "12"),
        ("3. Demo Readiness Guide", "20"),
        ("4. RBAC & Security Audit", "28"),
        ("5. Baseline Load Test Analysis", "31"),
    ]

    for title, page in toc_items:
        p = Paragraph(
            f"{title} <dotfiller/> {page}",
            ParagraphStyle(
                "toc_entry",
                parent=styles["Normal"],
                fontSize=11,
                leftIndent=0.3 * inch,
                spaceAfter=0.15 * inch,
                textColor=HexColor("#2E86AB"),
            ),
        )
        elements.append(p)

    elements.append(Spacer(1, 0.3 * inch))
    elements.append(PageBreak())
    return elements


def read_markdown_file(filepath: str) -> str:
    """Read markdown file and clean up content."""
    with open(filepath) as f:
        content = f.read()

    # Remove frontmatter if present
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            content = parts[2].lstrip("\n")

    return content


def create_section(title: str, content: str, styles: dict) -> list:
    """Create a section with title and content."""
    elements = []

    # Section heading
    elements.append(Paragraph(title, styles["Heading1"]))
    elements.append(Spacer(1, 0.2 * inch))

    # Convert markdown to paragraphs
    para_elements = markdown_to_paragraphs(content, styles)
    elements.extend(para_elements)

    elements.append(Spacer(1, 0.3 * inch))
    elements.append(PageBreak())

    return elements


def create_consolidated_pdf():
    """Main function to create consolidated PDF."""

    # Setup
    output_path = Path(
        "/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/docs/BitsIO_AgenticOps_Phase8_Complete_Package.pdf"
    )

    # Create document
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=1.0 * inch,
    )

    # Setup styles
    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(
        ParagraphStyle(
            name="CustomHeading1",
            parent=styles["Heading1"],
            fontSize=18,
            textColor=HexColor("#2E86AB"),
            spaceAfter=0.3 * inch,
            spaceBefore=0.2 * inch,
        )
    )

    styles.add(
        ParagraphStyle(
            name="CustomHeading2",
            parent=styles["Heading2"],
            fontSize=14,
            textColor=HexColor("#A23B72"),
            spaceAfter=0.2 * inch,
        )
    )

    styles.add(
        ParagraphStyle(
            name="italic",
            parent=styles["Normal"],
            fontSize=10,
            textColor=HexColor("#666666"),
            italic=True,
        )
    )

    # Build document
    elements = []

    # Cover page
    elements.extend(create_cover_page(styles))

    # Table of contents
    elements.extend(create_toc(styles))

    # Read all 5 documents
    base_path = Path("/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops")

    docs = [
        ("1. Phase 8 Complete Summary", base_path / "docs/PHASE_8_COMPLETE_SUMMARY.md"),
        ("2. Operator Handbook", base_path / "docs/OPERATOR_HANDBOOK.md"),
        ("3. Demo Readiness Guide", base_path / "docs/DEMO_READINESS.md"),
        ("4. RBAC & Security Audit", base_path / "docs/RBAC_AUDIT.md"),
        ("5. Baseline Load Test Analysis", base_path / "reports/BASELINE_ANALYSIS.md"),
    ]

    for doc_title, doc_path in docs:
        if doc_path.exists():
            content = read_markdown_file(str(doc_path))
            section_elements = create_section(doc_title, content, styles)
            elements.extend(section_elements)
        else:
            print(f"⚠️  Warning: {doc_path} not found")

    # Add final page break
    elements.append(PageBreak())

    # Add footer info page
    elements.append(Paragraph("Document Information", styles["Heading1"]))
    elements.append(Spacer(1, 0.2 * inch))

    info_items = [
        ("Generated", datetime.now().strftime("%B %d, %Y at %H:%M UTC")),
        ("Version", "1.0"),
        ("Status", "Production Ready"),
        ("Phase", "8 Complete + Hardening Plan"),
        ("Contents", "5 comprehensive guides"),
        ("Pages", "~35"),
    ]

    for label, value in info_items:
        p = Paragraph(f"<b>{label}:</b> {value}", styles["Normal"])
        elements.append(p)
        elements.append(Spacer(1, 0.15 * inch))

    # Build PDF
    try:
        doc.build(elements)
        print(f"✅ PDF created successfully: {output_path}")
        print(f"   File size: {output_path.stat().st_size / 1024:.1f} KB")
        return output_path
    except Exception as e:
        print(f"❌ Error creating PDF: {e}")
        raise


if __name__ == "__main__":
    output = create_consolidated_pdf()
    print(f"\n🎯 Ready to share at: {output}")

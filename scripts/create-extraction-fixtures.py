"""Rebuild fictional raw supplier evidence; contains no extracted answer fields."""
from pathlib import Path
from email.message import EmailMessage
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

folder = Path(__file__).resolve().parents[1] / "public/examples/extraction"
folder.mkdir(parents=True, exist_ok=True)
pdf = folder / "garden-suite-voucher.pdf"
c = canvas.Canvas(str(pdf), pagesize=(595, 842), invariant=1)
c.setTitle("Fictional supplier voucher - Reed")
c.setFillColor(HexColor("#244a40"))
c.rect(0, 680, 595, 162, fill=1, stroke=0)
c.setFillColor(HexColor("#ffffff"))
c.setFont("Helvetica", 11)
c.drawString(46, 792, "AOI GARDEN RYOKAN  /  RESERVATIONS")
c.setFont("Helvetica-Bold", 25)
c.drawString(46, 744, "Garden suite confirmation")
c.setFont("Helvetica", 11)
c.drawString(46, 715, "Voucher issued 22 October 2026  |  Booking RYO-4821")
c.setFillColor(HexColor("#263d35"))
lines = [
    ("Guest", "Alex Reed and Jordan Reed"),
    ("Accommodation", "One garden suite for 2 adults"),
    ("Check-in", "15 March 2027"),
    ("Check-out", "19 March 2027"),
    ("Status", "Confirmed"),
    ("Payment", "Deposit pending; due 1 November 2026"),
]
y = 630
for label, value in lines:
    c.setFont("Helvetica", 10)
    c.drawString(46, y, label.upper())
    c.setFont("Helvetica-Bold", 13)
    c.drawString(200, y, value)
    y -= 43
c.setFont("Helvetica-Bold", 14)
c.drawString(46, 320, "Before arrival")
c.setFont("Helvetica", 11)
for i, line in enumerate([
    "Airport transfer requested, not confirmed. Arrival flight is still required.",
    "Please provide luggage count before we allocate a vehicle.",
    "Feather-free bedding is requested, subject to housekeeping confirmation.",
    "Breakfast is included. This voucher does not confirm payment receipt.",
]):
    c.drawString(46, 290 - i * 23, line)
c.setFont("Helvetica", 9)
c.setFillColor(HexColor("#6b756c"))
c.drawString(46, 65, "SYNTHETIC TRAINING FIXTURE - fictional supplier, guests and booking")
c.drawString(46, 48, "Page 1 of 1  |  Compare with the accompanying supplier email.")
c.save()

def email(filename, sender, subject, body, attachment=False):
    message = EmailMessage()
    message["From"] = sender
    message["To"] = "Maya Chen <maya@atlas-example.invalid>"
    message["Subject"] = subject
    message["Date"] = "Thu, 22 Oct 2026 14:00:00 +0000"
    message["Message-ID"] = f"<{filename}@fixtures.example.invalid>"
    message.set_content(body)
    if attachment:
        message.add_attachment(pdf.read_bytes(), maintype="application", subtype="pdf", filename=pdf.name)
        message.set_boundary("synthetic-garden-suite-boundary")
    (folder / filename).write_bytes(message.as_bytes())

email("ryokan-confirmation.eml", "Yuki Sato <reservations@aoi-example.invalid>",
      "Re: Reed / Kyoto garden suite / your file AT-JP-270314", """Dear Maya,

We are delighted to confirm one garden suite for Alex and Jordan Reed, two adults, arriving 14 March 2027 and departing 19 March 2027. Our booking reference is RYO-4821; your agency file is AT-JP-270314.

The deposit is still outstanding and is due on 1 November 2026. Airport transfer is requested but not confirmed; please send the arrival flight and luggage count so we can allocate a car.

The confirmation voucher is attached. Please flag any discrepancy before sending it to the guests.

Warm regards,
Yuki | Aoi Garden Ryokan
SYNTHETIC TRAINING FIXTURE: all people and suppliers are fictional.
""", attachment=True)
email("tea-ceremony-hold.eml", "Ken Mori <concierge@kyoto-example.invalid>",
      "Reed private tea ceremony - option held", """Hi Maya,

For your agency file AT-JP-270314, we can hold a private tea ceremony for Alex and Jordan Reed on 17 March 2027 at 16:00 for two adults. Our reference is TEA-2049.

This is an option hold, not a confirmed booking. It expires on 25 October 2026 at 18:00 Japan time. Payment has not been received. Please obtain the guests' approval before we confirm.

Best,
Ken | Kyoto Private Experiences
SYNTHETIC TRAINING FIXTURE: all people and suppliers are fictional.
""")
messages = [
    {"MessageSid": "SM" + "a" * 32, "From": "whatsapp:+12025550145", "Body": "Hi Maya! For our Kyoto trip, could we move the ryokan arrival to 13 March 2027 instead? Booking RYO-4821. Jordan needs feather-free bedding. We haven't chosen flights yet. Please check with the hotel before changing anything."},
    {"MessageSid": "SM" + "b" * 32, "From": "whatsapp:+12025550146", "Body": "Hi, Alex Reed here. Can you move our arrival a day earlier? Thanks!"},
]
(folder / "whatsapp-messages.json").write_text(json.dumps(messages, indent=2) + "\n")
print(f"Created 2 emails, 1 PDF and 2 WhatsApp fixtures in {folder}")

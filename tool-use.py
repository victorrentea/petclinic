import os
import base64
from pathlib import Path

import anthropic

invoice_tool = {
  "name": "extract_invoice",
  "description": "Extract structured data from an invoice document. Call this tool with all fields you can identify from the text.",
  "input_schema": {
    "type": "object",
    "properties": {
      "vendor_name": {
        "type": "string",
        "description": "The name of the vendor or supplier"
      },
      "invoice_date": {
        "type": "string",
        "description": "Invoice date in ISO 8601 format (YYYY-MM-DD)"
      },
      "invoice_number": {
        "type": "string",
        "description": "The invoice reference number"
      },
      "total_amount": {
        "type": "number",
        "description": "Total amount due as a number, no currency symbols"
      },
      "currency": {
        "type": "string",
        "enum": ["USD", "EUR", "GBP", "other"],
        "description": "Currency of the invoice"
      },
      "currency_detail": {
        "type": "string",
        "description": "Required if currency is 'other' — specify the currency"
      },
      "line_items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "description": { "type": "string" },
            "quantity": { "type": "number" },
            "unit_price": { "type": "number" },
            "amount": { "type": "number" }
          },
          "required": ["description", "amount"]
        }
      },
      "payment_terms": {
        "type": "string",
        "description": "Payment terms if stated, e.g. Net 30. Null if not present."
      }
    },
    "required": ["vendor_name", "total_amount", "currency"]
  }
}


api_key = os.getenv("ANTHROPIC_API_KEY")
client = anthropic.Anthropic(api_key=api_key)

# Your document text
invoice_text = """
    ACME Supplies Ltd
    Invoice #INV-2024-0892
    Date: March 3rd, 2024

    Bill To: Globex Corporation

    Services:
    - Web hosting (12 months)     $1,200.00
    - SSL certificate              $99.00
    - Setup fee                    $250.00

    Total Due: $1,549.00
    Payment Terms: Net 30
"""
# response = client.messages.create(
#   model="claude-sonnet-4-20250514",
#   max_tokens=1024,
#   tools=[invoice_tool],
#   tool_choice={"type": "tool", "name": "extract_invoice"},  # Force this specific tool
#   messages=[
#     {
#       "role": "user",
#       "content": f"Extract all data from this invoice:\n\n{invoice_text}"
#     }
#   ]
# )

# or upload pdf
PDF_INVOICE_PATH = Path(
  "/Users/victorrentea/Downloads/e-Factura_client_-_MILICA-NASTASIA-PR-ITKONEKT__09-03-2026__P191__SmartBill (1).pdf"
)
def load_pdf_as_base64(pdf_path: Path) -> str:
  if not pdf_path.exists():
    raise FileNotFoundError(f"Invoice PDF not found: {pdf_path}")
  if not pdf_path.is_file():
    raise ValueError(f"Invoice path is not a file: {pdf_path}")

  pdf_bytes = pdf_path.read_bytes()
  if not pdf_bytes:
    raise ValueError(f"Invoice PDF is empty: {pdf_path}")

  return base64.b64encode(pdf_bytes).decode("ascii")

invoice_pdf_base64 = load_pdf_as_base64(PDF_INVOICE_PATH)

response = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=1024,
  tools=[invoice_tool],
  tool_choice={"type": "tool", "name": "extract_invoice"},  # Force this specific tool
  messages=[
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Extract all structured invoice data from this PDF and call the extract_invoice tool.",
        },
        {
          "type": "document",
          "source": {
            "type": "base64",
            "media_type": "application/pdf",
            "data": invoice_pdf_base64,
          },
        },
      ],
    }
  ]
)

# Find the tool_use block in the response
tool_use_block = next(
  block for block in response.content
  if block.type == "tool_use"
)

# This is your structured data as a Python dict
extracted_data = tool_use_block.input

print(extracted_data)
# {
#   "vendor_name": "ACME Supplies Ltd",
#   "invoice_date": "2024-03-03",
#   "invoice_number": "INV-2024-0892",
#   "total_amount": 1549.00,
#   "currency": "USD",
#   "line_items": [
#     {"description": "Web hosting (12 months)", "amount": 1200.00},
#     {"description": "SSL certificate", "amount": 99.00},
#     {"description": "Setup fee", "amount": 250.00}
#   ],
#   "payment_terms": "Net 30"
# }

def validate_invoice(data):
  errors = []

  # Check line items sum to total
  if "line_items" in data:
    calculated_total = sum(item["amount"] for item in data["line_items"])
    stated_total = data["total_amount"]
    if abs(calculated_total - stated_total) > 0.01:  # Allow for rounding
      errors.append(
        f"Line items sum to {calculated_total} but total_amount is {stated_total}"
      )

  # Check currency_detail present when currency is "other"
  if data.get("currency") == "other" and not data.get("currency_detail"):
    errors.append("currency is 'other' but currency_detail is missing")

  return errors

errors = validate_invoice(extracted_data)
if errors:
  print("Semantic validation failed:", errors)
else:
  print("Validation passed — safe to use")

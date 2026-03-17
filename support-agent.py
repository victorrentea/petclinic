import os

tools = [
  {
    "name": "get_customer",
    "description": (
      "Retrieves a customer account by email address or customer ID. "
      "Use this FIRST before any order or refund operations to verify "
      "the customer's identity. Returns customer ID, name, account status, "
      "and tier. Do NOT use this to look up orders — use lookup_order for that."
      # ⭐️ TOOL DIFFERENTIATION
    ),
    "input_schema": {
      "type": "object",
      "properties": {
        "identifier": {
          "type": "string",
          "description": "Customer email address or customer ID (format: CUST-XXXXX)"
        },
        "identifier_type": {
          "type": "string",
          "enum": ["email", "customer_id"],
          "description": "Whether the identifier is an email or customer ID"
        }
      },
      "required": ["identifier", "identifier_type"]
    }
  },

  {
    "name": "lookup_order",
    "description": (
      "Retrieves order details by order ID or by customer ID. "
      "Use this to check order status, shipping info, and item details. "
      "Requires a verified customer ID from get_customer first. "
      "Do NOT use this for account information — use get_customer for that."
    ),
    "input_schema": {
      "type": "object",
      "properties": {
        "customer_id": {
          "type": "string",
          "description": "Verified customer ID from get_customer"
        },
        "order_id": {
          "type": "string",
          "description": "Order ID (format: ORD-XXXXX). Optional if customer_id provided."
        }
      },
      "required": ["customer_id"]
    }
  },
  {
    "name": "process_refund",
    "description": (
      "Processes a refund for a specific order. "
      "Requires both a verified customer ID and a valid order ID. "
      "Only use after get_customer and lookup_order have confirmed "
      "the customer identity and order details. "
      "Maximum refund amount is $500 — escalate larger amounts to human agents."
    ),
    "input_schema": {
      "type": "object",
      "properties": {
        "customer_id": {
          "type": "string",
          "description": "Verified customer ID from get_customer"
        },
        "order_id": {
          "type": "string",
          "description": "Order ID to refund"
        },
        "amount": {
          "type": "number",
          "description": "Refund amount in USD"
        },
        "reason": {
          "type": "string",
          "description": "Reason for the refund"
        }
      },
      "required": ["customer_id", "order_id", "amount", "reason"]
    }
  },
  {
    "name": "escalate_to_human",
    "description": (
      "Escalates the case to a human agent. Use when: "
      "1) Customer explicitly requests a human, "
      "2) Refund amount exceeds $500, "
      "3) Policy does not cover the customer's situation, "
      "4) You cannot make meaningful progress after investigation. "
      "Always compile a full summary before escalating."
    ),
    "input_schema": {
      "type": "object",
      "properties": {
        "customer_id": {"type": "string"},
        "issue_summary": {"type": "string"},
        "root_cause": {"type": "string"},
        "recommended_action": {"type": "string"},
        "urgency": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        }
      },
      "required": ["issue_summary", "recommended_action", "urgency"]
    }
  }
]

# This is the code that actually runs when Claude calls a tool.
# In a real system these would call your databases and APIs. Here we simulate them:

import json

# Simulated database
CUSTOMERS = {
  "john@example.com": {
    "customer_id": "CUST-00123",
    "name": "John Smith",
    "status": "active",
    "tier": "premium"
  }
}

ORDERS = {
  "CUST-00123": [
    {
      "order_id": "ORD-88821",
      "status": "delivered",
      "amount": 147.50,
      "items": ["Wireless headphones"],
      "delivery_date": "2024-03-01"
    }
  ]
}

def execute_tool(tool_name, tool_input, verified_customer_id=None):
  """Execute a tool call and return structured result."""

  if tool_name == "get_customer":
    identifier = tool_input["identifier"]
    id_type = tool_input["identifier_type"]

    if id_type == "email":
      customer = CUSTOMERS.get(identifier)
    else:
      customer = next(
        (c for c in CUSTOMERS.values()
         if c["customer_id"] == identifier),
        None
      )

    if customer:
      return {"success": True, "customer": customer}
    else:
      return { # Structured error response ⭐️
        "success": False,
        "error": {
          "errorCategory": "validation",
          "isRetryable": False,
          "message": f"No customer found for {identifier}"
        }
      }

  elif tool_name == "lookup_order":
    # Programmatic prerequisite check ⭐️
    if not verified_customer_id:
      return {
        "success": False,
        "error": {
          "errorCategory": "validation",
          "isRetryable": False,
          "message": "Customer must be verified via get_customer before looking up orders"
        }
      }

    customer_id = tool_input["customer_id"]
    orders = ORDERS.get(customer_id, [])

    if "order_id" in tool_input:
      orders = [o for o in orders if o["order_id"] == tool_input["order_id"]]

    return {"success": True, "orders": orders}

  elif tool_name == "process_refund":
    amount = tool_input["amount"]

    # Programmatic business rule enforcement — Domain 1 concept
    if amount > 500:
      return {
        "success": False,
        "error": {
          "errorCategory": "business",
          "isRetryable": False,
          "message": f"Refund of ${amount} exceeds $500 limit. Escalate to human agent."
        }
      }

    # Process the refund
    return {
      "success": True,
      "refund_id": "REF-55123",
      "amount": amount,
      "status": "approved",
      "estimated_days": 3
    }

  elif tool_name == "escalate_to_human":
    # In a real system this would create a ticket
    print(f"\n[ESCALATION] {tool_input['issue_summary']}")
    return {
      "success": True,
      "ticket_id": "TKT-99001",
      "message": "Case escalated successfully"
    }

  else:
    return {
      "success": False,
      "error": {
        "errorCategory": "validation",
        "isRetryable": False,
        "message": f"Unknown tool: {tool_name}"
      }
    }

SYSTEM_PROMPT = """You are a customer support agent for Acme Store.

Your goal is to resolve customer issues efficiently and accurately.
Target: resolve 80%+ of cases without escalation.

TOOL ORDERING RULES:
- Always call get_customer FIRST to verify identity before any other operation
- Only call lookup_order after get_customer has returned a verified customer ID
- Only call process_refund after both get_customer and lookup_order have completed

ESCALATION CRITERIA — escalate immediately when:
- Customer explicitly requests a human agent
- Refund amount exceeds $500
- Company policy does not cover the customer's specific situation
- You cannot make meaningful progress after thorough investigation

Do NOT escalate just because a case seems complex — attempt resolution first.
Do NOT use sentiment or your own confidence as escalation triggers.

WHEN ESCALATING:
Always compile: customer ID, root cause, amounts involved, and recommended action.
The human agent will not have access to this conversation.

REFUND POLICY:
- Approved for: damaged items, wrong items, non-delivery after 14 days
- Not approved for: change of mind after 30 days, digital downloads after access
- Amounts over $500 require human approval

Respond in a professional, empathetic tone. Be concise."""
# ⭐️ structured handoff (for human escalation)
# ⭐️ ✅Escalate: policy not covering, over threshold, explicit ask for human, no meaningful progress
#    ❌ DONT escalate: emotional/angry customer, complex case

import anthropic


api_key = os.getenv("ANTHROPIC_API_KEY")
client = anthropic.Anthropic(api_key=api_key)

def run_agent(user_message, max_iterations=10):
  """
  Run the customer support agent.
  Continues looping while stop_reason is 'tool_use'.
  Stops when stop_reason is 'end_turn'.
  """

  # Conversation history — grows with each turn
  messages = [{"role": "user", "content": user_message}]

  # Track verified customer for programmatic prerequisite checks
  verified_customer_id = None

  print(f"\nUser: {user_message}\n")

  for iteration in range(max_iterations):

    # Call Claude
    response = client.messages.create(
      model="claude-sonnet-4-20250514",
      max_tokens=4096,
      system=SYSTEM_PROMPT,
      tools=tools,
      messages=messages
    )

    # Check stop reason — this is the core loop control ⭐️
    if response.stop_reason == "end_turn":
      # Claude is done — extract and return the final text response
      final_text = next(
        (block.text for block in response.content
         if hasattr(block, "text")),
        "No response generated"
      )
      print(f"Agent: {final_text}")
      return final_text

    elif response.stop_reason == "tool_use":
      # Claude wants to use tools — process all tool calls in this response

      # Add Claude's response to history
      messages.append({
        "role": "assistant",
        "content": response.content
      })

      # Process each tool call
      tool_results = []
      for block in response.content:
        if block.type == "tool_use":
          tool_name = block.name
          tool_input = block.input

          print(f"[Tool call] {tool_name}: {json.dumps(tool_input, indent=2)}")

          # Execute the tool with prerequisite tracking
          result = execute_tool(
            tool_name,
            tool_input,
            verified_customer_id=verified_customer_id
          )
          result = post_tool_use_hook(tool_name, result)  # Apply hook before adding to history

          # Track verified customer ID for downstream prerequisite checks
          if tool_name == "get_customer" and result.get("success"):
            verified_customer_id = result["customer"]["customer_id"]

          print(f"[Tool result] {json.dumps(result, indent=2)}\n")

          tool_results.append({
            "type": "tool_result",
            "tool_use_id": block.id,
            "content": json.dumps(result)
          })


      # Add tool results to conversation history
      # Claude will use these to decide the next action
      messages.append({
        "role": "user",
        "content": tool_results
      })

    else:
      # Unexpected stop reason
      print(f"Unexpected stop_reason: {response.stop_reason}")
      break

  return "Agent reached maximum iterations without completing"


def post_tool_use_hook(tool_name, raw_result):
  """
  Normalise tool results before they reach Claude.
  Trims verbose fields, standardises formats.
  """
  if not raw_result.get("success"):
    return raw_result

  # Trim customer data to only relevant fields
  if tool_name == "get_customer" and "customer" in raw_result:
    customer = raw_result["customer"]
    return {
      "success": True,
      "customer": {
        "customer_id": customer["customer_id"],
        "name": customer["name"],
        "status": customer["status"]
        # Deliberately omit tier, preferences, ⭐️
        # billing history — not needed for support
      }
    }

  # Trim order data to relevant fields
  if tool_name == "lookup_order" and "orders" in raw_result:
    trimmed_orders = []
    for order in raw_result["orders"]:
      trimmed_orders.append({
        "order_id": order["order_id"],
        "status": order["status"],
        "amount": order["amount"],
        "items": order["items"]
        # Omit internal logistics fields,
        # warehouse codes, carrier details etc.
      })
    return {"success": True, "orders": trimmed_orders}

  return raw_result

if __name__ == "__main__":

  # Test case 1 — straightforward refund
  run_agent(
    "Hi, I'm john@example.com and I need a refund for order ORD-88821. "
    "The headphones arrived damaged."
  )

  input("\nPress ENTER to run next test case...")

  # Test case 2 — customer requests human
  run_agent(
    "I want to speak to a human agent about my account please."
  )

  input("\nPress ENTER to run next test case...")
  # Test case 3 — refund exceeds limit
  run_agent(
    "I need a $750 refund for john@example.com, order ORD-88821."
  )

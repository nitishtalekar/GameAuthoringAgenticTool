import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";

export type { BaseMessage };

export function human(content: string): HumanMessage {
  return new HumanMessage({ content });
}

export function ai(content: string): AIMessage {
  return new AIMessage({ content });
}

export function system(content: string): SystemMessage {
  return new SystemMessage({ content });
}

/**
 * Swaps Human <-> AI roles in a message list.
 * Useful for constructing conversation history from another agent's perspective.
 * SystemMessages pass through unchanged.
 */
export function swapRoles(messages: BaseMessage[]): BaseMessage[] {
  return messages.map((msg) => {
    if (msg instanceof HumanMessage) {
      return new AIMessage({ content: msg.content });
    }
    if (msg instanceof AIMessage) {
      return new HumanMessage({ content: msg.content });
    }
    return msg;
  });
}

export function getLastMessageContent(messages: BaseMessage[]): string {
  if (messages.length === 0) return "";
  const last = messages[messages.length - 1];
  return typeof last.content === "string" ? last.content : "";
}

/**
 * Converts plain { role, content } objects into typed BaseMessage instances.
 * Use when deserializing messages from an API request body.
 */
export function deserializeMessages(
  raw: Array<{ role: "human" | "ai" | "system"; content: string }>
): BaseMessage[] {
  return raw.map((msg) => {
    switch (msg.role) {
      case "human":
        return new HumanMessage({ content: msg.content });
      case "ai":
        return new AIMessage({ content: msg.content });
      case "system":
        return new SystemMessage({ content: msg.content });
    }
  });
}

export function serializeMessages(
  messages: BaseMessage[]
): Array<{ role: string; content: unknown }> {
  return messages.map((msg) => ({
    role:
      msg instanceof HumanMessage
        ? "human"
        : msg instanceof AIMessage
          ? "ai"
          : "system",
    content: msg.content,
  }));
}

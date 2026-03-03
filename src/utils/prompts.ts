import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";

export interface PromptMessage {
  role: "system" | "human" | "ai";
  content: string;
}

/**
 * Creates a ChatPromptTemplate and optionally applies a partial fill.
 * Use {variable_name} in content strings for interpolation.
 *
 * @example
 * const prompt = await buildPrompt(
 *   [
 *     { role: "system", content: "You are a {role} assistant." },
 *     { role: "human", content: "{input}" },
 *   ],
 *   { role: "game designer" }
 * );
 * const chain = prompt.pipe(llm);
 */
export async function buildPrompt(
  messages: PromptMessage[],
  partials: Record<string, string> = {}
): Promise<ChatPromptTemplate> {
  const templateMessages = messages.map((msg) => {
    if (msg.role === "system") {
      return SystemMessagePromptTemplate.fromTemplate(msg.content);
    }
    if (msg.role === "human") {
      return HumanMessagePromptTemplate.fromTemplate(msg.content);
    }
    return ["ai", msg.content] as [string, string];
  });

  const template = ChatPromptTemplate.fromMessages(templateMessages);

  if (Object.keys(partials).length > 0) {
    return template.partial(partials);
  }

  return template;
}

/**
 * Synchronous variant — no partial fill support.
 * Use buildPrompt() (async) when you need to bind partial variables upfront.
 */
export function buildPromptSync(messages: PromptMessage[]): ChatPromptTemplate {
  const templateMessages = messages.map((msg) => {
    if (msg.role === "system") {
      return SystemMessagePromptTemplate.fromTemplate(msg.content);
    }
    if (msg.role === "human") {
      return HumanMessagePromptTemplate.fromTemplate(msg.content);
    }
    return ["ai", msg.content] as [string, string];
  });

  return ChatPromptTemplate.fromMessages(templateMessages);
}

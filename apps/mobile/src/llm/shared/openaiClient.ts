/**
 * OpenAI API Client Implementation
 */

import type { LLMApiClient, LLMResponse, LLMAttachment } from "./types";

/**
 * OpenAI API client for chat completions with JSON mode
 */
export class OpenAIClient implements LLMApiClient {
    constructor(private apiKey: string) {}

    async call<T = unknown>(params: {
        prompt: string;
        model: string;
        attachments?: LLMAttachment[];
        userText?: string;
    }): Promise<LLMResponse<T>> {
        // Use role-based message structure for prompt injection protection
        const messages: Array<{
            role: string;
            content: string | Array<unknown>;
        }> = [
            {
                role: "system",
                content: params.prompt,
            },
        ];

        // Add user message only if there's user text or attachments
        if (params.userText || params.attachments) {
            const userContent = params.attachments
                ? [
                      ...(params.userText
                          ? [{ type: "text", text: params.userText }]
                          : []),
                      ...params.attachments.map((att) => ({
                          type: "image_url",
                          image_url: {
                              url: `data:${att.mimeType};base64,${
                                  typeof att.data === "string" ? att.data : ""
                              }`,
                          },
                      })),
                  ]
                : params.userText;

            messages.push({
                role: "user",
                content: userContent!,
            });
        }

        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: params.model,
                    messages,
                    response_format: { type: "json_object" },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `OpenAI API error (${response.status}): ${errorText}`
            );
        }

        const data = await response.json();
        const rawContent = data.choices[0].message.content;

        return {
            data: JSON.parse(rawContent) as T,
            raw: rawContent,
        };
    }
}

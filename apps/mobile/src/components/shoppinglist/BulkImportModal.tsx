import { IonText } from "@ionic/react";
import { useCallback } from "react";
import { validateBulkImportResult, type BulkImportResponse } from "../../llm/features/bulkImport";
import { BULK_IMPORT_PROMPT } from "../../llm/features/bulkImportPrompt";
import type { LLMResponse } from "../../llm/shared/types";
import { useLLMModal } from "../../llm/shared/useLLMModal";
import { useBulkImport } from "./useBulkImport";

/**
 * Hook to open bulk import modal
 * Handles the complete flow: modal display -> LLM parsing -> item import
 */
export function useBulkImportModal(storeId: string) {
    const { openModal } = useLLMModal();
    const { importItems } = useBulkImport(storeId);

    const openBulkImport = useCallback(() => {
        openModal({
            title: "Import Shopping List",
            prompt: BULK_IMPORT_PROMPT,
            model: "gpt-4o",
            userInstructions:
                "Paste your shopping list as text or upload a photo of a handwritten/printed list.",
            buttonText: "Scan List",
            shieldMessage: "Scanning list with AI...",
            validateResponse: (response: LLMResponse) => {
                if (!validateBulkImportResult(response.data)) {
                    throw new Error(
                        "Failed to parse shopping list. The response was not in the expected format."
                    );
                }
                return true;
            },
            renderOutput: (response: LLMResponse) => {
                const result = response.data as BulkImportResponse;
                const items = result.items;
                return (
                    <div>
                        <IonText>
                            <h4>Found {items.length} items:</h4>
                        </IonText>
                        <ul style={{ paddingLeft: "20px" }}>
                            {items.map((item, idx) => (
                                <li key={idx}>
                                    {item.quantity && item.unit
                                        ? `${item.quantity} ${item.unit} `
                                        : item.quantity
                                          ? `${item.quantity} `
                                          : ""}
                                    {item.name}
                                    {item.notes ? ` (${item.notes})` : ""}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            },
            onAccept: (response: LLMResponse) => {
                const result = response.data as BulkImportResponse;
                importItems(result.items);
            },
            onCancel: () => {
                // Nothing to do
            },
        });
    }, [openModal, importItems]);

    return { openBulkImport };
}

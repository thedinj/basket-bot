import { useCallback } from "react";
import { validateBulkImportResult, type BulkImportResponse } from "../../llm/features/bulkImport";
import { BULK_IMPORT_PROMPT } from "../../llm/features/bulkImportPrompt";
import { useLLMModal } from "../../llm/shared/useLLMModal";
import BulkImportItemList from "./BulkImportItemList";
import { useBulkImport } from "./useBulkImport";

/**
 * Hook to open bulk import modal
 * Handles the complete flow: modal display -> LLM parsing -> item import
 */
export function useBulkImportModal(storeId: string) {
    const { openModal } = useLLMModal();
    const { importItems } = useBulkImport(storeId);

    const openBulkImport = useCallback(() => {
        openModal<BulkImportResponse, Set<number>>({
            title: "Import Shopping List",
            prompt: BULK_IMPORT_PROMPT,
            model: "gpt-4o",
            userInstructions:
                "Paste your shopping list as text or upload a photo of a handwritten/printed list.",
            buttonText: "Scan List",
            shieldMessage: "Scanning list with AI...",
            validateResponse: (response) => {
                if (!validateBulkImportResult(response.data)) {
                    throw new Error(
                        "Failed to parse shopping list. The response was not in the expected format."
                    );
                }
                return true;
            },
            // All items start checked; uncheckedIds is the set of deselected indices
            initialState: () => new Set<number>(),
            renderOutput: (response, uncheckedIds, setUncheckedIds) => (
                <BulkImportItemList
                    items={response.data.items}
                    uncheckedIds={uncheckedIds}
                    onToggle={(id, _total, checked) => {
                        setUncheckedIds((prev) => {
                            const next = new Set(prev);
                            if (checked) {
                                next.delete(id);
                            } else {
                                next.add(id);
                            }
                            return next;
                        });
                    }}
                />
            ),
            onAccept: (response, uncheckedIds) => {
                const selectedItems = response.data.items.filter(
                    (_, idx) => !uncheckedIds.has(idx)
                );

                if (selectedItems.length === 0) {
                    return;
                }

                importItems(selectedItems);
            },
            onCancel: () => {
                // Nothing to do
            },
        });
    }, [openModal, importItems]);

    return { openBulkImport };
}

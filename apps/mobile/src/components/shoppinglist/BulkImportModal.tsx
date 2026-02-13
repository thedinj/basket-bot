import { useCallback, useRef, useState } from "react";
import { validateBulkImportResult, type BulkImportResponse } from "../../llm/features/bulkImport";
import { BULK_IMPORT_PROMPT } from "../../llm/features/bulkImportPrompt";
import type { LLMResponse } from "../../llm/shared/types";
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
    const [uncheckedIds, setUncheckedIds] = useState<Set<number>>(new Set());
    const uncheckedIdsRef = useRef<Set<number>>(new Set());

    const toggleItem = useCallback((id: number, _totalCount: number, newCheckedState: boolean) => {
        setUncheckedIds((prev) => {
            const next = new Set(prev);
            if (newCheckedState) {
                next.delete(id);
            } else {
                next.add(id);
            }
            uncheckedIdsRef.current = next;
            return next;
        });
    }, []);

    const openBulkImport = useCallback(() => {
        // Reset unchecked items when modal opens
        setUncheckedIds(new Set());
        uncheckedIdsRef.current = new Set();

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
                return (
                    <BulkImportItemList
                        items={result.items}
                        uncheckedIds={uncheckedIds}
                        onToggle={toggleItem}
                    />
                );
            },
            onAccept: (response: LLMResponse) => {
                const result = response.data as BulkImportResponse;

                // Filter out unchecked items (use ref to get current value)
                const selectedItems = result.items.filter(
                    (_, idx) => !uncheckedIdsRef.current.has(idx)
                );

                if (selectedItems.length === 0) {
                    // User unchecked all items, nothing to import
                    return;
                }

                importItems(selectedItems);
            },
            onCancel: () => {
                // Nothing to do
            },
        });
    }, [openModal, importItems, uncheckedIds, toggleItem]);

    return { openBulkImport };
}

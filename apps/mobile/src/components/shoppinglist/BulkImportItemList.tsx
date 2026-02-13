import { IonCheckbox, IonItem, IonLabel, IonList, IonText } from "@ionic/react";
import type React from "react";
import { useCallback } from "react";
import type { ParsedShoppingItem } from "../../llm/features/bulkImport";
import "./BulkImportItemList.scss";

interface BulkImportItemListProps {
    items: ParsedShoppingItem[];
    uncheckedIds: Set<number>;
    onToggle: (id: number, totalCount: number, newCheckedState: boolean) => void;
}

/**
 * Displays a list of bulk import items with checkboxes for selection
 * All items are checked by default. User can uncheck items they don't want to import.
 */
const BulkImportItemList: React.FC<BulkImportItemListProps> = ({
    items,
    uncheckedIds,
    onToggle,
}) => {
    const formatItemText = (item: ParsedShoppingItem): string => {
        let text = "";

        // Add quantity and unit if present
        if (item.quantity && item.unit) {
            text += `${item.quantity} ${item.unit} `;
        } else if (item.quantity) {
            text += `${item.quantity} `;
        }

        // Add item name
        text += item.name;

        // Add notes if present
        if (item.notes) {
            text += ` (${item.notes})`;
        }

        return text;
    };

    const handleToggle = useCallback(
        (event: CustomEvent) => {
            const idx = parseInt(event.detail.value, 10);
            const newCheckedState = event.detail.checked;
            onToggle(idx, items.length, newCheckedState);
        },
        [onToggle, items.length]
    );

    const isChecked = (idx: number) => !uncheckedIds.has(idx);

    return (
        <div className="bulk-import-item-list">
            <IonText>
                <h4>Found {items.length} items:</h4>
            </IonText>
            <IonList className="bulk-import-item-list__items">
                {items.map((item, idx) => (
                    <IonItem key={idx} className="bulk-import-item-list__item" button={false}>
                        <IonCheckbox
                            slot="start"
                            checked={isChecked(idx)}
                            value={idx.toString()}
                            onIonChange={handleToggle}
                        />
                        <IonLabel>{formatItemText(item)}</IonLabel>
                    </IonItem>
                ))}
            </IonList>
        </div>
    );
};

export default BulkImportItemList;

import type React from "react";
import clsx from "clsx";
import type { ParsedShoppingItem } from "../../llm/features/bulkImport";
import { formatQuantityWithUnit } from "../../utils/quantity";
import IncludeToggleButton from "../shared/IncludeToggleButton";
import TabEmptyState from "../shared/TabEmptyState";
import "./BulkImportItemList.scss";

interface BulkImportItemListProps {
    items: ParsedShoppingItem[];
    uncheckedIds: Set<number>;
    onToggle: (id: number, totalCount: number, newCheckedState: boolean) => void;
}

/**
 * The parsed list, for review before import. Every item starts on the list; the cart toggle
 * at the start of a row leaves that item off. Rows follow the ingredient-routing list: cart
 * glyph on the gutter, name with its amount in the shopping list's quantity style, and the
 * parser's notes as a quiet line underneath.
 */
const BulkImportItemList: React.FC<BulkImportItemListProps> = ({
    items,
    uncheckedIds,
    onToggle,
}) => {
    if (items.length === 0) {
        return (
            <TabEmptyState
                variant="inline"
                body="No items found. The list appears to be empty, or illegible."
            />
        );
    }

    const selectedCount = items.length - uncheckedIds.size;

    return (
        <section className="bulk-import">
            <h2 className="ruled-label">
                Items <span className="ruled-label__count">{items.length}</span>
            </h2>
            <p className="bulk-import__meta">
                {selectedCount} of {items.length} going on the list
            </p>
            <ul className="review-list">
                {items.map((item, idx) => {
                    const included = !uncheckedIds.has(idx);
                    const amount = formatQuantityWithUnit(item.quantity, item.unit);
                    return (
                        <li
                            key={idx}
                            className={clsx("review-row", !included && "review-row--off")}
                        >
                            <div className="review-row__toggles">
                                <IncludeToggleButton
                                    included={included}
                                    onClick={() => onToggle(idx, items.length, !included)}
                                    label={item.name}
                                />
                            </div>
                            <p className="review-row__text">
                                <span className="review-row__name">{item.name}</span>
                                {amount && <span className="qty">{amount}</span>}
                                {item.notes && (
                                    <span className="review-row__note">{item.notes}</span>
                                )}
                            </p>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

export default BulkImportItemList;

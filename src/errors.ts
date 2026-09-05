/** Error thrown when a collection operation requires an item but none exists. */
export class CollectionItemNotFoundError extends Error {
    public constructor(message: string = "Collection item was not found.") {
        super(message)
        this.name = "CollectionItemNotFoundError"
    }
}

/** Error thrown when `sole()` resolves more than one matching collection item. */
export class CollectionMultipleItemsError extends Error {
    public constructor(message: string = "Collection contains more than one matching item.") {
        super(message)
        this.name = "CollectionMultipleItemsError"
    }
}

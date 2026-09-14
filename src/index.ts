export { Collection } from "./collection.js"

export {
    CollectionItemNotFoundError,
    CollectionMultipleItemsError,
} from "./errors.js"

export type {
    AtomicValue,
    CollectionPath,
    CollectionPathValue,
    FlattenValue,
} from "./types.js"

export {
    createCollection,
    type CollectionDefinition,
    type CollectionDefinitionKey,
    type CollectionItem,
    type CollectionItems,
    type DefinedCollection,
} from "./create-collection.js"

export { collect } from "./collect.js"

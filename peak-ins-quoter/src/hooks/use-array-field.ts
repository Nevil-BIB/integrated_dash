'use client'

import { useState, useCallback, useMemo } from 'react'

/**
 * Base interface for array field items - all items must have a unique id
 */
export interface ArrayFieldItem {
  id: string
  [key: string]: unknown
}

/**
 * Options for configuring the useArrayField hook
 */
export interface UseArrayFieldOptions<T extends ArrayFieldItem> {
  /** Initial items to populate the array */
  initialItems?: T[]
  /** Maximum number of items allowed */
  maxItems?: number
  /** Minimum number of items required */
  minItems?: number
  /** Factory function to create a new default item */
  createDefaultItem: () => T
  /** Callback fired when items change */
  onItemsChange?: (items: T[]) => void
  /** Callback fired before an item is removed (return false to prevent) */
  onBeforeRemove?: (item: T, items: T[]) => boolean | Promise<boolean>
}

/**
 * Return type for the useArrayField hook
 */
export interface UseArrayFieldReturn<T extends ArrayFieldItem> {
  /** Current array of items */
  items: T[]
  /** Add a new item using the default factory */
  addItem: () => void
  /** Add a specific item to the array */
  addItemWithData: (item: T) => void
  /** Remove an item by its id */
  removeItem: (id: string) => Promise<boolean>
  /** Update multiple fields on an item */
  updateItem: (id: string, updates: Partial<T>) => void
  /** Update a single field on an item */
  updateItemField: (id: string, field: keyof T, value: T[keyof T]) => void
  /** Move an item from one index to another */
  moveItem: (fromIndex: number, toIndex: number) => void
  /** Duplicate an existing item with a new id */
  duplicateItem: (id: string) => void
  /** Clear all items (respects minItems by adding default items) */
  clearAll: () => void
  /** Replace all items at once */
  setItems: (items: T[]) => void
  /** Get an item by its id */
  getItem: (id: string) => T | undefined
  /** Get an item's index by its id */
  getItemIndex: (id: string) => number
  /** Whether a new item can be added */
  canAdd: boolean
  /** Whether an item can be removed */
  canRemove: boolean
  /** Whether the current count meets the minimum requirement */
  meetsMinimum: boolean
  /** Current item count */
  count: number
  /** Check if the array is empty */
  isEmpty: boolean
}

/**
 * Generate a unique id for array field items
 */
export function generateArrayFieldId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Hook for managing dynamic array fields in forms
 *
 * @example
 * ```tsx
 * const { items, addItem, removeItem, updateItem } = useArrayField({
 *   initialItems: [],
 *   maxItems: 6,
 *   minItems: 1,
 *   createDefaultItem: () => ({
 *     id: generateArrayFieldId(),
 *     name: '',
 *     dob: '',
 *   }),
 *   onItemsChange: (items) => console.log('Items changed:', items),
 * })
 * ```
 */
export function useArrayField<T extends ArrayFieldItem>(
  options: UseArrayFieldOptions<T>
): UseArrayFieldReturn<T> {
  const {
    initialItems = [],
    maxItems = Infinity,
    minItems = 0,
    createDefaultItem,
    onItemsChange,
    onBeforeRemove,
  } = options

  // Initialize with minItems if initial is empty and minItems > 0
  const getInitialState = (): T[] => {
    if (initialItems.length >= minItems) {
      return initialItems
    }
    const items = [...initialItems]
    while (items.length < minItems) {
      items.push(createDefaultItem())
    }
    return items
  }

  const [items, setItemsInternal] = useState<T[]>(getInitialState)

  // Wrapper to notify on changes
  const setItems = useCallback((newItems: T[]) => {
    setItemsInternal(newItems)
    onItemsChange?.(newItems)
  }, [onItemsChange])

  const addItem = useCallback(() => {
    if (items.length >= maxItems) return
    const newItem = createDefaultItem()
    setItems([...items, newItem])
  }, [items, maxItems, createDefaultItem, setItems])

  const addItemWithData = useCallback((item: T) => {
    if (items.length >= maxItems) return
    setItems([...items, item])
  }, [items, maxItems, setItems])

  const removeItem = useCallback(async (id: string): Promise<boolean> => {
    const itemToRemove = items.find(item => item.id === id)
    if (!itemToRemove) return false

    // Check minimum constraint
    if (items.length <= minItems) return false

    // Check with onBeforeRemove callback
    if (onBeforeRemove) {
      const canRemove = await onBeforeRemove(itemToRemove, items)
      if (!canRemove) return false
    }

    setItems(items.filter(item => item.id !== id))
    return true
  }, [items, minItems, onBeforeRemove, setItems])

  const updateItem = useCallback((id: string, updates: Partial<T>) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))
  }, [items, setItems])

  const updateItemField = useCallback((id: string, field: keyof T, value: T[keyof T]) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }, [items, setItems])

  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    if (
      fromIndex < 0 ||
      fromIndex >= items.length ||
      toIndex < 0 ||
      toIndex >= items.length ||
      fromIndex === toIndex
    ) {
      return
    }

    const newItems = [...items]
    const [movedItem] = newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, movedItem)
    setItems(newItems)
  }, [items, setItems])

  const duplicateItem = useCallback((id: string) => {
    if (items.length >= maxItems) return

    const itemToDuplicate = items.find(item => item.id === id)
    if (!itemToDuplicate) return

    const duplicatedItem: T = {
      ...itemToDuplicate,
      id: generateArrayFieldId(),
    }

    const index = items.findIndex(item => item.id === id)
    const newItems = [...items]
    newItems.splice(index + 1, 0, duplicatedItem)
    setItems(newItems)
  }, [items, maxItems, setItems])

  const clearAll = useCallback(() => {
    if (minItems > 0) {
      const newItems: T[] = []
      for (let i = 0; i < minItems; i++) {
        newItems.push(createDefaultItem())
      }
      setItems(newItems)
    } else {
      setItems([])
    }
  }, [minItems, createDefaultItem, setItems])

  const setItemsExternal = useCallback((newItems: T[]) => {
    // Ensure we meet minimum requirements
    let finalItems = [...newItems]
    while (finalItems.length < minItems) {
      finalItems.push(createDefaultItem())
    }
    // Respect maximum
    if (finalItems.length > maxItems) {
      finalItems = finalItems.slice(0, maxItems)
    }
    setItems(finalItems)
  }, [minItems, maxItems, createDefaultItem, setItems])

  const getItem = useCallback((id: string): T | undefined => {
    return items.find(item => item.id === id)
  }, [items])

  const getItemIndex = useCallback((id: string): number => {
    return items.findIndex(item => item.id === id)
  }, [items])

  const canAdd = useMemo(() => items.length < maxItems, [items.length, maxItems])
  const canRemove = useMemo(() => items.length > minItems, [items.length, minItems])
  const meetsMinimum = useMemo(() => items.length >= minItems, [items.length, minItems])
  const count = items.length
  const isEmpty = items.length === 0

  return {
    items,
    addItem,
    addItemWithData,
    removeItem,
    updateItem,
    updateItemField,
    moveItem,
    duplicateItem,
    clearAll,
    setItems: setItemsExternal,
    getItem,
    getItemIndex,
    canAdd,
    canRemove,
    meetsMinimum,
    count,
    isEmpty,
  }
}

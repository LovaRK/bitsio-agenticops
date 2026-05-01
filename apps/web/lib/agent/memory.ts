export interface MemoryEntry {
  id: string;
  timestamp: string;
  category: string;
  note: string;
}

export const appendMemory = (items: MemoryEntry[], entry: MemoryEntry): MemoryEntry[] => [entry, ...items];

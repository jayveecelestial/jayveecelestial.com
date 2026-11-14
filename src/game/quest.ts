/** Visitor quest: open these stations to finish it. Order is the tracker order. */
export const QUEST = ["work", "certs", "contact"] as const;

export type QuestId = (typeof QUEST)[number];

/** Announcement per task, e.g. "Quest 2 of 3: Trophies checked". */
export const QUEST_TEXT: Record<QuestId, string> = {
  work: "Work read",
  certs: "Trophies checked",
  contact: "Mailbox checked",
};

export const isQuestId = (id: string): id is QuestId => (QUEST as readonly string[]).includes(id);

/** Idempotent; ids outside the quest are ignored. Returns the same array when nothing changes. */
export const markDone = (done: readonly QuestId[], id: string): readonly QuestId[] =>
  isQuestId(id) && !done.includes(id) ? [...done, id] : done;

export const isComplete = (done: readonly QuestId[]): boolean => QUEST.every((id) => done.includes(id));

/** Stored value is a JSON array of ids; anything else (junk, wrong types, unknown ids, duplicates) is dropped. */
export function parseStored(raw: string | null): readonly QuestId[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return QUEST.filter((id) => v.includes(id));
  } catch {
    return [];
  }
}

/** Show the completion banner once: complete and not shown before (survives a reload before the panel closed). */
export const shouldShowBanner = (done: readonly QuestId[], seen: boolean): boolean => isComplete(done) && !seen;

export const announcement = (done: readonly QuestId[], id: QuestId): string =>
  isComplete(done) ? "Quest complete" : `Quest ${done.length} of ${QUEST.length}: ${QUEST_TEXT[id]}`;

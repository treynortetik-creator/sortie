import { FIELDS, type ContactField, type Rating } from './contact';
import { mergeContacts } from './dedupe';
import { blankLead, newId, queuedStep, idleStep, type EventRecord, type LeadRecord, type SortieDB } from './db';

export async function createEvent(db: SortieDB, name: string, now = Date.now()): Promise<EventRecord> {
  const ev: EventRecord = { id: newId(), name: name.trim() || 'Untitled event', createdAt: now };
  await db.events.add(ev);
  return ev;
}

export async function renameEvent(db: SortieDB, id: string, name: string): Promise<void> {
  await db.events.update(id, { name: name.trim() || 'Untitled event' });
}

export async function deleteEvent(db: SortieDB, id: string): Promise<void> {
  await db.transaction('rw', db.events, db.leads, async () => {
    await db.leads.where('eventId').equals(id).delete();
    await db.events.delete(id);
  });
}

/** Save a new capture instantly; extraction runs later through the queue (now, or whenever there is signal). */
export async function createLeadFromPhoto(db: SortieDB, eventId: string, image: Blob, now = Date.now()): Promise<LeadRecord> {
  const lead = { ...blankLead(eventId, now), image, extract: queuedStep() };
  await db.leads.add(lead);
  return lead;
}

export async function attachVoiceNote(
  db: SortieDB,
  id: string,
  audio: Blob,
  mime: string,
  seconds: number,
): Promise<void> {
  await db.leads.update(id, { audio, audioMime: mime, audioSeconds: seconds, voice: queuedStep(), updatedAt: Date.now() });
}

export async function removeVoiceNote(db: SortieDB, id: string): Promise<void> {
  await db.leads.update(id, { audio: undefined, audioMime: undefined, audioSeconds: undefined, voice: idleStep(), updatedAt: Date.now() });
}

/** Rep edit. Marks the field as hand-edited so a late extraction result cannot overwrite it. */
export async function editField(db: SortieDB, id: string, field: ContactField | 'transcript', value: string): Promise<void> {
  await db.transaction('rw', db.leads, async () => {
    const lead = await db.leads.get(id);
    if (!lead) return;
    const touched = lead.touched.includes(field) ? lead.touched : [...lead.touched, field];
    await db.leads.update(id, { [field]: value, touched, updatedAt: Date.now() } as Partial<LeadRecord>);
  });
}

export async function setRating(db: SortieDB, id: string, rating: Rating): Promise<void> {
  await db.leads.update(id, { rating, updatedAt: Date.now() });
}

export async function deleteLeads(db: SortieDB, ids: string[]): Promise<void> {
  await db.leads.bulkDelete(ids);
}

export async function markNotDuplicate(db: SortieDB, ids: string[]): Promise<void> {
  await db.transaction('rw', db.leads, async () => {
    for (const id of ids) {
      const l = await db.leads.get(id);
      if (!l) continue;
      const set = new Set([...l.notDuplicateOf, ...ids.filter((x) => x !== id)]);
      await db.leads.update(id, { notDuplicateOf: [...set] });
    }
  });
}

/** Merge a duplicate group into its oldest lead and delete the rest. Returns the surviving id. */
export async function mergeLeadGroup(db: SortieDB, ids: string[]): Promise<string | null> {
  return db.transaction('rw', db.leads, async () => {
    const leads = (await db.leads.bulkGet(ids)).filter((l): l is LeadRecord => !!l);
    if (leads.length < 2) return leads[0]?.id ?? null;
    const { primary, merged, transcript, absorbed } = mergeContacts(leads);
    const rest = leads.filter((l) => l.id !== primary.id);
    const rating = primary.rating || rest.find((r) => r.rating)?.rating || '';
    const patch: Partial<LeadRecord> = { ...merged, transcript, rating, updatedAt: Date.now() };
    // Keep a voice note if the primary lacks one.
    const donor = rest.find((r) => r.audio);
    if (!primary.audio && donor) Object.assign(patch, { audio: donor.audio, audioMime: donor.audioMime, audioSeconds: donor.audioSeconds, voice: donor.voice });
    if (!primary.image) Object.assign(patch, { image: rest.find((r) => r.image)?.image });
    patch.costUsd = leads.reduce((sum, l) => sum + l.costUsd, 0);
    patch.costs = leads.flatMap((l) => l.costs);
    patch.touched = [...new Set(leads.flatMap((l) => l.touched))];
    await db.leads.update(primary.id, patch);
    await db.leads.bulkDelete(absorbed);
    return primary.id;
  });
}

export function leadHasContact(l: Pick<LeadRecord, ContactField>): boolean {
  return FIELDS.some((f) => f !== 'notes' && l[f].trim() !== '');
}

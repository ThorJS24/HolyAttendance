import { eq } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { yellowForms } from '../../../src/db/schema'

export type YellowForm = typeof yellowForms.$inferSelect
export type NewYellowForm = Omit<typeof yellowForms.$inferInsert, 'id' | 'createdAt' | 'status'>
export type YellowFormUpdate = Partial<Omit<typeof yellowForms.$inferInsert, 'id' | 'createdAt'>>

export function listYellowForms(db: AppDatabase, opts: { subjectId?: number } = {}): YellowForm[] {
  const query = db.select().from(yellowForms)
  if (opts.subjectId !== undefined) return query.where(eq(yellowForms.subjectId, opts.subjectId)).all()
  return query.all()
}

export function createYellowForm(db: AppDatabase, input: NewYellowForm): YellowForm {
  return db.insert(yellowForms).values({ ...input, status: 'pending' }).returning().get()
}

export function updateYellowForm(db: AppDatabase, id: number, input: YellowFormUpdate): YellowForm {
  return db.update(yellowForms).set(input).where(eq(yellowForms.id, id)).returning().get()
}

export function setYellowFormStatus(
  db: AppDatabase,
  id: number,
  status: YellowForm['status'],
): YellowForm {
  return db.update(yellowForms).set({ status }).where(eq(yellowForms.id, id)).returning().get()
}

export function deleteYellowForm(db: AppDatabase, id: number): void {
  db.delete(yellowForms).where(eq(yellowForms.id, id)).run()
}

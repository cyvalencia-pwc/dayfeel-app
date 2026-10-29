import { Router } from 'express';
import { validate } from '../../middleware/http';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';
import {
  journalSchema,
  journalPutSchema,
  deleteSchema,
  idSchema,
  listSchema,
  moodSchema,
  summarySchema,
  calendarSchema,
} from './journal.schema';
export function journalRoutes(service: JournalService) {
  const r = Router(),
    c = new JournalController(service);
  r.post('/journal', validate(journalSchema), c.create);
  r.get('/journal', validate(listSchema, 'query'), c.list);
  r.put('/journal', validate(journalPutSchema), c.update);
  r.delete('/journal', validate(deleteSchema), c.remove);
  r.get('/journal/:id', validate(idSchema, 'params'), c.get);
  r.put(
    '/journal/:id',
    validate(idSchema, 'params'),
    validate(journalSchema),
    c.update,
  );
  r.delete('/journal/:id', validate(idSchema, 'params'), c.remove);
  r.put('/mood/today', validate(moodSchema), c.mood);
  r.get('/mood/summary', validate(summarySchema, 'query'), c.summary);
  r.get('/mood/calendar', validate(calendarSchema, 'query'), c.calendar);
  return r;
}

import request from 'supertest';
import { database, fixture } from './helpers';
import { FileMetadata } from '../src/modules/files/files.model';
database();
test('retired upload route is absent; existing private files remain owner-scoped', async () => {
  const f = fixture();
  await request(f.app).post('/files/upload-url').send({}).expect(404);
  await FileMetadata.create({ userId: 'user-1', objectKey: 'users/user-1/journal/existing.png', purpose: 'journal', contentType: 'image/png', size: 1024 });
  await request(f.app).get('/files/download-url').query({ objectKey: 'users/user-1/journal/existing.png' }).expect(200);
  await request(f.app).get('/files/download-url').query({ objectKey: 'users/user-1/journal/existing.png' }).set('X-Test-User', 'other').expect(404);
  f.storage.head.mockResolvedValue({ contentType: 'text/html', size: 1024 });
  await expect(f.files.download('user-1', 'users/user-1/journal/existing.png')).rejects.toMatchObject({status: 409});
});

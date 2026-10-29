import { randomUUID } from 'crypto';
import { database, fixture } from './helpers';
import { Reaction } from '../src/modules/community/community.model';
database();
test('reactions can be replaced and removed without deleting another member reaction', async () => {
 const f=fixture();
 const post=await f.community.create('user-1',randomUUID(),'Hello','token');
 const id=post.content.id;
 await f.community.react('user-1',id,'hug');
 await f.community.react('user-2',id,'hug');
 await f.community.react('user-1',id,'support');
 expect((await f.community.reactions('user-1',id)).counts).toEqual({hug:1,support:1});
 expect(await f.community.react('user-1',id,null)).toEqual({reaction:null,counts:{hug:1}});
 await f.community.react('user-1',id,null);
 expect((await f.community.reactions('user-1',id)).reaction).toBeNull();
 expect(await Reaction.countDocuments({targetId:id})).toBe(1);
});

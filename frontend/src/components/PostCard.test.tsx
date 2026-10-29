import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { ReactionBar } from './PostCard';
import { postsApi } from '../api/posts';
vi.mock('../api/posts',()=>({postsApi:{reactions:vi.fn(),react:vi.fn()}}));
test('clicking the selected reaction removes it and updates the count',async()=>{
 vi.mocked(postsApi.reactions).mockResolvedValue({reaction:'hug',counts:{hug:1}});
 vi.mocked(postsApi.react).mockImplementation(async()=>{
  const result={reaction:null,counts:{hug:0}};
  vi.mocked(postsApi.reactions).mockResolvedValue(result);
  return result;
 });
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ReactionBar postId="post-1"/></QueryClientProvider>);
 const button=await screen.findByRole('button',{name:/Hug/});
 await waitFor(()=>expect(button).toHaveAttribute('aria-pressed','true'));
 await userEvent.click(button);
 await waitFor(()=>expect(postsApi.react).toHaveBeenCalledWith('post-1',null));
 await waitFor(()=>expect(button).toHaveAttribute('aria-pressed','false'));
 expect(button).toHaveTextContent('0');
});

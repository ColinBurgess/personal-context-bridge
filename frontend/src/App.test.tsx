import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import App from './App';

describe('App', () => {
  const memoryItem = {
    id: 'mem_1',
    metadata: {
      timestamp: '2026-04-01T00:00:00Z',
      model_used: 'gpt-5.3-codex',
      topic_tags: ['Testing'],
      priority: 'High'
    },
    summary: 'Stored memory summary',
    key_entities: {
      concepts: ['Vector'],
      tools: ['vitest'],
      decisions: ['Keep tests'],
      pending_actions: ['Run test suite']
    },
    context_reference: 'Default Context'
  };

  const installFetchMock = (overrides?: {
    initialGetAll?: unknown[];
    postSaveGetAllError?: boolean;
    deleteStatus?: number;
  }) => {
    const initialGetAll = overrides?.initialGetAll ?? [];
    const postSaveGetAllError = overrides?.postSaveGetAllError ?? false;
    const deleteStatus = overrides?.deleteStatus ?? 200;
    let getAllCalls = 0;

    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method || 'GET';

      if (url.includes('/get_all_memories')) {
        getAllCalls += 1;
        if (postSaveGetAllError && getAllCalls > 1) {
          throw new TypeError('fetch failed');
        }
        return new Response(JSON.stringify(initialGetAll), {status: 200});
      }

      if (url.includes('/save_memory') && method === 'POST') {
        return new Response(JSON.stringify({status: 'success', id: 'mem_1'}), {status: 200});
      }

      if (url.includes('/delete_memory/') && method === 'DELETE') {
        if (deleteStatus >= 400) {
          return new Response(JSON.stringify({detail: 'missing'}), {status: deleteStatus});
        }
        return new Response(JSON.stringify({status: 'success'}), {status: 200});
      }

      return new Response(JSON.stringify({detail: 'not mocked'}), {status: 404});
    });
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    installFetchMock();
  });

  const validMemoryJson = JSON.stringify({
    metadata: {
      timestamp: '2026-04-01T00:00:00Z',
      model_used: 'gpt-5.3-codex',
      topic_tags: ['Testing', 'UX'],
      priority: 'High'
    },
    summary: 'Test memory payload',
    key_entities: {
      concepts: ['Placeholder'],
      tools: ['vitest'],
      decisions: ['Treat default text as placeholder only'],
      pending_actions: ['Save user-provided JSON']
    },
    context_reference: 'Frontend Test'
  }, null, 2);

  test('renders terminal interface with default controls', () => {
    render(<App />);

    expect(screen.getByText(/PCB_BRIDGE/i)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Commit_Memory/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Database/i})).toBeInTheDocument();
  });

  test('shows success message when saving valid json', async () => {
    const user = userEvent.setup();
    render(<App />);

    const textarea = screen.getByRole('textbox');
    await user.click(textarea);
    await user.paste(validMemoryJson);

    await user.click(screen.getByRole('button', {name: /Commit_Memory/i}));

    expect(await screen.findByText(/Memory saved to local filesystem database./i)).toBeInTheDocument();
  });

  test('shows save success even if post-save refresh fails', async () => {
    vi.restoreAllMocks();
    installFetchMock({postSaveGetAllError: true});

    const user = userEvent.setup();
    render(<App />);

    const textarea = screen.getByRole('textbox');
    await user.click(textarea);
    await user.paste(validMemoryJson);
    await user.click(screen.getByRole('button', {name: /Commit_Memory/i}));

    expect(await screen.findByText(/Memory saved successfully/i)).toBeInTheDocument();
  });

  test('disables save button when input is empty', () => {
    render(<App />);

    expect(screen.getByRole('button', {name: /Commit_Memory/i})).toBeDisabled();
  });

  test('enables save button after user writes json', async () => {
    const user = userEvent.setup();
    render(<App />);

    const saveButton = screen.getByRole('button', {name: /Commit_Memory/i});
    const textarea = screen.getByRole('textbox');

    expect(saveButton).toBeDisabled();

    await user.click(textarea);
    await user.paste(validMemoryJson);

    expect(saveButton).toBeEnabled();
  });

  test('switches to database tab', async () => {
    const user = userEvent.setup();
    const {container} = render(<App />);

    await user.click(screen.getByRole('button', {name: /^Database$/i}));

    await waitFor(() => {
      expect(container.querySelector('input[placeholder*="SEARCH_DATABASE"]')).not.toBeNull();
    });
  });

  test('encodes memory id when deleting records', async () => {
    vi.restoreAllMocks();
    const fetchMock = installFetchMock({
      initialGetAll: [{
        ...memoryItem,
        id: 'mem/with/slash',
      }],
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', {name: /^Database$/i}));

    const deleteButton = await screen.findByTitle(/Purge_Record/i);
    await user.click(deleteButton);
    await user.click(screen.getByRole('button', {name: /^Delete$/i}));

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/delete_memory/'));
      expect(deleteCall).toBeDefined();
      expect(String(deleteCall?.[0])).toContain('/delete_memory/mem%2Fwith%2Fslash');
    });
  });

  test('renders legacy memory context from metadata without breaking database view', async () => {
    vi.restoreAllMocks();
    installFetchMock({
      initialGetAll: [{
        id: 'legacy_1',
        summary: 'Legacy memory summary',
        metadata: {
          timestamp: '2026-04-01T00:00:00Z',
          model_used: 'legacy-model',
          topic_tags: '["legacy"]',
          priority: 'Low',
          context_reference: 'Legacy Metadata Context',
          key_entities: {
            concepts: ['legacy concept'],
            tools: ['legacy tool'],
            decisions: ['legacy decision'],
            pending_actions: ['legacy action']
          }
        }
      }],
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', {name: /^Database$/i}));
    await user.click(await screen.findByText(/Legacy memory summary/i));

    expect(await screen.findByText(/Legacy Metadata Context/i)).toBeInTheDocument();
  });

  test('shows backend delete detail in database status area', async () => {
    vi.restoreAllMocks();
    installFetchMock({
      initialGetAll: [memoryItem],
      deleteStatus: 404,
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', {name: /^Database$/i}));
    const deleteButton = await screen.findByTitle(/Purge_Record/i);
    await user.click(deleteButton);
    await user.click(screen.getByRole('button', {name: /^Delete$/i}));

    expect(await screen.findByText(/missing/i)).toBeInTheDocument();
  });
});

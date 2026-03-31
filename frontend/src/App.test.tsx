import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
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

    expect(await screen.findByText(/Memory saved to browser local storage!/i)).toBeInTheDocument();
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
});

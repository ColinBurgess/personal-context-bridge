import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  test('renders terminal interface with default controls', () => {
    render(<App />);

    expect(screen.getByText(/PCB_BRIDGE/i)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Commit_Memory/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Database/i})).toBeInTheDocument();
  });

  test('shows success message when saving valid json', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', {name: /Commit_Memory/i}));

    expect(await screen.findByText(/Memory saved to browser local storage!/i)).toBeInTheDocument();
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

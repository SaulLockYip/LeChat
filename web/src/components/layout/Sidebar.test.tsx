import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@/testutils/test_wrapper';
import userEvent from '@testing-library/user-event';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  const defaultProps = {
    serverName: 'Test Server',
    serverStatus: 'connected' as const,
    agents: [
      { id: 'agent-1', name: 'Alice', status: 'online' as const, unread: 2 },
      { id: 'agent-2', name: 'Bob', status: 'busy' as const },
      { id: 'agent-3', name: 'Charlie', status: 'offline' as const },
    ],
    channels: [
      { id: 'channel-1', name: 'general', unread: 5 },
      { id: 'channel-2', name: 'random' },
    ],
    currentUser: 'TestUser',
    onAgentSelect: vi.fn(),
    onChannelSelect: vi.fn(),
    selectedId: undefined as string | undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render server name and status', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('Test Server')).toBeInTheDocument();
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('should render agents in Direct Messages section', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('Direct Messages')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('should render channels section', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('general')).toBeInTheDocument();
    expect(screen.getByText('random')).toBeInTheDocument();
  });

  it('should render current user in user panel', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('TestUser')).toBeInTheDocument();
  });

  it('should display unread badges for agents', () => {
    render(<Sidebar {...defaultProps} />);

    // Get all listitems and find Alice's row
    const listitems = screen.getAllByRole('listitem');
    const aliceItem = listitems.find(item => item.textContent?.includes('Alice'));
    expect(aliceItem).toBeDefined();

    const badge = aliceItem?.querySelector('span.bg-\\[\\#ff4757\\]');
    expect(badge).toHaveTextContent('2');
  });

  it('should display unread badges for channels', () => {
    render(<Sidebar {...defaultProps} />);

    const listitems = screen.getAllByRole('listitem');
    const generalItem = listitems.find(item => item.textContent?.includes('general'));
    expect(generalItem).toBeDefined();

    const badge = generalItem?.querySelector('span.bg-\\[\\#ff4757\\]');
    expect(badge).toHaveTextContent('5');
  });

  it('should call onAgentSelect when agent is clicked', async () => {
    const { user } = render(<Sidebar {...defaultProps} />);

    const listitems = screen.getAllByRole('listitem');
    const aliceItem = listitems.find(item => item.textContent?.includes('Alice'));
    await user.click(aliceItem!);

    expect(defaultProps.onAgentSelect).toHaveBeenCalledWith('agent-1');
  });

  it('should call onChannelSelect when channel is clicked', async () => {
    const { user } = render(<Sidebar {...defaultProps} />);

    const listitems = screen.getAllByRole('listitem');
    const generalItem = listitems.find(item => item.textContent?.includes('general'));
    await user.click(generalItem!);

    expect(defaultProps.onChannelSelect).toHaveBeenCalledWith('channel-1');
  });

  it('should apply selected styles when agent is selected', () => {
    render(<Sidebar {...defaultProps} selectedId="agent-1" />);

    const listitems = screen.getAllByRole('listitem');
    const aliceItem = listitems.find(item => item.textContent?.includes('Alice'));
    expect(aliceItem?.className).toMatch(/shadow-/);
  });

  it('should apply selected styles when channel is selected', () => {
    render(<Sidebar {...defaultProps} selectedId="channel-1" />);

    const listitems = screen.getAllByRole('listitem');
    const generalItem = listitems.find(item => item.textContent?.includes('general'));
    expect(generalItem?.className).toMatch(/shadow-/);
  });

  it('should render with default props', () => {
    render(<Sidebar />);

    expect(screen.getByText('LeChat Server')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
  });

  it('should render empty lists when no agents or channels provided', () => {
    render(
      <Sidebar
        serverName="Empty Server"
        agents={[]}
        channels={[]}
        currentUser="EmptyUser"
      />
    );

    expect(screen.getByText('Direct Messages')).toBeInTheDocument();
    expect(screen.getByText('Channels')).toBeInTheDocument();
  });

  it('should show connecting status with pulse', () => {
    render(<Sidebar {...defaultProps} serverStatus="connecting" />);

    const statusText = screen.getByText('connecting');
    // Go up to the flex container, then to the first child (LEDIndicator)
    const flexContainer = statusText.parentElement?.parentElement;
    const ledIndicator = flexContainer?.firstChild;
    expect(ledIndicator).toHaveClass('animate-pulse');
  });

  it('should show disconnected status', () => {
    render(<Sidebar {...defaultProps} serverStatus="disconnected" />);

    expect(screen.getByText('disconnected')).toBeInTheDocument();
  });
});

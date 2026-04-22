'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { LEDIndicator } from './LEDIndicator';
import { DeleteConversationModal } from './DeleteConversationModal';
import { useToast } from './Toast';

interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
}

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  groupName: string;
  currentAgentIds: string[];
  availableAgents: Agent[];
  onUpdate: (data: { group_name?: string; add_agent_ids?: string[]; remove_agent_ids?: string[] }) => Promise<void>;
  onDeleteConversation?: (conversationId: string, conversationTitle: string) => void;
}

export function GroupSettingsModal({
  isOpen,
  onClose,
  conversationId,
  groupName: initialGroupName,
  currentAgentIds,
  availableAgents,
  onUpdate,
  onDeleteConversation,
}: GroupSettingsModalProps) {
  const [groupName, setGroupName] = useState(initialGroupName);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(currentAgentIds);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { addToast } = useToast();

  // Sync state when props change
  useEffect(() => {
    setGroupName(initialGroupName);
    setSelectedAgentIds(currentAgentIds);
  }, [initialGroupName, currentAgentIds, isOpen]);

  const handleAddAgent = useCallback((agentId: string) => {
    if (!selectedAgentIds.includes(agentId)) {
      setSelectedAgentIds(prev => [...prev, agentId]);
    }
  }, [selectedAgentIds]);

  const handleRemoveAgent = useCallback((agentId: string) => {
    setSelectedAgentIds(prev => prev.filter(id => id !== agentId));
  }, []);

  const handleSave = useCallback(async () => {
    setIsLoading(true);

    const add_agent_ids = selectedAgentIds.filter(id => !currentAgentIds.includes(id));
    const remove_agent_ids = currentAgentIds.filter(id => !selectedAgentIds.includes(id));

    try {
      await onUpdate({
        group_name: groupName !== initialGroupName ? groupName : undefined,
        add_agent_ids: add_agent_ids.length > 0 ? add_agent_ids : undefined,
        remove_agent_ids: remove_agent_ids.length > 0 ? remove_agent_ids : undefined,
      });
      addToast({ message: 'Group settings updated', type: 'success' });
      onClose();
    } catch (error) {
      addToast({ message: 'Failed to update group settings', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [groupName, initialGroupName, selectedAgentIds, currentAgentIds, onUpdate, onClose, addToast]);

  const handleDeleteClick = useCallback(() => {
    if (!onDeleteConversation) return;
    setShowDeleteModal(true);
  }, [onDeleteConversation]);

  const handleConfirmDelete = useCallback(async () => {
    if (!onDeleteConversation) return;
    setShowDeleteModal(false);
    // Call the parent's delete handler which will do the actual deletion
    onDeleteConversation(conversationId, groupName);
  }, [onDeleteConversation, conversationId, groupName]);

  // Get agents that are not yet in the group
  const availableToAdd = availableAgents.filter(agent => !selectedAgentIds.includes(agent.id));

  // Get agents currently in the group with their status
  const currentAgents = availableAgents.filter(agent => selectedAgentIds.includes(agent.id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="
          relative w-full max-w-md mx-4
          bg-[#e8ebf0] rounded-3xl
          shadow-[-12px_-12px_24px_rgba(255,255,255,0.8),12px_12px_24px_rgba(0,0,0,0.2)]
          overflow-hidden
          max-h-[90vh] overflow-y-auto
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-settings-title"
      >
        {/* Decorative top bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#ff4757] via-[#ff6b7a] to-[#ff4757]" />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            {/* Settings icon */}
            <div className="
              w-12 h-12 rounded-xl
              bg-[#e0e5ec]
              shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_8px_rgba(0,0,0,0.15)_inset]
              flex items-center justify-center
            ">
              <svg
                className="w-6 h-6 text-[#ff4757]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <h2
                id="group-settings-title"
                className="text-xl font-bold text-[#374151]"
              >
                Group Settings
              </h2>
              <p className="text-sm text-[#8b9298]">
                Manage your group conversation
              </p>
            </div>
          </div>

          {/* Group Name Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#5a6270] uppercase tracking-wider mb-3">
              Group Name
            </h3>
            <Input
              type="text"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Current Agents Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#5a6270] uppercase tracking-wider mb-3">
              Members ({currentAgents.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {currentAgents.length === 0 ? (
                <p className="text-sm text-[#8b9298] py-2">No agents in this group</p>
              ) : (
                currentAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="
                      flex items-center gap-3 p-3 rounded-xl
                      bg-[#e0e5ec]
                      shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.08)]
                    "
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-[#f0f2f5] shadow-[-2px_-2px 4px_rgba(255,255,255,0.8),2px_2px 4px_rgba(0,0,0,0.1)] flex items-center justify-center">
                        <span className="text-sm font-medium text-[#5a6270]">
                          {agent.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <LEDIndicator
                        color={agent.status === 'online' ? 'green' : agent.status === 'busy' ? 'yellow' : 'off'}
                        size="sm"
                        className="absolute -bottom-0.5 -right-0.5"
                      />
                    </div>
                    <span className="flex-1 text-sm font-medium text-[#374151]">{agent.name}</span>
                    <button
                      onClick={() => handleRemoveAgent(agent.id)}
                      className="
                        w-8 h-8 rounded-lg
                        bg-[#e8ebf0]
                        shadow-[-2px_-2px 4px_rgba(255,255,255,0.7),2px_2px 4px_rgba(0,0,0,0.06)]
                        flex items-center justify-center
                        hover:bg-[#ff4757]/10
                        transition-colors
                      "
                      aria-label={`Remove ${agent.name} from group`}
                    >
                      <svg className="w-4 h-4 text-[#ff4757]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Agents Section */}
          {availableToAdd.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#5a6270] uppercase tracking-wider mb-3">
                Add Members
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableToAdd.map((agent) => (
                  <div
                    key={agent.id}
                    className="
                      flex items-center gap-3 p-3 rounded-xl
                      bg-[#e8ebf0]
                      shadow-[-2px_-2px 4px_rgba(255,255,255,0.7),2px_2px 4px_rgba(0,0,0,0.06)]
                    "
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-[#f0f2f5] shadow-[-2px_-2px 4px_rgba(255,255,255,0.8),2px_2px 4px_rgba(0,0,0,0.1)] flex items-center justify-center">
                        <span className="text-sm font-medium text-[#5a6270]">
                          {agent.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <LEDIndicator
                        color={agent.status === 'online' ? 'green' : agent.status === 'busy' ? 'yellow' : 'off'}
                        size="sm"
                        className="absolute -bottom-0.5 -right-0.5"
                      />
                    </div>
                    <span className="flex-1 text-sm font-medium text-[#374151]">{agent.name}</span>
                    <button
                      onClick={() => handleAddAgent(agent.id)}
                      className="
                        w-8 h-8 rounded-lg
                        bg-[#e8ebf0]
                        shadow-[-2px_-2px 4px_rgba(255,255,255,0.7),2px_2px 4px_rgba(0,0,0,0.06)]
                        flex items-center justify-center
                        hover:bg-[#4ade80]/20
                        transition-colors
                      "
                      aria-label={`Add ${agent.name} to group`}
                    >
                      <svg className="w-4 h-4 text-[#4ade80]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-8">
            <Button
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>

          {/* Delete Group Section */}
          {onDeleteConversation && (
            <div className="mt-6 pt-6 border-t border-[#d5dae2]">
              <button
                onClick={handleDeleteClick}
                className="
                  w-full py-2 px-4 rounded-xl
                  bg-[#e8ebf0]
                  shadow-[-2px_-2px 4px_rgba(255,255,255,0.7),2px_2px 4px_rgba(0,0,0,0.06)]
                  text-[#ff4757] text-sm font-medium
                  hover:bg-[#ff4757]/10
                  transition-colors
                "
              >
                Delete Group
              </button>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        <DeleteConversationModal
          isOpen={showDeleteModal}
          conversationTitle={groupName}
          conversationType="channel"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteModal(false)}
        />

        {/* Decorative screws */}
        <div className="absolute top-4 left-4 w-2.5 h-2.5 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px 2px_rgba(255,255,255,0.6),1px_1px 2px_rgba(0,0,0,0.2)]" />
        <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px 2px_rgba(255,255,255,0.6),1px_1px 2px_rgba(0,0,0,0.2)]" />
        <div className="absolute bottom-4 left-4 w-2.5 h-2.5 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px 2px_rgba(255,255,255,0.6),1px_1px 2px_rgba(0,0,0,0.2)]" />
        <div className="absolute bottom-4 right-4 w-2.5 h-2.5 rounded-full bg-[#c8ccd3] shadow-[-1px_-1px 2px_rgba(255,255,255,0.6),1px_1px 2px_rgba(0,0,0,0.2)]" />
      </div>
    </div>
  );
}

"use client";

/** Adapted from Beautiful UI's Sidebar Nav (MIT): github.com/slev12397/beautiful-ui */
import { Clock3, MessageSquareText, PanelLeftClose, SquarePen } from "lucide-react";

export type ConversationSummary = {
  id: string;
  title: string;
  updatedLabel: string;
};

export function ConversationNav({
  open,
  activeId,
  conversations,
  mocked,
  newConversationDisabled,
  onClose,
  onNewConversation,
  onSelect,
}: {
  open: boolean;
  activeId?: string;
  conversations: ConversationSummary[];
  mocked?: boolean;
  newConversationDisabled?: boolean;
  onClose: () => void;
  onNewConversation: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        className={`agent-conversation-scrim ${open ? "is-open" : ""}`}
        aria-label="Close conversation history"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <nav
        className={`agent-conversation-nav ${open ? "is-open" : ""}`}
        aria-label="Film conversations"
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <div className="agent-conversation-nav__header">
          <strong>Conversations</strong>
          <button type="button" className="agent-icon-button" onClick={onClose} aria-label="Close conversation history">
            <PanelLeftClose size={15} />
          </button>
        </div>

        <button
          type="button"
          className="agent-conversation-nav__new"
          onClick={onNewConversation}
          disabled={newConversationDisabled}
        >
          <SquarePen size={15} />
          <span>New conversation</span>
        </button>

        <div className="agent-conversation-nav__section">
          <span>Recent</span>
          <Clock3 size={12} />
        </div>
        <div className="agent-conversation-nav__list">
          {conversations.length === 0 ? (
            <p>No previous conversations</p>
          ) : conversations.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              className={conversation.id === activeId ? "is-active" : ""}
              aria-current={conversation.id === activeId ? "page" : undefined}
              onClick={() => onSelect(conversation.id)}
            >
              <MessageSquareText size={13} />
              <span>
                <strong>{conversation.title}</strong>
                <small>{conversation.updatedLabel}</small>
              </span>
            </button>
          ))}
        </div>
        {mocked && <p className="agent-conversation-nav__note">Mock history for this film</p>}
      </nav>
    </>
  );
}

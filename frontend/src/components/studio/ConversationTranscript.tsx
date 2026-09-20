import type {
  AssetConversation,
  ConversationMessage,
} from "./assetConversations";

export default function ConversationTranscript({
  conversation,
  showHeader = true,
}: {
  conversation: {
    title: string;
    messages: ConversationMessage[];
    selection?: AssetConversation["selection"];
  };
  /** Off when the asset panel above already names what this thread is about. */
  showHeader?: boolean;
}) {
  return (
    <div className="agent-conversation-preview">
      {showHeader && (
        <div>
          <span>Conversation</span>
          <h2>{conversation.title}</h2>
          {conversation.selection && (
            <div
              className="agent-conversation-context"
              aria-label="Assets in this conversation"
            >
              {conversation.selection.map((asset) => (
                <span key={asset.key}>{asset.label}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {conversation.messages.map((message, index) =>
        message.role === "user" ? (
          <div key={index} className="agent-user-message">
            {message.content}
          </div>
        ) : (
          <div key={index} className="agent-stream">
            <p>{message.content}</p>
          </div>
        ),
      )}
    </div>
  );
}

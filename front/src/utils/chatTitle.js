import i18n from "../i18n";

// Default titles stored on new chats (current and older wording). They stay
// English in the database because code compares against them, and are
// translated only for display.
const STORED_UNTITLED = ["Untitled Chat", "Untitled Conversation"];

export const isUntitled = (title) => !title || STORED_UNTITLED.includes(title);

export const displayTitle = (title) =>
  isUntitled(title) ? i18n.t("conversation.untitled") : title;

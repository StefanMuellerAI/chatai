import i18n from "../../i18n";
import {
  Basketball,
  Book,
  Calendar,
  Camera,
  Chemistry,
  Code,
  Education,
  Favorite,
  GameConsole,
  Globe,
  Hashtag,
  Home,
  Idea,
  Microscope,
  Music,
  Pen,
  Plane,
  Portfolio,
  Restaurant,
  Rocket,
  Scales,
  ShoppingCart,
  Sprout,
  Stethoscope,
  Tools,
  UserMultiple,
  Video,
  Wallet,
} from "@carbon/icons-react";

/**
 * Topic icons.
 *
 * Glyphs come from Carbon, matching the rest of the sidebar chrome. The ids are
 * stable strings stored on the topic row, so the visual set can be re-mapped
 * later without touching stored data.
 */
export type TopicIconId = string;

export const TOPIC_ICONS: {
  id: TopicIconId;
  label: string;
  Icon: typeof Hashtag;
}[] = [
  { id: "hash", get label() { return i18n.t("folders.icons.hash", { defaultValue: "General" }); }, Icon: Hashtag },
  { id: "graduation", get label() { return i18n.t("folders.icons.graduation", { defaultValue: "Study" }); }, Icon: Education },
  { id: "pen", get label() { return i18n.t("folders.icons.pen", { defaultValue: "Writing" }); }, Icon: Pen },
  { id: "stethoscope", get label() { return i18n.t("folders.icons.stethoscope", { defaultValue: "Health" }); }, Icon: Stethoscope },
  { id: "microscope", get label() { return i18n.t("folders.icons.microscope", { defaultValue: "Research" }); }, Icon: Microscope },
  { id: "briefcase", get label() { return i18n.t("folders.icons.briefcase", { defaultValue: "Work" }); }, Icon: Portfolio },
  { id: "code", get label() { return i18n.t("folders.icons.code", { defaultValue: "Code" }); }, Icon: Code },
  { id: "book", get label() { return i18n.t("folders.icons.book", { defaultValue: "Reading" }); }, Icon: Book },
  { id: "flask", get label() { return i18n.t("folders.icons.flask", { defaultValue: "Experiments" }); }, Icon: Chemistry },
  { id: "lightbulb", get label() { return i18n.t("folders.icons.lightbulb", { defaultValue: "Ideas" }); }, Icon: Idea },
  { id: "rocket", get label() { return i18n.t("folders.icons.rocket", { defaultValue: "Projects" }); }, Icon: Rocket },
  { id: "globe", get label() { return i18n.t("folders.icons.globe", { defaultValue: "Travel" }); }, Icon: Globe },
  { id: "plane", get label() { return i18n.t("folders.icons.plane", { defaultValue: "Trips" }); }, Icon: Plane },
  { id: "home", get label() { return i18n.t("folders.icons.home", { defaultValue: "Home" }); }, Icon: Home },
  { id: "heart", get label() { return i18n.t("folders.icons.heart", { defaultValue: "Personal" }); }, Icon: Favorite },
  { id: "dumbbell", get label() { return i18n.t("folders.icons.dumbbell", { defaultValue: "Fitness" }); }, Icon: Basketball },
  { id: "utensils", get label() { return i18n.t("folders.icons.utensils", { defaultValue: "Food" }); }, Icon: Restaurant },
  { id: "wallet", get label() { return i18n.t("folders.icons.wallet", { defaultValue: "Money" }); }, Icon: Wallet },
  { id: "cart", get label() { return i18n.t("folders.icons.cart", { defaultValue: "Shopping" }); }, Icon: ShoppingCart },
  { id: "calendar", get label() { return i18n.t("folders.icons.calendar", { defaultValue: "Planning" }); }, Icon: Calendar },
  { id: "users", get label() { return i18n.t("folders.icons.users", { defaultValue: "People" }); }, Icon: UserMultiple },
  { id: "music", get label() { return i18n.t("folders.icons.music", { defaultValue: "Music" }); }, Icon: Music },
  { id: "camera", get label() { return i18n.t("folders.icons.camera", { defaultValue: "Photos" }); }, Icon: Camera },
  { id: "film", get label() { return i18n.t("folders.icons.film", { defaultValue: "Film" }); }, Icon: Video },
  { id: "game", get label() { return i18n.t("folders.icons.game", { defaultValue: "Games" }); }, Icon: GameConsole },
  { id: "scale", get label() { return i18n.t("folders.icons.scale", { defaultValue: "Legal" }); }, Icon: Scales },
  { id: "wrench", get label() { return i18n.t("folders.icons.wrench", { defaultValue: "Tools" }); }, Icon: Tools },
  { id: "sprout", get label() { return i18n.t("folders.icons.sprout", { defaultValue: "Growth" }); }, Icon: Sprout },
];

export const DEFAULT_TOPIC_ICON = TOPIC_ICONS[0];

const BY_ID = new Map(TOPIC_ICONS.map((entry) => [entry.id, entry]));

/** Resolve an icon by id, falling back to the default glyph. */
export function topicIconById(id?: string | null) {
  return (id && BY_ID.get(id)) || DEFAULT_TOPIC_ICON;
}

/** The icon a topic should render with. */
export function topicIcon(topic: { icon?: string }) {
  return topicIconById(topic?.icon).Icon;
}

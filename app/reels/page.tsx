import { permanentRedirect } from "next/navigation";

export default function LegacyReelsRedirect() {
  permanentRedirect("/swipe-videos");
}

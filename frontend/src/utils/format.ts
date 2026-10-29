import axios from "axios";
export const timezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export const dateLabel = (value: string) =>
  new Date(
    value.length === 10 ? value + "T12:00:00" : value,
  ).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const localMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.code === "RESTRICTED") {
      const until = error.response.data.restrictedUntil;
      return until && Number.isFinite(Date.parse(until))
        ? `Your account is restricted until ${new Date(until).toLocaleString()} in this circle.`
        : "Your account is restricted in this circle.";
    }
    if (error.response?.data?.code === "INVALID_DURATION")
      return "Choose an expiry in the future, no more than 365 days from now. Times use your device’s local timezone.";
    if (error.response?.data?.code === "AI_UNAVAILABLE")
      return "Your message was saved, but the companion could not reply because its AI service is unavailable. You can try a breathing or grounding exercise while it is offline.";
    if (error.response?.data?.code === "ALIAS_TAKEN")
      return "That alias is already in use. Please choose another.";
    if (error.response?.status === 400)
      return "Please check the fields and try again. Make sure each value matches the requested format.";
    if (error.response?.status === 403)
      return "This action is not available for your account or circle membership.";
    if (error.response?.status === 401)
      return "Please sign in again to continue.";
    if (error.response?.status === 429)
      return "Let’s pause for a moment. Please try again shortly.";
    if (error.response?.status === 404) return "This item is not available.";
    if (error.response?.status === 503)
      return "This service is taking a break. Please try again later.";
  }
  return "We couldn’t complete that. Please check your connection and try again.";
}
export const safeUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};
const clinical =
  /depress|disorder|diagnos|suicid|psychos|bipolar|manic|patholog/i;
export const reflectionText = (text: string) =>
  clinical.test(text)
    ? "This reflection is a starting point, not a label. Notice what feels useful to you."
    : text;

import { crisisPayload } from "./crisis";
test("crisis detection finds nested payloads in response collections", () => {
  const support = {
    crisisDetected: true as const,
    message: "Support is available.",
    resources: [],
  };
  expect(crisisPayload({ messages: [{ support }] })).toEqual(support);
  expect(crisisPayload({ entry: { crisisFlag: true } })).toBeNull();
});

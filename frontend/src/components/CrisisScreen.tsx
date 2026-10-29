import { useCrisis } from "../store/crisis";
import { Modal } from "./ConfirmDialog";
import { Disclaimer } from "./Disclaimer";
import { safeUrl } from "../utils/format";
import type { C } from "../types";
export function ResourceList({
  resources,
}: {
  resources: C["CrisisSupport"]["resources"];
}) {
  return (
    <ul className="resource-list">
      {resources.map((r, i) => (
        <li key={r.name + i}>
          <strong>{r.name}</strong>
          {safeUrl(r.url) && (
            <a href={safeUrl(r.url)} target="_blank" rel="noopener noreferrer">
              Visit resource{" "}
              <span className="sr-only">{r.name} (opens a new tab)</span>
            </a>
          )}
          {r.phone && <p>{r.phone}</p>}
        </li>
      ))}
    </ul>
  );
}
export function CrisisScreen() {
  const item = useCrisis((s) => s.queue[0]);
  const acknowledge = useCrisis((s) => s.acknowledge);
  if (!item) return null;
  return (
    <Modal title="You don’t have to face this alone" mandatory>
      <div className="crisis-content">
        <p className="eyebrow">A moment for support</p>
        <p className="preserve">{item.support.message}</p>
        <ResourceList resources={item.support.resources} />
        {!item.support.resources.length && (
          <p>
            If you are in immediate danger, contact your local emergency
            services. You can also reach out to someone you trust.
          </p>
        )}
        <a href="https://findahelpline.com/" target="_blank" rel="noopener noreferrer">
          More support resources (opens a new tab)
        </a>
        <Disclaimer />
        <button autoFocus onClick={acknowledge}>
          I’ve read this. Continue when ready
        </button>
      </div>
    </Modal>
  );
}

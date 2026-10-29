import { useState, useId } from "react";
import { filesApi } from "../api/files";
import { ErrorNotice } from "./Feedback";
export function FileUploader({
  onUploaded,
}: {
  onUploaded: () => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setError(null);
    setMessage("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5242880 ||
      !file.size
    ) {
      setMessage("Choose a JPEG, PNG, or WebP image up to 5 MB.");
      return;
    }
    setBusy(true);
    try {

        const signed = await filesApi.avatar(file);
        if (!signed.uploadSupported) {
          setMessage(
            "Image uploads are unavailable right now. You can continue without one.",
          );
          return;
        }
        await filesApi.put(signed.url, file, signed.requiredHeaders);

      setMessage("Image uploaded.");
      onUploaded();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <label htmlFor={id}>
        Profile image <span className="muted">(optional)</span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <p role="status">{busy ? "Uploading your image…" : message}</p>
      <ErrorNotice error={error} />
    </div>
  );
}

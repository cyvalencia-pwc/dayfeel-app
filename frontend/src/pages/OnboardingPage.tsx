import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { profileApi } from "../api/profile";
import { consentApi } from "../api/consent";
import type { I } from "../types";
import { ConsentFields } from "../components/ConsentFields";
import { Disclaimer } from "../components/Disclaimer";
import { FileUploader } from "../components/FileUploader";
import { ErrorNotice, PageTitle } from "../components/Feedback";
import { queryClient } from "../hooks/queries";
import { useAuth } from "../store/auth";
export function OnboardingPage() {
  const [alias, setAlias] = useState("");
  const [ack, setAck] = useState(false);
  const [consent, setConsent] = useState<I["Consent"]>({
    companionMemory: false,
  });
  const nav = useNavigate();
  const save = useMutation({
    mutationFn: async () => {
      await profileApi.alias(alias);
      await consentApi.save(consent);
      await profileApi.onboard();
      return profileApi.session();
    },
    onSuccess: (s) => {
      useAuth.getState().setSession(s);
      queryClient.setQueryData(["session", useAuth.getState().generation], s);
      nav("/");
    },
  });
  return (
    <div className="narrow">
      <PageTitle eyebrow="Welcome to DayFeel" title="Make this space yours">
        A few choices before we begin.
      </PageTitle>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (ack) save.mutate();
        }}
      >
        <label htmlFor="alias">Your community alias</label>
        <input
          id="alias"
          value={alias}
          pattern="[A-Za-z][A-Za-z0-9]{2,39}"
          title="3–40 letters and digits, beginning with a letter"
          required
          onChange={(e) => setAlias(e.target.value)}
          autoComplete="nickname"
        />
        <p className="muted">
          Choose 3–40 letters and digits, starting with a letter. This is what
          other members see.
        </p>
        <FileUploader onUploaded={() => {}} />
        <h2>Your choices, always</h2>
        <ConsentFields
          value={consent}
          onChange={setConsent}
          disabled={save.isPending}
        />
        <Disclaimer />
        <label className="check-label">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            required
          />
          I understand what DayFeel can and cannot offer.
        </label>
        <ErrorNotice error={save.error} />
        <button disabled={!ack || save.isPending}>
          {save.isPending ? "Getting ready…" : "Begin my DayFeel"}
        </button>
      </form>
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { profileApi } from "../api/profile";
import { consentApi } from "../api/consent";
import { privacyApi } from "../api/privacy";
import { ConsentFields } from "../components/ConsentFields";
import { FileUploader } from "../components/FileUploader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorNotice, Loading, PageTitle } from "../components/Feedback";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { queryClient } from "../hooks/queries";
import { safeUrl } from "../utils/format";
import type { I } from "../types";
function ProfileSettings({ profile }: { profile: I["Profile"] }) {
  const [alias, setAlias] = useState(profile.alias);
  const [consent, setConsent] = useState(profile.consent);
  const save = useMutation({
    mutationFn: async () => {
      await profileApi.alias(alias);
      await consentApi.save(consent);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
      useUI.getState().announce("Your choices are saved.");
    },
  });
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h2>Your profile and choices</h2>
      {profile.avatarUrl && safeUrl(profile.avatarUrl) && (
        <img
          className="avatar"
          src={safeUrl(profile.avatarUrl)}
          alt="Your profile"
        />
      )}
      <label htmlFor="settings-alias">Community alias</label>
      <input
        id="settings-alias"
        required
        pattern="[A-Za-z][A-Za-z0-9]{2,39}"
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
      />
      <FileUploader
        onUploaded={() =>
          void queryClient.invalidateQueries({ queryKey: ["profile"] })
        }
      />
      <ConsentFields
        value={consent}
        onChange={setConsent}
        disabled={save.isPending}
      />
      <ErrorNotice error={save.error} />
      <button disabled={save.isPending}>Save profile and choices</button>
    </form>
  );
}
export function SettingsPage() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: profileApi.get });
  const [params, setParams] = useSearchParams();
  const exportId = params.get("export");
  const [confirm, setConfirm] = useState(false);
  const nav = useNavigate();
  const status = useQuery({
    queryKey: ["privacy", exportId],
    enabled: !!exportId,
    queryFn: () => privacyApi.status(exportId!),
    refetchInterval: (q) =>
      q.state.data?.status === "COMPLETED" || q.state.error ? false : 5000,
  });
  const exp = useMutation({
    mutationFn: privacyApi.export,
    onSuccess: (r) => setParams({ export: r.id }),
  });
  const del = useMutation({
    mutationFn: privacyApi.deleteAccount,
    onSuccess: () => {
      useAuth.getState().logout();
      queryClient.clear();
      nav("/login");
    },
  });
  return (
    <>
      <PageTitle title="Your space, your choices" />
      <ErrorNotice error={profile.error} />
      {profile.isPending ? (
        <Loading />
      ) : (
        profile.data && <ProfileSettings profile={profile.data} />
      )}
      <section className="card stack">
        <h2>Your data</h2>
        <p>
          Request a copy of your information. Preparation can take a little
          time.
        </p>
        <button
          className="secondary"
          disabled={exp.isPending || status.data?.status === "PENDING"}
          onClick={() => exp.mutate()}
        >
          Export my data
        </button>
        {status.data?.status === "PENDING" && (
          <p role="status">
            Your export is being prepared. You can bookmark this page to check
            again.
          </p>
        )}
        {status.data?.downloadUrl && safeUrl(status.data.downloadUrl) && (
          <a href={safeUrl(status.data.downloadUrl)}>Download your data</a>
        )}
        <ErrorNotice error={exp.error || status.error} />
        <hr />
        <h2>Leave DayFeel</h2>
        <p>
          Deleting your account removes private entries and replaces shared
          contributions with anonymous placeholders. This cannot be undone.
        </p>
        <button className="danger" onClick={() => setConfirm(true)}>
          Delete my account
        </button>
      </section>
      {confirm && (
        <ConfirmDialog
          title="Permanently delete your account?"
          onCancel={() => setConfirm(false)}
          onConfirm={() => del.mutate()}
          busy={del.isPending}
        >
          <p>You will be signed out immediately while deletion finishes.</p>
          <ErrorNotice error={del.error} />
        </ConfirmDialog>
      )}
    </>
  );
}

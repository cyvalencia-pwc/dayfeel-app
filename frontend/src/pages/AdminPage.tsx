import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { circlesApi } from "../api/circles";
import { ErrorNotice, PageTitle } from "../components/Feedback";
export function AdminPage() {
  const [name, setName] = useState("");
  const circles = useQuery({
    queryKey: ["circles", "admin"],
    queryFn: () => circlesApi.list(),
  });
  const create = useMutation({
    mutationFn: () => circlesApi.create(name),
    onSuccess: () => {
      setName("");
      void circles.refetch();
    },
  });
  return (
    <>
      <PageTitle title="Look after DayFeel" />
      <section className="card">
        <h2>Circles</h2>
        <ul>
          {circles.data?.map((c) => (
            <li key={c.id}>{c.name}</li>
          ))}
        </ul>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label htmlFor="circle-name">New circle name</label>
          <input
            id="circle-name"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <ErrorNotice error={circles.error || create.error} />
          <button disabled={create.isPending}>Create circle</button>
        </form>
      </section>
    </>
  );
}

import { errorMessage } from "../utils/format";
export function ErrorNotice({ error }: { error: unknown }) {
  return error ? (
    <p role="alert" className="error">
      {errorMessage(error)}
    </p>
  ) : null;
}
export function Loading() {
  return <p role="status">Making a little space…</p>;
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-title">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}

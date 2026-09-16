"use client";
import { useEffect, useRef } from "react";
import { X, Database, Info } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose}>
      <header>
        <h2>{title}</h2>
        <button aria-label="Fechar" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function Empty({
  title = "Nenhum dado disponível",
  text = "Dado não disponibilizado pela API.",
  children,
}: {
  title?: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Database size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Help({ text }: { text: string }) {
  return (
    <span tabIndex={0} className="help" aria-label={text}>
      <Info size={14} />
      <span role="tooltip">{text}</span>
    </span>
  );
}
export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)
    : "—";
export const date = (value: string | Date | null | undefined) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        timeZone: "America/Maceio",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Ainda não";
export function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: unknown;
  detail?: string;
  tone?: string;
}) {
  return (
    <div className="metric">
      <div>
        {label}
        <Help
          text={
            detail ||
            "Dado real coletado pela API; traço significa informação indisponível."
          }
        />
      </div>
      <strong className={tone}>
        {typeof value === "string" ? value : num(value)}
      </strong>
      <small>{detail || "DADO REAL DA API"}</small>
    </div>
  );
}
export function RenderData({ value }: { value: any }) {
  if (value == null) return <span>—</span>;
  if (typeof value === "boolean") return <span>{value ? "Sim" : "Não"}</span>;
  if (typeof value !== "object")
    return <p className="preserve">{String(value)}</p>;
  if (Array.isArray(value))
    return (
      <div className="data-list">
        {value.map((v, i) => (
          <div key={i}>
            <RenderData value={v} />
          </div>
        ))}
      </div>
    );
  return (
    <dl className="data-dl">
      {Object.entries(value)
        .filter(([k]) => k !== "source_ids")
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k.replaceAll("_", " ")}</dt>
            <dd>
              <RenderData value={v} />
            </dd>
          </div>
        ))}
    </dl>
  );
}
export async function api(path: string, body?: unknown, method?: string) {
  const res = await fetch(`/api/${path}`, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (res.status === 401) {
    location.href = "/login";
    throw Error("Entre para continuar.");
  }
  if (!res.ok) throw Error(data.error || "Não foi possível concluir.");
  return data;
}

"use client";

import { useLibrary, cost, labelDate } from "../../workspace/state";
import { Card, Empty } from "../../workspace/ui";

export default function UsagePage() {
  const { jobs, usage } = useLibrary();

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-neutral-200 bg-white/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
        <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
          Usage
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold">API Activity</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-500">
          Your usage of the translation API. This includes the number of input
          and output tokens processed, the estimated cost of the translations,
          and the number of chapters translated. The jobs section below shows a
          history of translation jobs, including their status, provider, model,
          and any errors encountered.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Input tokens", value: usage.tokens.input.toLocaleString() },
          {
            label: "Output tokens",
            value: usage.tokens.output.toLocaleString(),
          },
          { label: "Estimated cost", value: cost(usage.cost) },
          { label: "Translated", value: String(usage.translatedChapters) },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">
              {item.label}
            </p>
            <p className="mt-2 font-serif text-3xl font-semibold">
              {item.value}
            </p>
          </div>
        ))}
      </section>

      <Card>
        <h2 className="font-serif text-2xl font-semibold">Jobs</h2>
        <div className="mt-4 grid gap-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-lg border border-neutral-200 bg-white p-3 text-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {job.target} / {job.status} / {job.provider} / {job.model}
                </span>
                <span>
                  {cost(job.estimatedCost)} /{" "}
                  {labelDate(job.completedAt ?? job.createdAt)}
                </span>
              </div>
              {job.error ? (
                <p className="mt-2 text-neutral-500">{job.error}</p>
              ) : null}
            </div>
          ))}
          {jobs.length === 0 ? (
            <Empty
              title="No jobs yet"
              body="Translate a chapter or description to populate history."
            />
          ) : null}
        </div>
      </Card>
    </div>
  );
}

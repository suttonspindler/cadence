import ReactMarkdown from "react-markdown";

// Renders the assistant's markdown answer with styling that matches the app,
// so emphasis (*italic*, **bold**), lists, and links display properly instead
// of showing raw markdown characters. `node` is destructured out of each
// component so react-markdown's internal prop doesn't leak into the DOM.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="leading-relaxed">
      <ReactMarkdown
        components={{
          p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-ink" {...props} />
          ),
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          ul: ({ node, ...props }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5" {...props} />
          ),
          a: ({ node, ...props }) => <a className="text-accent hover:underline" {...props} />,
          h1: ({ node, ...props }) => (
            <h3 className="mb-2 font-display text-lg font-semibold" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h3 className="mb-2 font-display text-lg font-semibold" {...props} />
          ),
          h3: ({ node, ...props }) => <h4 className="mb-2 font-medium" {...props} />,
          code: ({ node, ...props }) => (
            <code className="rounded bg-line/60 px-1 py-0.5 text-sm" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

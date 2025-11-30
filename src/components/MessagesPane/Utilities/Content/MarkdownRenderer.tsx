import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";

// extend default schema to ensure br tags are allowed and links can open in new tabs
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "br"],
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || []), "target", "rel"],
  },
};

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
}) => (
  <div className="prose-sm [&_a]:text-blue-400 [&_a]:underline [&_a]:hover:text-blue-300 [&_blockquote]:border-l-2 [&_blockquote]:border-current [&_blockquote]:pl-2 [&_blockquote]:opacity-80 [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_h4]:font-bold [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:rounded [&_pre]:bg-black/10 [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-4">
    <ReactMarkdown
      remarkPlugins={[remarkBreaks]}
      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      components={{
        a: ({ href, children, ...props }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

interface MarkdownRendererProps {
  content: string;
  enableMdLinks?: boolean;
  enableMdImages?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  enableMdLinks = false,
  enableMdImages = false,
}) => (
  <div className="prose-sm [&_a]:text-blue-400 [&_a]:underline [&_a]:hover:text-blue-300 [&_blockquote]:border-l-2 [&_blockquote]:border-current [&_blockquote]:pl-2 [&_blockquote]:opacity-80 [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_h4]:font-bold [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:rounded [&_pre]:bg-black/10 [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-4">
    <ReactMarkdown
      remarkPlugins={[remarkBreaks]}
      components={{
        a: ({ href, children, ...props }) =>
          enableMdLinks ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (
                  !confirm(
                    `You are navigating away from Kasia to ${href}. Continue?`
                  )
                ) {
                  e.preventDefault();
                }
              }}
              {...props}
            >
              {children}
            </a>
          ) : (
            <span {...props}>
              KASIA PERMISSION - Links Not Enabled | Link Text: {children} |
              Link: {href}
            </span>
          ),
        img: ({ src, alt, ...props }) =>
          enableMdImages ? (
            <img src={src} alt={alt} {...props} />
          ) : (
            <span className="text-gray-500 italic" {...props}>
              [KASIA PERMISSION - Image Links Not Enabled: {src}]
            </span>
          ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

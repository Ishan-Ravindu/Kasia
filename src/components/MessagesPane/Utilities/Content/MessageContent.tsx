import { FC, useState, useRef, useEffect } from "react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import { parseMessageForDisplay } from "../../../../utils/message-format";
import { MARKDOWN_PREFIX } from "../../../../config/constants";

// extend default schema to ensure br tags are allowed
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "br"],
};

type MessageContentProps = {
  content: string;
  isDecrypting: boolean;
  isOutgoing?: boolean;
};

export const MessageContent: FC<MessageContentProps> = ({
  content,
  isDecrypting,
  isOutgoing = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldCollapse, setShouldCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // check if content should be collapsed based on line count, length or some combo
  useEffect(() => {
    if (typeof content === "string" && !isDecrypting) {
      const lineCount = content.split("\n").length;
      const contentLength = content.length;
      // collapse if more than 8 lines OR if content is very long
      setShouldCollapse(
        (lineCount > 6 && contentLength > 100) ||
          lineCount > 10 ||
          contentLength > 300
      );
    }
  }, [content, isDecrypting]);

  if (isDecrypting) {
    return (
      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 italic">
        Decrypting message...
      </div>
    );
  }

  // render content (markdown or plain text) with expand/collapse functionality
  if (typeof content === "string") {
    // check if content starts with markdown flag and process content
    const isMarkdown = content.startsWith(MARKDOWN_PREFIX);
    const displayContent = isMarkdown
      ? content.slice(MARKDOWN_PREFIX.length)
      : content;

    const renderedContent = isMarkdown ? (
      <div className="prose-sm [&_blockquote]:border-l-2 [&_blockquote]:border-current [&_blockquote]:pl-2 [&_blockquote]:opacity-80 [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_h4]:font-bold [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:rounded [&_pre]:bg-black/10 [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-4">
        <ReactMarkdown
          remarkPlugins={[remarkBreaks]}
          rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        >
          {displayContent}
        </ReactMarkdown>
      </div>
    ) : (
      parseMessageForDisplay(displayContent)
    );

    return (
      <div>
        <div
          ref={contentRef}
          className={clsx(
            "overflow-hidden transition-all duration-300 ease-in-out",
            {
              "max-h-32": shouldCollapse && !isExpanded,
            }
          )}
          style={{
            maxHeight: shouldCollapse && !isExpanded ? "10rem" : "none",
            maskImage:
              shouldCollapse && !isExpanded
                ? "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 80%, rgba(0,0,0,0.3) 90%, rgba(0,0,0,0) 100%)"
                : "none",
          }}
        >
          {renderedContent}
        </div>

        {shouldCollapse && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={clsx(
              "text-text-secondary w-full cursor-pointer px-2 pb-2 text-xs font-semibold underline opacity-70 transition-opacity hover:opacity-100",
              {
                "text-right": !isOutgoing,
                "text-left": isOutgoing,
              }
            )}
          >
            {isExpanded ? "collapse" : "see more..."}
          </button>
        )}
      </div>
    );
  }

  return content;
};

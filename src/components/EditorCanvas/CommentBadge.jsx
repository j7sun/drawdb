import { useComments } from "../../context/CommentsContext";
import { LayoutContext } from "../../context/LayoutContext";
import { useContext } from "react";

/**
 * Badge displayed on a table header showing the count of unresolved comments.
 * - Shows a "+" icon when there are no comments (invites the user to add one).
 * - Shows the unresolved count as a red badge when comments exist.
 * - Clicking opens the CommentsSheet for this table.
 */
export default function CommentBadge({ tableId }) {
  const { comments } = useComments();
  const { setLayout } = useContext(LayoutContext);

  const unresolved = comments.filter(
    (c) => c.tableId === tableId && !c.resolved
  ).length;

  function handleClick(e) {
    e.stopPropagation();
    setLayout((prev) => ({
      ...prev,
      commentsSheet: true,
      commentsTableId: tableId,
    }));
  }

  if (unresolved === 0) {
    return (
      <button
        onClick={handleClick}
        title="Add comment"
        className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full
                   bg-blue-500 text-white text-xs flex items-center justify-center
                   hover:bg-blue-600 focus:outline-none"
      >
        +
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      title={`${unresolved} unresolved comment${unresolved !== 1 ? "s" : ""}`}
      className="w-5 h-5 rounded-full bg-red-500 text-white text-xs
                 flex items-center justify-center hover:bg-red-600 focus:outline-none"
    >
      {unresolved}
    </button>
  );
}
